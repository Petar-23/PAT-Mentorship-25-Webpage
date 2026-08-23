'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload } from '@phosphor-icons/react/Upload'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { VideoAttachment } from '@/lib/video-attachments'

type Props = {
  videoId: string
  onUploadSuccess: (attachment: VideoAttachment) => void
}

export function AttachmentUploadZone({ videoId, onUploadSuccess }: Props) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => uploadAbortRef.current?.abort()
  }, [])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.md')) {
      toast({
        variant: 'destructive',
        title: 'Falsches Format',
        description: 'Bitte eine Markdown-Datei mit der Endung .md auswählen.',
      })
      input.value = ''
      return
    }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Datei zu groß oder leer',
        description: 'Die Markdown-Datei darf maximal 2 MB groß sein.',
      })
      input.value = ''
      return
    }

    setIsUploading(true)
    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    uploadAbortRef.current = controller

    const formData = new FormData()
    formData.append('attachment', file)
    formData.append('videoId', videoId)

    try {
      const response = await fetch('/api/upload/attachment', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok || !data.attachment) {
        throw new Error(data.error || 'Upload fehlgeschlagen')
      }

      onUploadSuccess(data.attachment as VideoAttachment)
      toast({
        title: 'Regelwerk hochgeladen ✓',
        description: `${file.name} ist jetzt als geschützter Anhang verfügbar.`,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      toast({
        variant: 'destructive',
        title: 'Upload fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Bitte versuche es später erneut.',
      })
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null
      if (!controller.signal.aborted) {
        setIsUploading(false)
        input.value = ''
      }
    }
  }

  return (
    <Button variant="secondary" disabled={isUploading} asChild>
      <label className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-5 py-3">
        <Upload className="mr-2 h-4 w-4" />
        {isUploading ? 'Lade hoch...' : 'Markdown hochladen'}
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          onChange={handleUpload}
          className="hidden"
          disabled={isUploading}
        />
      </label>
    </Button>
  )
}
