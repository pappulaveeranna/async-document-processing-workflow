import axios from 'axios'
import type { Job, JobsResponse } from '@/types'

const BASE_URL = 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL })

export const uploadDocuments = (files: File[]) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  return api.post<{ document_id: string; job_id: string; filename: string }[]>('/api/upload', form)
}

export const listJobs = (params: {
  status?: string
  search?: string
  sort_by?: string
  sort_order?: string
  skip?: number
  limit?: number
}) => api.get<JobsResponse>('/api/jobs', { params })

export const getJob = (jobId: string) => api.get<Job>(`/api/jobs/${jobId}`)

export const retryJob = (jobId: string) => api.post(`/api/jobs/${jobId}/retry`)

export const updateExtracted = (jobId: string, extracted_data: unknown) =>
  api.put(`/api/jobs/${jobId}/extracted`, { extracted_data })

export const finalizeJob = (jobId: string, finalized_data: unknown) =>
  api.post(`/api/jobs/${jobId}/finalize`, { finalized_data })

export const exportJob = (jobId: string, format: 'json' | 'csv') => {
  window.open(`${BASE_URL}/api/jobs/${jobId}/export?format=${format}`, '_blank')
}

export const getProgressUrl = (jobId: string) => `${BASE_URL}/api/jobs/${jobId}/progress`
