'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { listJobs, retryJob } from '@/lib/api'
import type { Job, JobStatus } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import LiveProgress from '@/components/LiveProgress'
import { RefreshCw, Search, Upload } from 'lucide-react'

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'finalized', label: 'Finalized' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(0)
  const limit = 10

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await listJobs({
        status: status || undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        skip: page * limit,
        limit,
      })
      setJobs(data.items)
      setTotal(data.total)
    } catch (e) {
      console.error('Failed to fetch jobs', e)
    } finally {
      setLoading(false)
    }
  }, [status, search, sortBy, sortOrder, page])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing')
    if (!hasActive) return
    const t = setTimeout(fetchJobs, 5000)
    return () => clearTimeout(t)
  }, [jobs, fetchJobs])

  const handleRetry = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    await retryJob(jobId)
    fetchJobs()
  }

  const formatDate = (s: string) => new Date(s).toLocaleString()
  const formatSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div suppressHydrationWarning>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={fetchJobs} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => router.push('/upload')} className="flex items-center gap-1 text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700">
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search filename..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={`${sortBy}:${sortOrder}`}
          onChange={e => { const [b, o] = e.target.value.split(':'); setSortBy(b); setSortOrder(o) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="created_at:desc">Newest First</option>
          <option value="created_at:asc">Oldest First</option>
          <option value="updated_at:desc">Recently Updated</option>
          <option value="status:asc">Status A-Z</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No jobs found. <a href="/upload" className="text-blue-600 hover:underline">Upload a document</a>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-48">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map(job => (
                <tr key={job.id} onClick={() => router.push(`/jobs/${job.id}`)}
                  className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-xs">{job.document.original_filename}</p>
                    <p className="text-xs text-gray-400">{job.document.file_type}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={job.status as JobStatus} /></td>
                  <td className="px-4 py-3">
                    {(job.status === 'queued' || job.status === 'processing') ? (
                      <LiveProgress jobId={job.id} initialProgress={job.progress} initialStage={job.current_stage} onComplete={fetchJobs} />
                    ) : (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${job.status === 'failed' ? 'bg-red-400' : 'bg-green-500'}`}
                          style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatSize(job.document.file_size)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(job.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/jobs/${job.id}`)}
                        className="text-xs text-blue-600 hover:underline">View</button>
                      {job.status === 'failed' && (
                        <button onClick={e => handleRetry(e, job.id)}
                          className="text-xs text-orange-600 hover:underline">Retry</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
