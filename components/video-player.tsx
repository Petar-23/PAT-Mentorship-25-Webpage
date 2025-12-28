// components/video-player.tsx

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, FileText, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UploadZone } from './upload-zone'
import { PdfUploadZone } from './pdf-upload-zone'

type Video = {
  id: string
  title: string
  bunnyGuid: string | null
  pdfUrl: string | null
  order: number
}

type Props = {
  activeVideo: Video | null
  activeChapterName: string | null
  onVideoUpdate: (updatedVideo: Video) => void
  onVideoDelete?: (deletedVideoId: string) => void
  activeVideoWatched?: boolean
  onVideoWatchedChange?: (videoId: string, watched: boolean) => void
  isAdmin: boolean
}

type BunnyStatusResponse = {
  status: number
  encodeProgress: number
  transcodingFailed: boolean
}

export function VideoPlayer({
  activeVideo,
  activeChapterName,
  onVideoUpdate,
  onVideoDelete,
  activeVideoWatched = false,
  onVideoWatchedChange,
  isAdmin,
}: Props) {
  const { toast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false)
  const [isEmbedRequested, setIsEmbedRequested] = useState(false)
  const [showPlayerLoader, setShowPlayerLoader] = useState(false)
  const [uploadViewVideoId, setUploadViewVideoId] = useState<string | null>(null)
  const [bunnyStatus, setBunnyStatus] = useState<BunnyStatusResponse | null>(null)
  const [bunnyStatusError, setBunnyStatusError] = useState<string | null>(null)
  const [isSavingWatched, setIsSavingWatched] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const autoMarkedRef = useRef<Set<string>>(new Set())
  const announcementAttemptedRef = useRef<Set<string>>(new Set())

  const iframeSrc =
    activeVideo?.bunnyGuid
      ? `https://iframe.mediadelivery.net/embed/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID}/${activeVideo.bunnyGuid}?autoplay=false`
      : null

  const adminPlaybackReady =
    bunnyStatusError != null ||
    (bunnyStatus != null && bunnyStatus.status === 4 && (bunnyStatus.encodeProgress ?? 0) === 100)

  const playbackReadyForEmbed = Boolean(activeVideo?.bunnyGuid) && (!isAdmin || adminPlaybackReady)

  // UX: Kein extra Klick. Player wird automatisch geladen.
  useEffect(() => {
    setIsEmbedRequested(false)
    if (!playbackReadyForEmbed) return

    const t = window.setTimeout(() => setIsEmbedRequested(true), 0)
    return () => window.clearTimeout(t)
  }, [activeVideo?.id, activeVideo?.bunnyGuid, playbackReadyForEmbed])

  // Loader-Overlay erst nach kurzer Verzögerung zeigen, damit es bei schnellen Loads nicht "flackert".
  useEffect(() => {
    setShowPlayerLoader(false)
    if (!isEmbedRequested) return
    if (isPlayerLoaded) return

    const t = window.setTimeout(() => setShowPlayerLoader(true), 350)
    return () => window.clearTimeout(t)
  }, [isEmbedRequested, isPlayerLoaded, activeVideo?.id, activeVideo?.bunnyGuid])

  const triggerDiscordAnnouncement = useCallback(
    async (videoId: string) => {
      try {
        const res = await fetch('/api/discord/video-announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        })

        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; alreadyAnnounced?: boolean; error?: string | undefined }
          | null

        if (!res.ok) {
          throw new Error(payload?.error || 'Discord Announcement fehlgeschlagen.')
        }

        toast({
          title: 'Discord',
          description: payload?.alreadyAnnounced
            ? 'Dieses Video wurde bereits angekündigt.'
            : 'Announcement wurde gepostet.',
        })
      } catch (e: unknown) {
        console.error('Discord announcement error:', e)
        toast({
          variant: 'destructive',
          title: 'Discord',
          description: e instanceof Error ? e.message : 'Announcement konnte nicht gepostet werden.',
        })
      }
    },
    [toast]
  )

  const requestEndedEvents = () => {
    const win = iframeRef.current?.contentWindow
    if (!win) return

    const message = { method: 'addEventListener', value: 'ended' }
    try {
      win.postMessage(message, 'https://iframe.mediadelivery.net')
      win.postMessage(JSON.stringify(message), 'https://iframe.mediadelivery.net')
    } catch {
      // ignore
    }
  }

  const persistWatched = useCallback(async (videoId: string, watched: boolean, manual: boolean) => {
    try {
      const res = await fetch(`/api/progress/video/${videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched, manual }),
      })
      if (!res.ok) throw new Error()
      onVideoWatchedChange?.(videoId, watched)
      return true
    } catch {
      if (manual) {
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'Fortschritt konnte nicht gespeichert werden.',
        })
      }
      return false
    }
  }, [onVideoWatchedChange, toast])

  useEffect(() => {
    if (isAdmin) return
    if (!activeVideo?.id) return
    if (!activeVideo?.bunnyGuid) return

    const handler = (event: MessageEvent) => {
      if (typeof event.origin === 'string' && !event.origin.includes('mediadelivery.net')) {
        return
      }

      const raw = event.data
      const rawString = typeof raw === 'string' ? raw : null
      const data =
        rawString != null
          ? (() => {
              try {
                return JSON.parse(rawString)
              } catch {
                return null
              }
            })()
          : raw && typeof raw === 'object'
            ? raw
            : null

      const getStringProp = (
        value: unknown,
        key: 'event' | 'type' | 'name' | 'method' | 'action'
      ): string | null => {
        if (!value || typeof value !== 'object') return null
        const record = value as Record<string, unknown>
        const v = record[key]
        return typeof v === 'string' ? v : null
      }

      const eventName =
        data && typeof data === 'object'
          ? getStringProp(data, 'event') ??
            getStringProp(data, 'type') ??
            getStringProp(data, 'name') ??
            getStringProp(data, 'method') ??
            getStringProp(data, 'action')
          : rawString

      if (!eventName || typeof eventName !== 'string') return
      const name = eventName.toLowerCase()

      const isEnded = name === 'ended' || name.includes('ended') || name.includes('finish')
      if (!isEnded) return

      if (activeVideoWatched) return
      if (autoMarkedRef.current.has(activeVideo.id)) return

      autoMarkedRef.current.add(activeVideo.id)
      void persistWatched(activeVideo.id, true, false)
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isAdmin, activeVideo?.id, activeVideo?.bunnyGuid, activeVideoWatched, persistWatched])

  const applyBunnyGuidToActiveVideo = (guid: string) => {
    if (!activeVideo) return
    if (activeVideo.bunnyGuid === guid) return
    onVideoUpdate({ ...activeVideo, bunnyGuid: guid })
  }

  useEffect(() => {
    // Wenn Video wechselt oder ein neuer Bunny-Player geladen wird, Loader zurücksetzen.
    setIsPlayerLoaded(false)
    requestEndedEvents()
  }, [activeVideo?.id, activeVideo?.bunnyGuid])

  useEffect(() => {
    if (!isAdmin) {
      setBunnyStatus(null)
      setBunnyStatusError(null)
      return
    }

    if (!activeVideo?.bunnyGuid || !activeVideo.id) {
      setBunnyStatus(null)
      setBunnyStatusError(null)
      return
    }

    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    setBunnyStatus(null)
    setBunnyStatusError(null)

    const tick = async () => {
      try {
        const res = await fetch(`/api/videos/status/${activeVideo.bunnyGuid}`, {
          method: 'GET',
          cache: 'no-store',
        })

        if (!res.ok) {
          throw new Error(await res.text())
        }

        const data: BunnyStatusResponse = await res.json()
        if (cancelled) return

        setBunnyStatus(data)

        const failed =
          data.transcodingFailed === true || data.status === 5 || data.status === 6
        const finished = data.status === 4 && (data.encodeProgress ?? 0) === 100

        // Falls noch die UploadZone erzwungen ist, aber Processing fertig ist:
        // automatisch auf Player wechseln (ohne Refresh).
        if (finished && uploadViewVideoId === activeVideo.id) {
          if (!announcementAttemptedRef.current.has(activeVideo.id)) {
            announcementAttemptedRef.current.add(activeVideo.id)
            void triggerDiscordAnnouncement(activeVideo.id)
          }
          setUploadViewVideoId(null)
        }

        if (failed && interval) {
          clearInterval(interval)
          interval = null
        }

        if (finished && interval) {
          clearInterval(interval)
          interval = null
        }
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setBunnyStatusError(message)

        if (interval) {
          clearInterval(interval)
          interval = null
        }
      }
    }

    void tick()
    interval = setInterval(tick, 8000)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [isAdmin, activeVideo?.bunnyGuid, activeVideo?.id, triggerDiscordAnnouncement, uploadViewVideoId])

  const startEdit = () => {
    if (!isAdmin) return
    if (activeVideo) {
      setTempTitle(activeVideo.title)
      setIsEditing(true)
    }
  }

  const saveEdit = async () => {
    if (!isAdmin) {
      setIsEditing(false)
      return
    }
    if (!activeVideo || tempTitle.trim() === '' || tempTitle.trim() === activeVideo.title) {
      setIsEditing(false)
      return
    }

    try {
      const res = await fetch(`/api/videos/${activeVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tempTitle.trim() }),
      })

      if (res.ok) {
        const updatedVideo = await res.json()
        onVideoUpdate(updatedVideo)
        toast({
          title: 'Titel gespeichert',
          description: `"${tempTitle.trim()}" ist jetzt der neue Titel.`,
          duration: 3000,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'Titel konnte nicht gespeichert werden.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Netzwerkfehler',
        description: 'Bitte erneut versuchen.',
      })
    }

    setIsEditing(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setTempTitle('')
  }

  // Video löschen
  const handleVideoDelete = async () => {
    if (!isAdmin) return
    if (!activeVideo) return

    const sicher = window.confirm(
      `Willst du das Video "${activeVideo.title}" wirklich für immer löschen?\n\nEs wird aus deiner Liste und von Bunny.net entfernt.`
    )
    if (!sicher) return

    try {
      onVideoDelete?.(activeVideo.id)

      toast({
        title: 'Lösche Video...',
        description: 'Einen Moment bitte.',
      })

      const res = await fetch(`/api/videos/${activeVideo.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: 'Video gelöscht',
          description: `"${activeVideo.title}" wurde erfolgreich entfernt.`,
        })
      } else {
        throw new Error('Fehler beim Löschen')
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Das Video konnte nicht gelöscht werden.',
      })
    }
  }

  // PDF löschen
  const handlePdfDelete = async () => {
    if (!isAdmin) return
    if (!activeVideo || !activeVideo.pdfUrl) return

    const confirmDelete = window.confirm('PDF wirklich entfernen?')
    if (!confirmDelete) return

    try {
      const res = await fetch(`/api/videos/${activeVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: null }),
      })

      if (res.ok) {
        const updated = await res.json()
        onVideoUpdate(updated)
        toast({
          title: 'PDF entfernt',
          description: 'Die PDF wurde erfolgreich entfernt.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'PDF konnte nicht entfernt werden.',
      })
    }
  }

  // Hilfsfunktion: Schönen Dateinamen aus URL extrahieren
  const getPdfFilename = (url: string | null) => {
    if (!url) return 'PDF-Datei.pdf'
    try {
      const path = new URL(url).pathname
      const filename = decodeURIComponent(path.split('/').pop() || 'PDF-Datei.pdf')
      // Entferne videoId-Präfix (z. B. "abc123-10 - Einstiege.pdf" → "10 - Einstiege.pdf")
      return filename.replace(/^[a-z0-9-]+\-/, '')
    } catch {
      return 'PDF-Datei.pdf'
    }
  }

  return (
    <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-12 flex flex-col max-w-7xl">
      {/* Kapitel + Titel */}
      <div className="mb-6 sm:mb-8">
        {activeChapterName && (
          <p className="text-sm text-muted-foreground mb-2">{activeChapterName}</p>
        )}

        <div className="w-full">
          {isAdmin && isEditing ? (
            <div className="flex items-center space-x-4 w-full">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="text-2xl sm:text-3xl font-bold bg-transparent border-b-2 border-primary focus:outline-none w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={saveEdit}
              />
              <Button size="icon" variant="outline" onClick={saveEdit}>
                <Check className="h-5 w-5 text-green-500" />
              </Button>
            </div>
          ) : (
            <div
              className={`w-full border-2 border-transparent rounded-lg px-4 py-3 -mx-4 -my-3 ${
                isAdmin && activeVideo
                  ? 'cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all'
                  : ''
              }`}
              onClick={isAdmin && activeVideo ? startEdit : undefined}
            >
              <h2 className="text-2xl sm:text-3xl font-bold">
                {activeVideo ? activeVideo.title : 'Wähle ein Video aus'}
              </h2>
            </div>
          )}
        </div>

      </div>

      {/* Player oder UploadZone */}
      <div className="flex-1 flex flex-col">
        <div className="aspect-video bg-black/90 rounded-2xl overflow-hidden relative">
          {isAdmin && activeVideo && (uploadViewVideoId === activeVideo.id || !activeVideo.bunnyGuid) ? (
            <UploadZone
              videoId={activeVideo.id}
              onUploadStart={() => setUploadViewVideoId(activeVideo.id)}
              onBunnyGuidReady={(guid) => {
                applyBunnyGuidToActiveVideo(guid)
              }}
              onUploadSuccess={(guid) => {
                applyBunnyGuidToActiveVideo(guid)
                setUploadViewVideoId(null)
                setIsPlayerLoaded(false)
              }}
            />
          ) : activeVideo?.bunnyGuid ? (
            isAdmin ? (
              bunnyStatusError != null ? (
                isEmbedRequested && iframeSrc ? (
                  <>
                    <iframe
                      src={iframeSrc}
                      className={[
                        'w-full h-full absolute inset-0 transition-opacity duration-300',
                        isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                      allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
                      allowFullScreen
                      loading="lazy"
                      onLoad={() => setIsPlayerLoaded(true)}
                    />
                    {showPlayerLoader && !isPlayerLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                        <div className="text-center text-white">
                          <div className="relative inline-block">
                            <div className="w-16 h-16 rounded-full border-4 border-gray-600"></div>
                            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
                          </div>
                          <p className="mt-4 text-lg">Video wird geladen...</p>
                          <p className="mt-2 text-xs text-white/70 px-6">
                            Status konnte nicht geladen werden. Ich zeige stattdessen den Player an.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : null
              ) : bunnyStatus == null ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-muted-foreground">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 rounded-full border-4 border-gray-300"></div>
                      <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    </div>
                    <p className="mt-4 text-lg font-medium text-foreground">Status wird geladen...</p>
                  </div>
                </div>
              ) : (() => {
                const failed =
                  bunnyStatus.transcodingFailed === true ||
                  bunnyStatus.status === 5 ||
                  bunnyStatus.status === 6
                const finished =
                  bunnyStatus.status === 4 && (bunnyStatus.encodeProgress ?? 0) === 100

                if (failed) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                      <p className="text-sm text-center px-6 text-destructive">
                        Bunny konnte das Video nicht verarbeiten.
                      </p>
                    </div>
                  )
                }

                if (!finished) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-muted-foreground">
                      <div className="text-center">
                        <div className="relative inline-block">
                          <div className="w-16 h-16 rounded-full border-4 border-gray-300"></div>
                          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                        </div>
                        <p className="mt-6 text-lg font-medium text-foreground">Processing</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Transcoding: {bunnyStatus.encodeProgress ?? 0}%
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <>
                    {isEmbedRequested && iframeSrc ? (
                      <>
                        <iframe
                          src={iframeSrc}
                          className={[
                            'w-full h-full absolute inset-0 transition-opacity duration-300',
                            isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                          ].join(' ')}
                          allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
                          allowFullScreen
                          loading="lazy"
                          onLoad={() => setIsPlayerLoaded(true)}
                        />
                        {showPlayerLoader && !isPlayerLoaded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="text-center text-white">
                              <div className="relative inline-block">
                                <div className="w-16 h-16 rounded-full border-4 border-gray-600"></div>
                                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
                              </div>
                              <p className="mt-4 text-lg">Video wird geladen...</p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </>
                )
              })()
            ) : (
              isEmbedRequested && iframeSrc ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={iframeSrc}
                    className={[
                      'w-full h-full absolute inset-0 transition-opacity duration-300',
                      isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                    allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
                    allowFullScreen
                    loading="lazy"
                    onLoad={() => {
                      setIsPlayerLoaded(true)
                      requestEndedEvents()
                    }}
                  />
                  {showPlayerLoader && !isPlayerLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="text-center text-white">
                        <div className="relative inline-block">
                          <div className="w-16 h-16 rounded-full border-4 border-gray-600"></div>
                          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
                        </div>
                        <p className="mt-4 text-lg">Video wird geladen...</p>
                      </div>
                    </div>
                  )}
                </>
              ) : null
            )
          ) : (
            <>
              {(
                <div className="w-full h-full flex items-center justify-center bg-black/70 text-white">
                  <p className="text-sm text-center px-6">
                    {activeVideo
                      ? 'Dieses Video ist noch nicht verfügbar.'
                      : 'Bitte wähle ein Video aus.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

                {/* File attachments und Delete video in einer Zeile */}
                <div className="mt-8 sm:mt-10 lg:mt-12">
          <p className="text-sm font-medium text-foreground mb-3">PDF Anhänge:</p>

          <div className="flex items-center justify-between flex-wrap gap-4 sm:gap-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Upload Button */}
              {isAdmin && activeVideo && (
                <PdfUploadZone
                  videoId={activeVideo.id}
                  onUploadSuccess={(pdfUrl) => onVideoUpdate({ ...activeVideo, pdfUrl })}
                />
              )}

              {/* Vorhandene PDF als Chip */}
              {activeVideo?.pdfUrl && (
                <div className="flex items-center gap-2 bg-secondary/60 rounded-full px-4 py-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <a
                    href={activeVideo.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {getPdfFilename(activeVideo.pdfUrl)}
                  </a>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                      onClick={handlePdfDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Rechts: Admin = Delete Video, User = "Als angesehen markieren" */}
            {isAdmin && activeVideo ? (
              <Button variant="destructive" onClick={handleVideoDelete} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete video
              </Button>
            ) : !isAdmin && activeVideo ? (
              <Button
                variant={activeVideoWatched ? 'outline' : 'default'}
                onClick={async () => {
                  if (!activeVideo) return
                  if (isSavingWatched) return
                  setIsSavingWatched(true)
                  const nextWatched = !activeVideoWatched
                  const ok = await persistWatched(activeVideo.id, nextWatched, true)
                  setIsSavingWatched(false)
                  if (ok) {
                    toast({
                      title: nextWatched ? 'Als angesehen markiert' : 'Markierung entfernt',
                      description: nextWatched
                        ? 'Dein Fortschritt wurde aktualisiert.'
                        : 'Dieses Video zählt jetzt nicht mehr als abgeschlossen.',
                      duration: 2500,
                    })
                  }
                }}
                disabled={isSavingWatched}
                className="w-full sm:w-auto"
              >
                <Check className="mr-2 h-4 w-4" />
                {activeVideoWatched
                  ? 'Als nicht angesehen markieren'
                  : 'Als angesehen markieren'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}