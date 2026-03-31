'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadDocuments } from '@/lib/api'
import UploadZone from '@/components/UploadZone'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface UploadResult {
  filename: string
  job_id: string
  status: 'success' | 'error'
  error?: string
}

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    setResults([])
    try {
      const { data } = await uploadDocuments(files)
      setResults(data.map(r => ({ filename: r.filename, job_id: r.job_id, status: 'success' })))
      setFiles([])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setResults(files.map(f => ({ filename: f.name, job_id: '', status: 'error', error: msg })))
    } finally {
      setUploading(false)
    }
  }

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Documents</h1>

      <UploadZone onFiles={f => setFiles(prev => [...prev, ...f])} disabled={uploading} />

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">{files.length} file(s) selected</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2 text-sm">
              <span className="truncate max-w-xs">{f.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">{formatSize(f.size)}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500">✕</button>
              </div>
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-gray-700">Upload Results</h2>
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${r.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {r.status === 'success'
                ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.filename}</p>
                {r.status === 'error' && <p className="text-xs text-red-600">{r.error}</p>}
              </div>
              {r.status === 'success' && (
                <button onClick={() => router.push(`/jobs/${r.job_id}`)}
                  className="text-xs text-blue-600 hover:underline shrink-0">
                  View Job →
                </button>
              )}
            </div>
          ))}
          <button onClick={() => router.push('/')} className="mt-2 text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
