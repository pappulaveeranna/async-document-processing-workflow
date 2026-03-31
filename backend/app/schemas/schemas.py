from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from app.models.models import JobStatus


class DocumentOut(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: str
    document_id: str
    celery_task_id: Optional[str]
    status: JobStatus
    current_stage: Optional[str]
    progress: int
    error_message: Optional[str]
    retry_count: int
    extracted_data: Optional[Any]
    finalized_data: Optional[Any]
    created_at: datetime
    updated_at: datetime
    document: DocumentOut

    model_config = {"from_attributes": True}


class JobListOut(BaseModel):
    id: str
    document_id: str
    status: JobStatus
    current_stage: Optional[str]
    progress: int
    retry_count: int
    created_at: datetime
    updated_at: datetime
    document: DocumentOut

    model_config = {"from_attributes": True}


class UpdateExtractedData(BaseModel):
    extracted_data: Any


class FinalizeRequest(BaseModel):
    finalized_data: Any


class JobsListResponse(BaseModel):
    items: list[JobListOut]
    total: int
