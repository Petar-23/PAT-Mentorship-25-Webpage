'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as tus from 'tus-js-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getOnboardingEmbedUrl, sanitizeOnboardingVideoId } from '@/lib/onboarding-video'
import { CheckCircle2, Loader2, Save, Trash2, UploadCloud } from 'lucide-react'

type OnboardingSettingsResponse = {
  videoId: string | null
  updatedAt: string
  expiresAt: string
  embedUrl: string | null
}

type BunnyUploadInit = {
  guid: string
  signature: string
  expire: string
  libraryId: string
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function OnboardingVideoAdminCard() {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [draftVideoId, setDraftVideoId] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const embedUrl = useMemo(() => (videoId ? getOnboardingEmbedUrl(videoId) : null), [videoId])

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin-settings/onboarding-video', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Laden fehlgeschlagen (${response.status})`)
      }

      const payload = (await response.json()) as OnboardingSettingsResponse
      setVideoId(payload.videoId)
      setDraftVideoId(payload.videoId ?? '')
      setUpdatedAt(payload.updatedAt)
      setExpiresAt(payload.expiresAt)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const persistVideoId = useCallback(async (nextVideoId: string | null, successMessage: string) => {
    try {
      setIsSaving(true)
      setError(null)
      setStatus(null)

      const response = await fetch('/api/admin-settings/onboarding-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: nextVideoId }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Speichern fehlgeschlagen (${response.status})`)
      }

      const payload = (await response.json()) as OnboardingSettingsResponse
      setVideoId(payload.videoId)
      setDraftVideoId(payload.videoId ?? '')
      setUpdatedAt(payload.updatedAt)
      setStatus(successMessage)
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  const handleSave = async () => {
    const trimmed = draftVideoId.trim()
    const normalized = trimmed === '' ? null : sanitizeOnboardingVideoId(trimmed)

    if (trimmed !== '' && !normalized) {
      setError('Ungültige Bunny GUID. Erlaubt: Buchstaben, Zahlen, Bindestrich.')
      setStatus(null)
      return
    }

    await persistVideoId(normalized, 'Onboarding-Video gespeichert.')
  }

  const handleClear = async () => {
    await persistVideoId(null, 'Onboarding-Video entfernt.')
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file) return

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setError(null)
      setStatus(null)

      const initResponse = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `M26 Onboarding ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
          description: 'Onboarding-Video für Willkommens-Kachel',
        }),
      })

      if (!initResponse.ok) {
        const payload = await initResponse.json().catch(() => null)
        throw new Error(payload?.error || `Upload-Init fehlgeschlagen (${initResponse.status})`)
      }

      const uploadInit = (await initResponse.json()) as BunnyUploadInit

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: 'https://video.bunnycdn.com/tusupload/',
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: uploadInit.signature,
            AuthorizationExpire: uploadInit.expire,
            LibraryId: uploadInit.libraryId,
            VideoId: uploadInit.guid,
          },
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          onError: (uploadError) => reject(uploadError),
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0
            setUploadProgress(progress)
          },
          onSuccess: () => resolve(),
        })

        upload.start()
      })

      setUploadProgress(100)
      await persistVideoId(uploadInit.guid, 'Upload abgeschlossen und als Onboarding-Video gesetzt.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card className="mt-6 border-orange-500/30 bg-orange-50/40">
      <CardHeader>
        <CardTitle>Onboarding-Video Willkommenskachel (M26)</CardTitle>
        <CardDescription>
          Setze hier das Bunny-Video für die Kachel im Mentorship-Dashboard. Ablaufdatum:{' '}
          <span className="font-medium text-foreground">{formatDateTime(expiresAt)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Einstellungen werden geladen…
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                value={draftVideoId}
                onChange={(event) => setDraftVideoId(event.target.value)}
                placeholder="Bunny Video GUID eingeben"
                disabled={isSaving || isUploading}
              />

              <Button onClick={handleSave} disabled={isSaving || isUploading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Speichern
              </Button>

              <Button
                variant="outline"
                onClick={handleClear}
                disabled={isSaving || isUploading || !videoId}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Entfernen
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                <UploadCloud className="h-4 w-4" />
                Bunny Upload starten
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={isSaving || isUploading}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null
                    void handleFileUpload(selectedFile)
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              {isUploading ? (
                <span className="text-sm text-muted-foreground">Upload läuft: {uploadProgress.toFixed(0)}%</span>
              ) : null}

              <span className="text-xs text-muted-foreground">Letztes Update: {formatDateTime(updatedAt)}</span>
            </div>

            {status ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{status}</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}

            {embedUrl ? (
              <div className="overflow-hidden rounded-lg border border-border bg-black aspect-video">
                <iframe
                  src={embedUrl}
                  title="Onboarding Video Preview"
                  className="h-full w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aktuell ist kein Onboarding-Video gesetzt.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
