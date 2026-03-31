'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getJob, retryJob, updateExtracted, finalizeJob, exportJob } from '@/lib/api'
import type { Job } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import LiveProgress from '@/components/LiveProgress'
import { ArrowLeft, Download, CheckCheck, RefreshCw, Save } from 'lucide-react'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchJob = useCallback(async () => {
    try {
      const { data } = await getJob(id)
      setJob(data)
      if (!editMode) setEditValue(JSON.stringify(data.extracted_data ?? {}, null, 2))
    } finally {
      setLoading(false)
    }
  }, [id, editMode])

  useEffect(() => { fetchJob() }, [fetchJob])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const parsed = JSON.parse(editValue)
      await updateExtracted(id, parsed)
      setEditMode(false)
      fetchJob()
    } catch {
      setError('Invalid JSON — please fix before saving.')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    setSaving(true)
    try {
      const parsed = JSON.parse(editValue)
      await finalizeJob(id, parsed)
      fetchJob()
    } catch {
      setError('Invalid JSON — please fix before finalizing.')
    } finally {
      setSaving(false)
    }
  }

  const handleRetry = async () => {
    await retryJob(id)
    fetchJob()
  }

  const formatDate = (s: string) => new Date(s).toLocaleString()
  const formatSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  if (loading) return <div className="text-center py-16 text-gray-500">Loading...</div>
  if (!job) return <div className="text-center py-16 text-gray-500">Job not found.</div>

  const isEditable = job.status === 'completed' || job.status === 'finalized'
  const displayData = job.finalized_data ?? job.extracted_data

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => router.push('/')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{job.document.original_filename}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {job.document.file_type} · {formatSize(job.document.file_size)} · Uploaded {formatDate(job.document.uploaded_at)}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Job ID:</span> <span className="font-mono text-xs">{job.id}</span></div>
          <div><span className="text-gray-500">Retries:</span> {job.retry_count}</div>
          <div><span className="text-gray-500">Stage:</span> {job.current_stage ?? '—'}</div>
          <div><span className="text-gray-500">Updated:</span> {formatDate(job.updated_at)}</div>
        </div>

        {(job.status === 'queued' || job.status === 'processing') && (
          <div className="mt-4">
            <LiveProgress jobId={job.id} initialProgress={job.progress} initialStage={job.current_stage} onComplete={fetchJob} />
          </div>
        )}

        {job.status === 'failed' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {job.error_message}
            <button onClick={handleRetry} className="ml-4 flex items-center gap-1 text-orange-600 hover:underline inline-flex">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Extracted Data */}
      {displayData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {job.status === 'finalized' ? 'Finalized Data' : 'Extracted Data'}
            </h2>
            <div className="flex gap-2">
              {isEditable && !editMode && (
                <button onClick={() => setEditMode(true)}
                  className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
                  Edit
                </button>
              )}
              {editMode && (
                <>
                  <button onClick={() => { setEditMode(false); setError('') }}
                    className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
                    <Save className="w-3 h-3" /> Save
                  </button>
                </>
              )}
              {isEditable && job.status !== 'finalized' && (
                <button onClick={handleFinalize} disabled={saving}
                  className="flex items-center gap-1 text-sm bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 disabled:opacity-50">
                  <CheckCheck className="w-3 h-3" /> Finalize
                </button>
              )}
              {job.status === 'finalized' && (
                <div className="flex gap-2">
                  <button onClick={() => exportJob(id, 'json')}
                    className="flex items-center gap-1 text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
                    <Download className="w-3 h-3" /> JSON
                  </button>
                  <button onClick={() => exportJob(id, 'csv')}
                    className="flex items-center gap-1 text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {editMode ? (
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="w-full h-96 font-mono text-sm border border-gray-300 rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="space-y-3">
              {/* Structured view */}
              {typeof displayData === 'object' && displayData !== null && (
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(displayData as Record<string, unknown>).map(([key, val]) => (
                    <div key={key} className="border border-gray-100 rounded p-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        {key.replace(/_/g, ' ')}
                      </p>
                      {typeof val === 'object' && !Array.isArray(val) ? (
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                          {JSON.stringify(val, null, 2)}
                        </pre>
                      ) : Array.isArray(val) ? (
                        <div className="flex flex-wrap gap-1">
                          {(val as unknown[]).length === 0
                            ? <span className="text-sm text-gray-400">None extracted</span>
                            : (val as unknown[]).map((kw, i) => (
                                <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{String(kw)}</span>
                              ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                          {String(val) || '—'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
