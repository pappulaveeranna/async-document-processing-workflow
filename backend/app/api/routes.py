import os
import csv
import json
import uuid
import asyncio
import aiofiles
from io import StringIO
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.schemas.schemas import JobOut, JobsListResponse, UpdateExtractedData, FinalizeRequest
from app.services.document_service import (
    save_document_and_job, get_jobs, get_job_by_id,
    update_extracted_data, finalize_job, update_job_status
)
from app.services.redis_service import get_cached_status, subscribe_to_job, publish_progress
from app.models.models import JobStatus

router = APIRouter()


@router.post("/upload", status_code=201)
async def upload_documents(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    results = []

    for file in files:
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(400, f"{file.filename} exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

        content_type = file.content_type or "text/plain"
        ext = os.path.splitext(file.filename)[1]
        saved_name = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, saved_name)

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        doc, job = save_document_and_job(
            db, saved_name, file.filename, content_type, len(content), file_path
        )

        publish_progress(job.id, "job_queued", 0, "queued", "Job queued for processing")
        update_job_status(db, job.id, JobStatus.queued, stage="queued", progress=0)

        from app.worker.tasks import process_document
        task = process_document.delay(
            job.id, doc.id, file_path, content_type, len(content), file.filename
        )
        update_job_status(db, job.id, JobStatus.queued, celery_task_id=task.id)

        results.append({"document_id": doc.id, "job_id": job.id, "filename": file.filename})

    return results


@router.get("/jobs", response_model=JobsListResponse)
def list_jobs(
    status: str = Query(None),
    search: str = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    items, total = get_jobs(db, status, search, sort_by, sort_order, skip, limit)
    return {"items": items, "total": total}


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/jobs/{job_id}/progress")
async def stream_progress(job_id: str):
    """SSE endpoint — subscribes to Redis Pub/Sub channel job:<job_id>."""
    async def event_generator():
        # Send current cached state immediately so client gets instant feedback
        cached = get_cached_status(job_id)
        if cached:
            yield f"data: {json.dumps(cached)}\n\n"
            if cached.get("event") in ("job_completed", "job_failed"):
                return

        pubsub = subscribe_to_job(job_id)
        try:
            for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
                    data = json.loads(message["data"])
                    if data.get("event") in ("job_completed", "job_failed"):
                        break
                await asyncio.sleep(0.05)
        finally:
            pubsub.unsubscribe(f"job:{job_id}")
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.failed:
        raise HTTPException(400, "Only failed jobs can be retried")

    # Idempotent retry guard
    if job.status == JobStatus.processing:
        raise HTTPException(400, "Job is already processing")

    job.retry_count += 1
    job.error_message = None
    db.commit()

    publish_progress(job.id, "job_queued", 0, "queued", "Job re-queued for retry")
    update_job_status(db, job_id, JobStatus.queued, stage="queued", progress=0)

    from app.worker.tasks import process_document
    task = process_document.delay(
        job.id, job.document_id, job.document.file_path,
        job.document.file_type, job.document.file_size, job.document.original_filename
    )
    update_job_status(db, job_id, JobStatus.queued, celery_task_id=task.id)
    return {"job_id": job_id, "celery_task_id": task.id}


@router.put("/jobs/{job_id}/extracted")
def update_extracted(job_id: str, body: UpdateExtractedData, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.completed, JobStatus.finalized):
        raise HTTPException(400, "Job must be completed before editing")
    updated = update_extracted_data(db, job_id, body.extracted_data)
    return {"job_id": job_id, "extracted_data": updated.extracted_data}


@router.post("/jobs/{job_id}/finalize")
def finalize(job_id: str, body: FinalizeRequest, db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.completed, JobStatus.finalized):
        raise HTTPException(400, "Job must be completed before finalizing")
    updated = finalize_job(db, job_id, body.finalized_data)
    return {"job_id": job_id, "status": updated.status}


@router.get("/jobs/{job_id}/export")
def export_job(job_id: str, format: str = Query("json"), db: Session = Depends(get_db)):
    job = get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.finalized:
        raise HTTPException(400, "Only finalized jobs can be exported")

    data = job.finalized_data or job.extracted_data or {}

    if format == "csv":
        output = StringIO()
        flat = _flatten(data)
        writer = csv.DictWriter(output, fieldnames=flat.keys())
        writer.writeheader()
        writer.writerow(flat)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={job_id}.csv"}
        )

    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename={job_id}.json"}
    )


def _flatten(d: dict, parent_key: str = "", sep: str = ".") -> dict:
    items = {}
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.update(_flatten(v, new_key, sep))
        elif isinstance(v, list):
            items[new_key] = ", ".join(str(i) for i in v)
        else:
            items[new_key] = v
    return items
