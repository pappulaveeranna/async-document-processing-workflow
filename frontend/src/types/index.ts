export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'finalized'

export interface Document {
  id: string
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  uploaded_at: string
}

export interface Job {
  id: string
  document_id: string
  celery_task_id: string | null
  status: JobStatus
  current_stage: string | null
  progress: number
  error_message: string | null
  retry_count: number
  extracted_data: Record<string, unknown> | null
  finalized_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  document: Document
}

export interface JobsResponse {
  items: Job[]
  total: number
}

export interface ProgressEvent {
  job_id: string
  event: string
  progress: number
  stage: string
  message: string
}
