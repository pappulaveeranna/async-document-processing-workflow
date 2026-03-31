import time
from celery import Task
from app.worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.models import JobStatus
from app.services.redis_service import publish_progress
from app.services.document_service import (
    update_job_status, update_extracted_data,
    derive_structured_fields, extract_text_from_file
)


def _step(db, job_id: str, event: str, progress: int, stage: str, status: JobStatus):
    publish_progress(job_id, event, progress, stage)
    update_job_status(db, job_id, status, stage=stage, progress=progress)


def run_processing(job_id: str, document_id: str,
                   file_path: str, file_type: str, file_size: int, filename: str):
    """Core processing logic — called by Celery task or directly in a thread."""
    db = SessionLocal()
    try:
        _step(db, job_id, "job_started", 5, "job_started", JobStatus.processing)
        time.sleep(0.5)

        _step(db, job_id, "document_parsing_started", 20, "parsing_started", JobStatus.processing)
        time.sleep(1)
        text = extract_text_from_file(file_path, file_type)

        _step(db, job_id, "document_parsing_completed", 45, "parsing_completed", JobStatus.processing)
        time.sleep(0.5)

        _step(db, job_id, "field_extraction_started", 60, "extraction_started", JobStatus.processing)
        time.sleep(1)
        structured = derive_structured_fields(filename, file_type, file_size, text)

        _step(db, job_id, "field_extraction_completed", 80, "extraction_completed", JobStatus.processing)
        time.sleep(0.5)

        update_extracted_data(db, job_id, structured)
        _step(db, job_id, "result_stored", 95, "result_stored", JobStatus.processing)
        time.sleep(0.3)

        _step(db, job_id, "job_completed", 100, "completed", JobStatus.completed)

    except Exception as exc:
        publish_progress(job_id, "job_failed", 0, "failed", str(exc))
        update_job_status(db, job_id, JobStatus.failed, stage="failed", error=str(exc))
        raise
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10, name="process_document")
def process_document(self: Task, job_id: str, document_id: str,
                     file_path: str, file_type: str, file_size: int, filename: str):
    """Celery task wrapper — handles retries."""
    try:
        run_processing(job_id, document_id, file_path, file_type, file_size, filename)
    except Exception as exc:
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            pass
