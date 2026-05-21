// components/pdf-upload-zone.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from '@phosphor-icons/react/Upload'
import { useToast } from '@/hooks/use-toast'

type Props = {
  videoId: string
  onUploadSuccess: (pdfUrl: string) => void
}

export function PdfUploadZone({ videoId, onUploadSuccess }: Props) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = e.target.files?.[0]
    if (!file) return

    // Nur PDFs erlauben
    if (file.type !== 'application/pdf') {
      toast({
        variant: 'destructive',
        title: 'Falsches Format',
        description: 'Bitte nur PDF-Dateien hochladen.',
      })
      return
    }

    // Optional: Größenlimit 25 MB
    if (file.size > 25 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Datei zu groß',
        description: 'Maximale Größe: 25 MB',
      })
      return
    }

    setIsUploading(true)
    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    uploadAbortRef.current = controller

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('videoId', videoId)

    try {
      const res = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      const data = await res.json()
      if (controller.signal.aborted) return

      if (res.ok) {
        onUploadSuccess(data.pdfUrl)
        toast({
          title: 'PDF hochgeladen ✓',
          description: `${file.name} ist jetzt verfügbar.`,
        })
      } else {
        throw new Error(data.error || 'Upload fehlgeschlagen')
      }
    } catch  {
      if (controller.signal.aborted) return
      toast({
        variant: 'destructive',
        title: 'Upload fehlgeschlagen',
        description: 'Bitte versuche es später erneut.',
      })
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
      }
      if (!controller.signal.aborted) {
        setIsUploading(false)
        // Input zurücksetzen, damit derselbe Dateiname erneut hochgeladen werden kann
        input.value = ''
      }
    }
  }

  return (
    <Button variant="secondary" disabled={isUploading} asChild>
      <label className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-8">
        <Upload className="mr-2 h-4 w-4" />
        {isUploading ? 'Lade hoch...' : 'PDF hochladen'}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          className="hidden"
          disabled={isUploading}
        />
      </label>
    </Button>
  )
}
