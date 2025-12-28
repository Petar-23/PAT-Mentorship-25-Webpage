// components/pdf-upload-zone.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Props = {
  videoId: string
  onUploadSuccess: (pdfUrl: string) => void
}

export function PdfUploadZone({ videoId, onUploadSuccess }: Props) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('videoId', videoId)

    try {
      const res = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

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
      toast({
        variant: 'destructive',
        title: 'Upload fehlgeschlagen',
        description: 'Bitte versuche es später erneut.',
      })
    } finally {
      setIsUploading(false)
      // Input zurücksetzen, damit derselbe Dateiname erneut hochgeladen werden kann
      e.target.value = ''
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