// components/video-player.tsx

'use client'

import { ArrowLeft, ArrowRight, Check, FastForward, FileText, Pause, Play, Rewind, Trash as Trash2 } from '@/components/mentorship/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const LessonShowNotes = dynamic(() => import('./mentorship/lesson-show-notes').then((mod) => mod.LessonShowNotes))

const UploadZone = dynamic(() => import('./upload-zone').then((mod) => mod.UploadZone), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm text-muted-foreground">
      Upload wird geladen...
    </div>
  ),
})

const PdfUploadZone = dynamic(() => import('./pdf-upload-zone').then((mod) => mod.PdfUploadZone), {
  ssr: false,
  loading: () => (
    <Button variant="secondary" disabled>
      PDF-Upload wird geladen...
    </Button>
  ),
})

type Video = {
  id: string
  title: string
  bunnyGuid: string | null
  thumbnailUrl: string | null
  pdfUrl: string | null
  showNotes?: string | null
  duration?: number | null
  order: number
  updatedAt?: string | Date
}

type Props = {
  activeVideo: Video | null
  activeChapterName: string | null
  onVideoUpdate: (updatedVideo: Video) => void
  onShowNotesUpdate: (videoId: string, showNotes: string | null) => void
  onVideoDelete?: (deletedVideoId: string) => void
  activeVideoWatched?: boolean
  onVideoWatchedChange?: (videoId: string, watched: boolean) => void
  isAdmin: boolean
  onBack?: () => void
  onNextVideo?: () => void
  nextVideoDisabled?: boolean
  autoPlay?: boolean
}

type BunnyStatusResponse = {
  status: number
  encodeProgress: number
  transcodingFailed: boolean
}

type BunnyPlayerApi = {
  on: (event: string, callback: (data?: unknown) => void) => void
  off: (event: string, callback?: (data?: unknown) => void) => void
  play: () => void
  pause: () => void
  getPaused: (callback: (paused: boolean) => void) => void
  getCurrentTime: (callback: (seconds: number) => void) => void
  setCurrentTime: (seconds: number) => void
}

type BunnyPlayerJs = {
  Player: new (target: HTMLIFrameElement | string) => BunnyPlayerApi
}

declare global {
  interface Window {
    playerjs?: BunnyPlayerJs
  }
}

