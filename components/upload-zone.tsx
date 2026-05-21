'use client'

import { useEffect, useRef, useState } from 'react'
import * as tus from 'tus-js-client'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { FilmStrip as Film } from '@phosphor-icons/react/FilmStrip'
import { Upload } from '@phosphor-icons/react/Upload'
import { WarningCircle as AlertCircle } from '@phosphor-icons/react/WarningCircle'

type Props = {
  videoId: string
  onUploadSuccess: (bunnyGuid: string) => void
  onUploadStart?: () => void
  onBunnyGuidReady?: (bunnyGuid: string) => void
}

type UploadResponse = {
  guid: string
  signature: string
  expire: string
  libraryId: string
}

type StatusResponse = {
  status: number
  encodeProgress: number
  transcodingFailed: boolean
}

type AbortableTusUpload = {
  abort: () => Promise<void>
}

export function UploadZone({ videoId, onUploadSuccess, onUploadStart, onBunnyGuidReady }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'processing' | 'done' | 'error'
  >('idle')
  const [progress, setProgress] = useState(0)
  const [currentGuid, setCurrentGuid] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const uploadAbortRef = useRef<AbortController | null>(null)
  const tusUploadRef = useRef<AbortableTusUpload | null>(null)

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()

      try {
        void tusUploadRef.current?.abort()
      } catch {
        // Ignore best-effort upload cancellation during unmount.
      }
    }
  }, [])

  // Polling (serverseitig) bis Bunny fertig transcodiert hat
  useEffect(() => {
    if (status !== 'processing' || !currentGuid) return

    let cancelled = false
    let controller: AbortController | null = null

    const tick = async () => {
      if (document.visibilityState === 'hidden') return

      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch(`/api/videos/status/${currentGuid}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(await res.text())
        }

        const data: StatusResponse = await res.json()

        if (cancelled) return

        setProgress(data.encodeProgress ?? 0)

        const bunnyStatus = data.status
        const failed = data.transcodingFailed === true || bunnyStatus === 5 || bunnyStatus === 6
        const finished = bunnyStatus === 4 && (data.encodeProgress ?? 0) === 100

        if (failed) {
          setErrorMessage('Bunny konnte das Video nicht verarbeiten.')
          setStatus('error')
          return
        }

        if (finished) {
          setStatus('done')
          onUploadSuccess(currentGuid)
        }
      } catch (err: unknown) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    }

    tick()
    const interval = setInterval(tick, 8000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      controller?.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [status, currentGuid, onUploadSuccess])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    if (!videoId) {
      setErrorMessage('Kein Video ausgewählt.')
      setStatus('error')
      return
    }

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Bitte wähle eine Video-Datei aus.')
      setStatus('error')
      return
    }

    uploadAbortRef.current?.abort()

    try {
      void tusUploadRef.current?.abort()
    } catch {
      // Ignore stale upload cancellation before replacing it.
    }

    const controller = new AbortController()
    uploadAbortRef.current = controller
    let startedTusUpload = false

    setStatus('uploading')
    setProgress(0)
    setErrorMessage('')
    onUploadStart?.()

    try {
      // 1) Signatur serverseitig holen (Admin-only)
      const res = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ''),
          description: '',
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      const data: UploadResponse = await res.json()
      if (controller.signal.aborted) return

      setCurrentGuid(data.guid)

      // 2) GUID in DB speichern (damit es nach Reload passt)
      const patchRes = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ bunnyGuid: data.guid }),
      })
      if (!patchRes.ok) throw new Error('Konnte Video nicht in der DB verknüpfen.')
      if (controller.signal.aborted) return

      onBunnyGuidReady?.(data.guid)

      // 3) Upload per TUS
      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          AuthorizationSignature: String(data.signature),
          AuthorizationExpire: String(data.expire),
          LibraryId: String(data.libraryId),
          VideoId: String(data.guid),
        },
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onError: (err) => {
          if (controller.signal.aborted) return
          console.error('Upload error:', err)
          setErrorMessage(err.message)
          setStatus('error')
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null
          if (tusUploadRef.current === upload) tusUploadRef.current = null
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (controller.signal.aborted) return
          const percent = Math.round((bytesUploaded / bytesTotal) * 100)
          setProgress(percent)
        },
        onSuccess: () => {
          if (controller.signal.aborted) return
          // Upload fertig -> jetzt transcoding progress anzeigen (Polling)
          setStatus('processing')
          setProgress(0)
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null
          if (tusUploadRef.current === upload) tusUploadRef.current = null
        },
      })

      tusUploadRef.current = upload
      upload.start()
      startedTusUpload = true
    } catch (err: unknown) {
      if (controller.signal.aborted) return

      console.error('Upload error:', err)
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
    } finally {
      if ((controller.signal.aborted || !startedTusUpload) && uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
      }
      if (!startedTusUpload) tusUploadRef.current = null
    }
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-6 px-8 py-12 text-muted-foreground transition-all rounded-2xl ${
        isDragging ? 'bg-gray-300 border-4 border-dashed border-primary' : 'bg-gray-200'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {status === 'idle' && (
        <>
          <Film className="w-16 h-16" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">Upload a video</p>
            <p className="text-sm">Please use .mp4, .mov, .mpeg, or .webm.</p>
          </div>
          <Button variant="outline" size="lg" asChild>
            <label className="cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              Upload file
              <input type="file" accept="video/*" className="hidden" onChange={handleChange} />
            </label>
          </Button>
        </>
      )}

      {status === 'uploading' && (
        <div className="w-80 text-center">
          <Progress value={progress} className="h-3 mb-4" />
          <p className="text-muted-foreground">Hochladen: {progress}%</p>
        </div>
      )}

      {status === 'processing' && (
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full border-4 border-gray-300"></div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-6 text-lg font-medium">Processing</p>
          <p className="text-sm text-muted-foreground mt-1">Transcoding: {progress}%</p>
        </div>
      )}

      {status === 'done' && (
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-500" />
          <p className="mt-6 text-xl font-semibold">Video ist bereit!</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <AlertCircle className="w-20 h-20 text-destructive mx-auto" />
          <p className="mt-6 text-xl font-semibold text-destructive">Upload oder Processing fehlgeschlagen</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {errorMessage || 'Bitte überprüfe das Format und versuche es später erneut.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => setStatus('idle')}>
            Erneut versuchen
          </Button>
        </div>
      )}
    </div>
  )
}
