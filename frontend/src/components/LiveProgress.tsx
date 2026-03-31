'use client'
import { useEffect, useState } from 'react'
import { getProgressUrl } from '@/lib/api'
import type { ProgressEvent } from '@/types'
import ProgressBar from './ProgressBar'

interface Props {
  jobId: string
  initialProgress: number
  initialStage: string | null
  onComplete?: () => void
}

export default function LiveProgress({ jobId, initialProgress, initialStage, onComplete }: Props) {
  const [progress, setProgress] = useState(initialProgress)
  const [stage, setStage] = useState(initialStage)

  useEffect(() => {
    if (initialProgress >= 100) return
    const es = new EventSource(getProgressUrl(jobId))

    es.onmessage = (e) => {
      const data: ProgressEvent = JSON.parse(e.data)
      setProgress(data.progress)
      setStage(data.stage)
      if (data.event === 'job_completed' || data.event === 'job_failed') {
        es.close()
        onComplete?.()
      }
    }

    es.onerror = () => es.close()
    return () => es.close()
  }, [jobId, initialProgress, onComplete])

  return <ProgressBar progress={progress} stage={stage} />
}
