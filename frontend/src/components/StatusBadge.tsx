'use client'
import type { JobStatus } from '@/types'

const config: Record<JobStatus, { label: string; className: string }> = {
  queued:     { label: 'Queued',     className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  completed:  { label: 'Completed',  className: 'bg-green-100 text-green-800' },
  failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800' },
  finalized:  { label: 'Finalized',  className: 'bg-purple-100 text-purple-800' },
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
