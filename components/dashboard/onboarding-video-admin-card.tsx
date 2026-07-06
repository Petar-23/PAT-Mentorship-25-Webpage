'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as tus from 'tus-js-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getOnboardingEmbedUrl, sanitizeOnboardingVideoId } from '@/lib/onboarding-video'
import { CheckCircle as CheckCircle2 } from '@phosphor-icons/react/CheckCircle'
import { CloudArrowUp as UploadCloud } from '@phosphor-icons/react/CloudArrowUp'
import { FloppyDisk as Save } from '@phosphor-icons/react/FloppyDisk'
import { SpinnerGap as Loader2 } from '@phosphor-icons/react/SpinnerGap'
import { Trash as Trash2 } from '@phosphor-icons/react/Trash'

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

type AbortableUpload = {
  abort: () => Promise<void> | void
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
  const saveAbortRef = useRef<AbortController | null>(null)
  const uploadInitAbortRef = useRef<AbortController | null>(null)
  const tusUploadRef = useRef<AbortableUpload | null>(null)

  const embedUrl = useMemo(() => (videoId ? getOnboardingEmbedUrl(videoId) : null), [videoId])

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin-settings/onboarding-video', {
        cache: 'no-store',
        signal,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Laden fehlgeschlagen (${response.status})`)
      }

      const payload = (await response.json()) as OnboardingSettingsResponse
      if (signal?.aborted) return
      setVideoId(payload.videoId)
      setDraftVideoId(payload.videoId ?? '')
      setUpdatedAt(payload.updatedAt)
      setExpiresAt(payload.expiresAt)
    } catch (err: unknown) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadSettings(controller.signal)
    return () => controller.abort()
  }, [loadSettings])

  useEffect(() => {
    return () => {
      saveAbortRef.current?.abort()
      uploadInitAbortRef.current?.abort()

      try {
        void tusUploadRef.current?.abort()
      } catch {
        // Ignore best-effort upload cancellation during unmount.
      }
    }
  }, [])

  const persistVideoId = useCallback(async (nextVideoId: string | null, successMessage: string) => {
    saveAbortRef.current?.abort()
    const controller = new AbortController()
    saveAbortRef.current = controller

    try {
      setIsSaving(true)
      setError(null)
      setStatus(null)

      const response = await fetch('/api/admin-settings/onboarding-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ videoId: nextVideoId }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Speichern fehlgeschlagen (${response.status})`)
      }

      const payload = (await response.json()) as OnboardingSettingsResponse
      if (controller.signal.aborted) return false

      setVideoId(payload.videoId)
      setDraftVideoId(payload.videoId ?? '')
      setUpdatedAt(payload.updatedAt)
      setStatus(successMessage)
      return true
    } catch (err: unknown) {
      if (controller.signal.aborted) return false

      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern')
      return false
    } finally {
      if (saveAbortRef.current === controller) saveAbortRef.current = null
      if (!controller.signal.aborted) setIsSaving(false)
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
    uploadInitAbortRef.current?.abort()

    try {
      void tusUploadRef.current?.abort()
    } catch {
      // Ignore stale upload cancellation before starting the replacement upload.
    }

    const controller = new AbortController()
    uploadInitAbortRef.current = controller
    let currentUpload: AbortableUpload | null = null

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setError(null)
      setStatus(null)

      const initResponse = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
      if (controller.signal.aborted) return

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
          onError: (uploadError) => {
            if (controller.signal.aborted) {
              resolve()
              return
            }
            reject(uploadError)
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            if (controller.signal.aborted) return
            const progress = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0
            setUploadProgress(progress)
          },
          onSuccess: () => resolve(),
        })

        currentUpload = upload
        tusUploadRef.current = upload
        upload.start()
      })

      if (controller.signal.aborted) return

      setUploadProgress(100)
      await persistVideoId(uploadInit.guid, 'Upload abgeschlossen und als Onboarding-Video gesetzt.')
    } catch (err: unknown) {
      if (controller.signal.aborted) return

      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      if (uploadInitAbortRef.current === controller) uploadInitAbortRef.current = null
      if (tusUploadRef.current === currentUpload) tusUploadRef.current = null
      if (!controller.signal.aborted) setIsUploading(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Onboarding-Video Willkommenskachel (M26)</CardTitle>
        <CardDescription>
          Upload setzt das Video automatisch. Die GUID ist optional, falls du ein bestehendes Bunny-Video manuell
          verknüpfen willst. Ablaufdatum: <span className="font-medium text-foreground">{formatDateTime(expiresAt)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Einstellungen werden geladen…
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="space-y-4">
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

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  value={draftVideoId}
                  onChange={(event) => setDraftVideoId(event.target.value)}
                  placeholder="Bunny Video GUID (optional)"
                  disabled={isSaving || isUploading}
                />

                <Button onClick={handleSave} disabled={isSaving || isUploading}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Speichern
                </Button>

                <Button variant="outline" onClick={handleClear} disabled={isSaving || isUploading || !videoId}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Entfernen
                </Button>
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
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aktuelle Vorschau</p>
              {embedUrl ? (
                <div className="max-w-sm overflow-hidden rounded-lg border border-border bg-black aspect-video">
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
                <div className="flex h-[180px] max-w-sm items-center justify-center rounded-lg border border-dashed border-border px-4 text-sm text-muted-foreground">
                  Kein Onboarding-Video gesetzt.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
