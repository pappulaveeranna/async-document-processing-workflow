'use client'
import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export default function UploadZone({ onFiles, disabled }: Props) {
  const [dragging, setDragging] = useState(false)

  const handle = useCallback((files: FileList | null) => {
    if (!files || disabled) return
    onFiles(Array.from(files))
  }, [onFiles, disabled])

  return (
    <label
      className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
    >
      <Upload className="w-10 h-10 text-gray-400 mb-2" />
      <p className="text-sm text-gray-600">Drag & drop files or <span className="text-blue-600 font-medium">browse</span></p>
      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, CSV, MD — max 50MB each</p>
      <input
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        accept=".pdf,.docx,.txt,.csv,.md"
        onChange={e => handle(e.target.files)}
      />
    </label>
  )
}