export function VideoPlayer({
  activeVideo,
  activeChapterName,
  onVideoUpdate,
  onShowNotesUpdate,
  onVideoDelete,
  activeVideoWatched = false,
  onVideoWatchedChange,
  isAdmin,
  onBack,
  onNextVideo,
  nextVideoDisabled = false,
  autoPlay = false,
}: Props) {
  const { toast } = useToast()
  const VideoHeading = onBack ? 'h1' : 'h2'
  const isDocumentLesson = !isAdmin && !activeVideo?.bunnyGuid?.trim() && Boolean(activeVideo?.pdfUrl?.trim())

  const [isEditing, setIsEditing] = useState(false)
  const [presentPlayer, setPresentPlayer] = useState(true)
  const [tempTitle, setTempTitle] = useState('')
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false)
  const [isEmbedRequested, setIsEmbedRequested] = useState(false)
  const [showPlayerLoader, setShowPlayerLoader] = useState(false)
  const [uploadViewVideoId, setUploadViewVideoId] = useState<string | null>(null)
  const [bunnyStatus, setBunnyStatus] = useState<BunnyStatusResponse | null>(null)
  const [bunnyStatusError, setBunnyStatusError] = useState<string | null>(null)
  const [isSavingWatched, setIsSavingWatched] = useState(false)
  const [isPlayerJsLoaded, setIsPlayerJsLoaded] = useState(false)
  const [isPlayerApiReady, setIsPlayerApiReady] = useState(false)
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(true)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playerApiRef = useRef<BunnyPlayerApi | null>(null)
  const autoMarkedRef = useRef<Set<string>>(new Set())
  const announcementAttemptedRef = useRef<Set<string>>(new Set())

  const iframeSrc =
    activeVideo?.bunnyGuid
      ? `https://iframe.mediadelivery.net/embed/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID}/${activeVideo.bunnyGuid}?autoplay=${
          autoPlay ? 'true' : 'false'
        }`
      : null

  const adminPlaybackReady =
    bunnyStatusError != null ||
    (bunnyStatus != null && bunnyStatus.status === 4 && (bunnyStatus.encodeProgress ?? 0) === 100)

  const playbackReadyForEmbed = Boolean(activeVideo?.bunnyGuid) && (!isAdmin || adminPlaybackReady)
  const shouldLoadPlayerJs = !isAdmin && Boolean(activeVideo?.bunnyGuid)

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

  useEffect(() => {
    if (window.playerjs?.Player) {
      setIsPlayerJsLoaded(true)
    }
  }, [])

  const triggerDiscordAnnouncement = useCallback(
    async (videoId: string) => {
      try {
        const res = await fetch('/api/discord/video-announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        })

        const payload = (await res.json().catch(() => null)) as
          | {
              ok?: boolean
              alreadyAnnounced?: boolean
              error?: string | undefined
              mentionEveryone?: boolean
            }
          | null

        if (!res.ok) {
          throw new Error(payload?.error || 'Discord Announcement fehlgeschlagen.')
        }

        toast({
          title: 'Discord',
          description: payload?.alreadyAnnounced
            ? 'Dieses Video wurde bereits angekündigt.'
            : payload?.mentionEveryone === false
              ? 'Announcement wurde gepostet, aber Discord hat @everyone nicht als Ping akzeptiert.'
              : 'Announcement wurde gepostet und @everyone wurde ausgelöst.',
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

  useEffect(() => {
    playerApiRef.current = null
    setIsPlayerApiReady(false)
    setIsPlaybackPaused(true)

    if (isAdmin) return
    if (!isPlayerJsLoaded) return
    if (!isPlayerLoaded) return
    if (!activeVideo?.bunnyGuid) return
    if (!iframeRef.current) return

    const Player = window.playerjs?.Player
    if (!Player) return

    const player = new Player(iframeRef.current)
    playerApiRef.current = player

    const syncPaused = () => {
      try {
        player.getPaused((paused) => setIsPlaybackPaused(Boolean(paused)))
      } catch {
        // Player.js can throw while the iframe is still finishing its handshake.
      }
    }

    const handleReady = () => {
      setIsPlayerApiReady(true)
      syncPaused()
    }

    const handlePlay = () => setIsPlaybackPaused(false)
    const handlePause = () => setIsPlaybackPaused(true)
    const handleEnded = () => setIsPlaybackPaused(true)

    try {
      player.on('ready', handleReady)
      player.on('play', handlePlay)
      player.on('pause', handlePause)
      player.on('ended', handleEnded)
      syncPaused()
    } catch {
      playerApiRef.current = null
      return
    }

    return () => {
      try {
        player.off('ready', handleReady)
        player.off('play', handlePlay)
        player.off('pause', handlePause)
        player.off('ended', handleEnded)
      } catch {
        // ignore cleanup errors from a torn-down iframe
      }
      if (playerApiRef.current === player) {
        playerApiRef.current = null
      }
      setIsPlayerApiReady(false)
    }
  }, [activeVideo?.bunnyGuid, activeVideo?.id, isAdmin, isPlayerJsLoaded, isPlayerLoaded])

  const seekActiveVideoBy = useCallback(
    (secondsDelta: number) => {
      const player = playerApiRef.current
      if (!player || !isPlayerApiReady) return

      try {
        player.getCurrentTime((seconds) => {
          const currentSeconds = Number.isFinite(seconds) ? seconds : 0
          player.setCurrentTime(Math.max(0, currentSeconds + secondsDelta))
        })
      } catch {
        // Native Bunny controls remain available if the API handshake is interrupted.
      }
    },
    [isPlayerApiReady]
  )

  const togglePlayerPlayback = useCallback(() => {
    const player = playerApiRef.current
    if (!player || !isPlayerApiReady) return

    try {
      player.getPaused((paused) => {
        if (paused) {
          player.play()
          setIsPlaybackPaused(false)
        } else {
          player.pause()
          setIsPlaybackPaused(true)
        }
      })
    } catch {
      // Native Bunny controls remain available if the API handshake is interrupted.
    }
  }, [isPlayerApiReady])

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
    let controller: AbortController | null = null

    setBunnyStatus(null)
    setBunnyStatusError(null)

    const tick = async () => {
      if (document.visibilityState === 'hidden') return

      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch(`/api/videos/status/${activeVideo.bunnyGuid}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
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
        if (err instanceof DOMException && err.name === 'AbortError') return
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
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      controller?.abort()
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
    <>
      {shouldLoadPlayerJs ? (
        <Script
          src="https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js"
          strategy="afterInteractive"
          onLoad={() => setIsPlayerJsLoaded(true)}
          onReady={() => setIsPlayerJsLoaded(true)}
        />
      ) : null}

      <div className="m-video-player flex flex-col" data-present={!isAdmin && presentPlayer} onFocusCapture={() => setPresentPlayer(false)}>
      {/* Header (wie Middle-Sidebar): Back + Chapter + Video Titel */}
      <div className="m-video-heading flex items-start gap-3">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="m-icon-button"
            onClick={onBack}
            aria-label="Zurück zur Inhaltsübersicht"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}

        <div className="min-w-0 flex-1">
          {activeChapterName ? (
            <p className="text-xs text-muted-foreground truncate">{activeChapterName}</p>
          ) : null}

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
                className={[
                  'w-full rounded-lg',
                  isAdmin && activeVideo ? 'cursor-pointer hover:bg-gray-50 transition-all' : '',
                ].join(' ')}
                onClick={isAdmin && activeVideo ? startEdit : undefined}
              >
                <VideoHeading>
                  {activeVideo ? activeVideo.title : 'Wähle eine Lektion aus'}
                </VideoHeading>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player oder UploadZone */}
      <div className="flex-1 flex flex-col">
        <div className={`m-video-stage ${!isAdmin && !activeVideo?.bunnyGuid?.trim() ? 'm-document-lesson' : 'aspect-video bg-black/90 rounded-2xl overflow-hidden relative'}`}>
          {isDocumentLesson && activeVideo?.pdfUrl ? (
            <>
              <FileText aria-hidden="true" />
              <h2>Unterlagen zur Lektion</h2>
              <p>Diese Lektion besteht aus Unterlagen. Öffne die PDF und markiere die Lektion danach als abgeschlossen.</p>
              <Button asChild variant="outline" className="mt-6">
                <a href={activeVideo.pdfUrl} target="_blank" rel="noopener noreferrer">PDF öffnen<span className="sr-only"> (neuer Tab)</span></a>
              </Button>
            </>
          ) : isAdmin && activeVideo && (uploadViewVideoId === activeVideo.id || !activeVideo.bunnyGuid) ? (
            <UploadZone
              videoId={activeVideo.id}
              onUploadStart={() => setUploadViewVideoId(activeVideo.id)}
              onBunnyGuidReady={(guid) => {
                applyBunnyGuidToActiveVideo(guid)
              }}
              onUploadSuccess={(guid) => {
                applyBunnyGuidToActiveVideo(guid)
                // Sobald Bunny fertig ist (UploadZone ruft onUploadSuccess erst nach Processing),
                // posten wir automatisch das Discord Announcement (idempotent via API + local ref).
                if (!announcementAttemptedRef.current.has(activeVideo.id)) {
                  announcementAttemptedRef.current.add(activeVideo.id)
                  void triggerDiscordAnnouncement(activeVideo.id)
                }
                setUploadViewVideoId(null)
                setIsPlayerLoaded(false)
              }}
            />
          ) : activeVideo?.bunnyGuid?.trim() ? (
            isAdmin ? (
              bunnyStatusError != null ? (
                isEmbedRequested && iframeSrc ? (
                  <>
                    <iframe
                          title={activeVideo?.title ?? 'Lektionsvideo'}
                      src={iframeSrc}
                      className={[
                        'w-full h-full absolute inset-0 transition-opacity duration-300',
                        isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
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
                          title={activeVideo?.title ?? 'Lektionsvideo'}
                          src={iframeSrc}
                          className={[
                            'w-full h-full absolute inset-0 transition-opacity duration-300',
                            isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                          ].join(' ')}
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
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
                          title={activeVideo?.title ?? 'Lektionsvideo'}
                    ref={iframeRef}
                    src={iframeSrc}
                    className={[
                      'w-full h-full absolute inset-0 transition-opacity duration-300',
                      isPlayerLoaded ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
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
            <div className={isAdmin ? 'w-full h-full flex items-center justify-center bg-black/70 text-white' : undefined}>
              <p>{activeVideo ? 'Diese Lektion ist noch nicht verfügbar.' : 'Bitte wähle eine Lektion aus.'}</p>
            </div>
          )}
        </div>

        {!isAdmin && activeVideo?.bunnyGuid?.trim() ? (
          <div className="m-playback-controls">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => seekActiveVideoBy(-10)}
              disabled={!isPlayerApiReady}
              aria-label="10 Sekunden zurück"
            >
              <Rewind aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="default"
              size="icon"
              onClick={togglePlayerPlayback}
              disabled={!isPlayerApiReady}
              aria-label={isPlaybackPaused ? 'Video abspielen' : 'Video pausieren'}
            >
              {isPlaybackPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => seekActiveVideoBy(10)}
              disabled={!isPlayerApiReady}
              aria-label="10 Sekunden vor"
            >
              <FastForward aria-hidden="true" />
            </Button>
          </div>
        ) : null}

                {/* File attachments und Delete video in einer Zeile */}
                <div className="m-lesson-actions">
          {isAdmin || (activeVideo?.pdfUrl && !isDocumentLesson) ? <p className="m-attachment-label">Unterlagen zur Lektion</p> : null}

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
              {activeVideo?.pdfUrl && !isDocumentLesson && (
                <div className="m-attachment">
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
              <div className="m-lesson-buttons">
                <Button
                  variant="outline"
                  aria-pressed={activeVideoWatched}
                  aria-label={activeVideoWatched ? 'Als nicht abgeschlossen markieren' : 'Als abgeschlossen markieren'}
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
                  className="w-full"
                >
                  <Check aria-hidden="true" />
                  {isSavingWatched ? 'Wird gespeichert…' : activeVideoWatched ? 'Abgeschlossen' : 'Abschließen'}
                </Button>

                <Button
                  variant="default"
                  onClick={onNextVideo}
                  disabled={!onNextVideo || nextVideoDisabled}
                  className="w-full"
                >
                  Nächste Lektion
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {activeVideo && (isAdmin || activeVideo.showNotes?.trim()) ? (
          <LessonShowNotes
            key={activeVideo.id}
            videoId={activeVideo.id}
            showNotes={activeVideo.showNotes ?? null}
            isAdmin={isAdmin}
            onSaved={onShowNotesUpdate}
          />
        ) : null}
      </div>
    </div>
    </>
  )
}
