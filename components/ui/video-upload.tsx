'use client'
import { useEffect, useRef, useState } from 'react'
import * as tus from 'tus-js-client'

type UploadResponse = {
  guid: string
  signature: string
  expire: string
  libraryId: string
}

export function VideoUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const uploadAbortRef = useRef<AbortController | null>(null)
  const tusUploadRef = useRef<tus.Upload | null>(null)

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
      try {
        void tusUploadRef.current?.abort()
      } catch {
        // Best-effort cancellation while leaving the page.
      }
    }
  }, [])

  const startUpload = async (file: File) => {
    uploadAbortRef.current?.abort()
    try {
      void tusUploadRef.current?.abort()
    } catch {
      // Ignore stale upload cancellation before replacing it.
    }

    const controller = new AbortController()
    uploadAbortRef.current = controller
    let startedTusUpload = false

    setUploading(true)
    setError('')
    setProgress(0)
    setFileName(file.name)

    try {
      // API für Sig
      const res = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ title: file.name.split('.')[0] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: UploadResponse = await res.json()
      if (controller.signal.aborted) return

      // TUS Upload
      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload/',
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          AuthorizationSignature: data.signature,
          AuthorizationExpire: data.expire,
          LibraryId: data.libraryId,
          VideoId: data.guid,
        },
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onError: (err) => {
          if (controller.signal.aborted) return
          setError(err.message)
          setUploading(false)
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null
          if (tusUploadRef.current === upload) tusUploadRef.current = null
        },
        onProgress: (bytes, total) => {
          if (controller.signal.aborted) return
          setProgress((bytes / total) * 100)
        },
        onSuccess: () => {
          if (controller.signal.aborted) return
          setUploading(false)
          onSuccess?.()
          alert('Upload komplett!')
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null
          if (tusUploadRef.current === upload) tusUploadRef.current = null
        },
      })

      tusUploadRef.current = upload
      upload.start()
      startedTusUpload = true
    } catch (err: unknown) {
      if (controller.signal.aborted) return

      setError(String(err))
      setUploading(false)
    } finally {
      if ((controller.signal.aborted || !startedTusUpload) && uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
      }
      if (!startedTusUpload) tusUploadRef.current = null
    }
  }

  const handleFiles = (files: FileList) => {
    const file = files[0]
    if (file) void startUpload(file)
  }

  return (
    <div className="border-2 border-dashed p-8 rounded-lg text-center cursor-pointer hover:border-blue-400 group">
      <input
        type="file"
        accept="video/*"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />
      <div className="group-hover:text-blue-500">
        <p>📹 Video drag & drop oder klick</p>
        <p className="text-sm text-gray-500">MP4, MOV (Bunny Limits: 100GB+)</p>
      </div>
      {uploading && (
        <div className="mt-4">
          <p>{fileName}</p>
          <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
            <div 
              className="bg-blue-500 h-4 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm">{progress.toFixed(0)}%</p>
        </div>
      )}
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
    </div>
  )
}
