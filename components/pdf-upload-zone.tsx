'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from '@phosphor-icons/react/Upload'
import { useToast } from '@/hooks/use-toast'
import { uploadLessonPdf } from '@/lib/pdf-upload-client'

type Props = {
  videoId: string
  currentPdfUrl?: string | null
  onUploadSuccess: (pdfUrl: string) => void
}

export function PdfUploadZone({ videoId, currentPdfUrl = null, onUploadSuccess }: Props) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<'idle' | 'preparing' | 'uploading' | 'saving'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const busy = stage !== 'idle'

  useEffect(() => () => { uploadAbortRef.current?.abort() }, [videoId])

  async function startUpload(selectedFile: File) {
    if (uploadAbortRef.current) return
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setFile(selectedFile)
    setError(null)
    setProgress(0)
    setStage('preparing')
    try {
      const pdfUrl = await uploadLessonPdf(selectedFile, {
        videoId, expectedPdfUrl: currentPdfUrl, signal: controller.signal,
        onProgress: setProgress, onStage: setStage,
      })
      if (controller.signal.aborted) return
      onUploadSuccess(pdfUrl)
      setFile(null)
      toast({ title: 'PDF gespeichert', description: `${selectedFile.name} ist der Lektion zugeordnet.` })
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : 'Der Upload ist fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null
      if (!controller.signal.aborted) setStage('idle')
    }
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setStage('idle')
    setError('Upload abgebrochen. Die bisherigen Unterlagen bleiben erhalten.')
  }

  return (
    <div className="m-pdf-upload" aria-busy={busy}>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" tabIndex={-1}
        disabled={busy} aria-label="PDF-Datei auswählen"
        onChange={event => {
          const selectedFile = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selectedFile) void startUpload(selectedFile)
        }} />
      <div className="m-pdf-controls">
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
          {currentPdfUrl ? 'PDF ersetzen' : 'PDF hinzufügen'}
        </Button>
        {busy && stage !== 'saving' ? (
          <Button type="button" variant="ghost" onClick={cancelUpload}>Abbrechen</Button>
        ) : error && file ? (
          <Button type="button" variant="ghost" onClick={() => void startUpload(file)}>Erneut versuchen</Button>
        ) : null}
      </div>
      {file ? <p className="m-pdf-filename">{file.name} <span>· {(file.size / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB</span></p> : null}
      {busy ? (
        <div className="m-pdf-progress" role="status" aria-live="polite">
          <span>{stage === 'preparing' ? 'Datei wird geprüft …' : stage === 'saving' ? 'Wird der Lektion zugeordnet …' : `Wird hochgeladen · ${progress} %`}</span>
          <progress max={100} value={stage === 'preparing' ? undefined : progress} aria-label="PDF-Upload" />
        </div>
      ) : null}
      {error ? <p className="m-pdf-error" role="alert">{error}</p> : <p className="m-pdf-hint">PDF bis 25 MB · für berechtigte Mitglieder</p>}
    </div>
  )
}
