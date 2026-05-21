// components/modul-detail-client.tsx

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
const VideoPlayer = dynamic(
  () => import('./video-player').then((mod) => mod.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 flex flex-col max-w-7xl">
        <div className="aspect-video bg-black/90 rounded-2xl overflow-hidden animate-pulse" />
      </div>
    ),
  }
)
import { useToast } from '@/hooks/use-toast'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useSearchParams } from 'next/navigation'

type Video = {
  id: string
  title: string
  bunnyGuid: string | null
  thumbnailUrl: string | null
  pdfUrl: string | null
  duration?: number | null
  order: number
  updatedAt?: string | Date
}

type Chapter = {
  id: string
  name: string
  order: number
  videos: Video[]
}

type Playlist = {
  id: string
  name: string
}

type Modul = {
  id: string
  name: string
  chapters: Chapter[]
  playlist?: Playlist | null
}

type SidebarKurs = {
  id: string
  name: string
  slug: string
  modulesLength: number
  description?: string | null
  iconUrl?: string | null
}

type Props = {
  modul: Modul
  initialVideoId?: string | null
  initialWatchedVideoIds?: string[]
  isAdmin: boolean
  sidebar: {
    kurse: SidebarKurs[]
    savedSidebarOrder?: string[] | null
    activeCourseId?: string | null
    openCreateCourseModal?: boolean
  }
}


const skeletonBase = 'animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-800/70'

const MiddleSidebar = dynamic(
  () => import('./middle-sidebar-entry').then((mod) => mod.MiddleSidebar),
  {
    ssr: false,
    loading: () => (
      <div className="w-full lg:w-96 h-full min-h-0 border-r border-border bg-background p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <div className={`${skeletonBase} h-6 w-32`} />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`${skeletonBase} h-4 w-3/4`} />
                <div className={`${skeletonBase} h-3 w-1/2 opacity-70`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

export function ModulDetailClient({
  modul,
  initialVideoId = null,
  initialWatchedVideoIds,
  isAdmin,
  sidebar,
}: Props) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const videoParam = searchParams.get('video')

  const [localModul, setLocalModul] = useState(modul)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(initialVideoId)
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>(initialWatchedVideoIds ?? [])
  const [mobileView, setMobileView] = useState<'player' | 'content'>(() =>
    view === 'content' ? 'content' : 'player'
  )
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const lastViewedSentRef = useRef<string | null>(null)
  const adminMutationControllersRef = useRef<Set<AbortController>>(new Set())

  const trackAdminMutation = () => {
    const controller = new AbortController()
    adminMutationControllersRef.current.add(controller)
    return controller
  }

  const releaseAdminMutation = (controller: AbortController) => {
    adminMutationControllersRef.current.delete(controller)
  }

  const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError'

  // Zustand für Kapitel-Edit
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [tempChapterName, setTempChapterName] = useState('')

  const allVideos = useMemo(
    () => localModul.chapters.flatMap((chapter) => chapter.videos),
    [localModul.chapters]
  )
  const watchedVideoIdSet = useMemo(() => new Set(watchedVideoIds), [watchedVideoIds])

  // Bei Modulwechsel Server-Props wieder zur Quelle der Wahrheit machen.
  useEffect(() => {
    setLocalModul(modul)
    setActiveVideoId(initialVideoId)
    setWatchedVideoIds(initialWatchedVideoIds ?? [])
    setEditingChapterId(null)
    setTempChapterName('')
    lastViewedSentRef.current = null
  }, [initialVideoId, initialWatchedVideoIds, modul])

  useEffect(() => {
    const controllers = adminMutationControllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  // Automatisch das erste Video mit bunnyGuid auswählen (beim initialen Laden)
  // Oder das Video aus dem URL-Parameter verwenden (z.B. von Discord-Links)
  useEffect(() => {
    if (activeVideoId) return // Nur beim ersten Laden ausführen

    // Prüfe zuerst, ob ein video Parameter in der URL vorhanden ist
    if (videoParam) {
      const videoFromUrl = allVideos.find((v) => v.id === videoParam)

      if (videoFromUrl) {
        setActiveVideoId(videoFromUrl.id)
        return
      }
    }

    // Fallback: Erstes Video mit bunnyGuid
    const firstVideoWithGuid = allVideos.find((v) => v.bunnyGuid !== null)

    if (firstVideoWithGuid) {
      setActiveVideoId(firstVideoWithGuid.id)
    }
  }, [activeVideoId, allVideos, videoParam])

  // URL → State sync (z.B. wenn User direkt /...?view=content öffnet)
  useEffect(() => {
    if (view === 'content') setMobileView('content')
  }, [view])

  // "Zuletzt angesehen" speichern (für /mentorship Dashboard → Weiterlernen)
  useEffect(() => {
    if (isAdmin) return
    if (!activeVideoId) return
    if (lastViewedSentRef.current === activeVideoId) return

    lastViewedSentRef.current = activeVideoId

    try {
      void fetch('/api/playback/last-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId: activeVideoId }),
        keepalive: true,
      })
    } catch {
      // ignore
    }
  }, [activeVideoId, isAdmin])

  const activeVideo = useMemo(
    () => allVideos.find((video) => video.id === activeVideoId),
    [activeVideoId, allVideos]
  )

  const activeChapter = useMemo(
    () => localModul.chapters.find((chapter) => chapter.videos.some((video) => video.id === activeVideoId)),
    [activeVideoId, localModul.chapters]
  )

  const orderedVideoIds = useMemo(() => {
    const chapters = [...(localModul.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
    return chapters.flatMap((ch) =>
      [...(ch.videos || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((v) => v.id)
    )
  }, [localModul.chapters])

  const nextVideoId = useMemo(() => {
    if (!activeVideoId) return null
    const idx = orderedVideoIds.indexOf(activeVideoId)
    if (idx === -1) return null
    return orderedVideoIds[idx + 1] ?? null
  }, [activeVideoId, orderedVideoIds])

  const totalLessons = allVideos.length
  const completedLessons = watchedVideoIds.length
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Performance: `watchedVideoIds` kommt serverseitig als Prop (kein extra Fetch nötig).

  const handleWatchedChange = (videoId: string, watched: boolean) => {
    setWatchedVideoIds((prev) => {
      const next = new Set(prev)
      if (watched) next.add(videoId)
      else next.delete(videoId)
      return Array.from(next)
    })
  }

  // Bestehendes Video updaten (z. B. Titel, bunnyGuid, pdfUrl)
  const handleVideoUpdate = (updatedVideo: Video) => {
    setLocalModul((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) => ({
        ...ch,
        videos: ch.videos.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)),
      })),
    }))
  }

  // Videos innerhalb eines Kapitels umsortieren
  const handleVideosReorder = async (chapterId: string, newVideoOrder: Video[]) => {
    const controller = trackAdminMutation()

    // Optimistisches Update – sofort in UI anzeigen
    setLocalModul((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              videos: newVideoOrder.map((video, index) => ({
                ...video,
                order: index,
              })),
            }
          : ch
      ),
    }))

    // API-Call zum Speichern
    try {
      const res = await fetch('/api/videos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          videoIds: newVideoOrder.map((v) => v.id),
        }),
      })

      if (!res.ok) throw new Error()
      if (controller.signal.aborted) return

      toast({
        title: 'Video-Reihenfolge gespeichert',
        description: 'Die neue Anordnung wurde übernommen.',
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Video Reorder Fehler:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Reihenfolge konnte nicht gespeichert werden.',
      })
      // Optional: Zurückrollen (laden neue Daten)
    } finally {
      releaseAdminMutation(controller)
    }
  }

  const handleChaptersReorder = async (newChapterOrder: Chapter[]) => {
    const controller = trackAdminMutation()

    // Optimistisches Update – sofort in UI anzeigen
    setLocalModul((prev) => ({
      ...prev,
      chapters: newChapterOrder.map((chapter, index) => ({
        ...chapter,
        order: index + 1,
      })),
    }))

    // API-Call zum Speichern
    try {
      const res = await fetch('/api/chapters/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chapterIds: newChapterOrder.map((ch) => ch.id),
        }),
      })

      if (!res.ok) throw new Error()
      if (controller.signal.aborted) return

      toast({
        title: 'Kapitel-Reihenfolge gespeichert',
        description: 'Die neue Anordnung wurde übernommen.',
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Kapitel Reorder Fehler:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Reihenfolge konnte nicht gespeichert werden.',
      })

      // Optional: Bei Fehler zurückrollen – aber für jetzt reicht der Toast
    } finally {
      releaseAdminMutation(controller)
    }
  }

  const handleMoveChapter = async (direction: 'up' | 'down', chapterId: string) => {
    const sortedChapters = [...localModul.chapters].sort((a, b) => (a.order || 0) - (b.order || 0))
    const index = sortedChapters.findIndex((ch) => ch.id === chapterId)
    if (index === -1) return

    let newIndex: number
    if (direction === 'up' && index > 0) {
      newIndex = index - 1
    } else if (direction === 'down' && index < sortedChapters.length - 1) {
      newIndex = index + 1
    } else {
      toast({
        title: 'Ungültige Bewegung',
        description: 'Kapitel ist bereits oben/unten.',
      })
      return
    }

    // Swap
    const newChapters = [...sortedChapters]
    ;[newChapters[index], newChapters[newIndex]] = [newChapters[newIndex], newChapters[index]]

    // Optimistisch
    setLocalModul((prev) => ({
      ...prev,
      chapters: newChapters.map((chapter, i) => ({
        ...chapter,
        order: i + 1,
      })),
    }))

    // API
    const controller = trackAdminMutation()

    try {
      const res = await fetch('/api/chapters/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chapterIds: newChapters.map((ch) => ch.id),
        }),
      })

      if (!res.ok) throw new Error()
      if (controller.signal.aborted) return

      toast({
        title: 'Kapitel verschoben',
        description: `Kapitel wurde ${direction === 'up' ? 'hoch' : 'runter'} verschoben.`,
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Move Chapter Fehler:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Verschiebung konnte nicht gespeichert werden.',
      })
    } finally {
      releaseAdminMutation(controller)
    }
  }

  // Neues Video anlegen und sofort sichtbar + ausgewählt machen
  const handleAddVideo = async (chapterId: string) => {
    const defaultTitle = 'Neues Video'
    const controller = trackAdminMutation()

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ title: defaultTitle, chapterId }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Unbekannter Fehler')
      }

      const newVideo = await res.json()
      if (controller.signal.aborted) return

      // 1. Neues Video manuell in den lokalen State einfügen
      setLocalModul((prev) => ({
        ...prev,
        chapters: prev.chapters.map((ch) =>
          ch.id === chapterId
            ? { ...ch, videos: [...ch.videos, newVideo] }
            : ch
        ),
      }))

      // 2. Sofort auswählen → Upload-Zone erscheint direkt
      setActiveVideoId(newVideo.id)

      toast({
        title: 'Video angelegt',
        description: 'Du kannst jetzt die Datei hochladen.',
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Fehler beim Anlegen des Videos:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Video konnte nicht angelegt werden.',
      })
    } finally {
      releaseAdminMutation(controller)
    }
  }

    // NEU: Video löschen – aus Liste entfernen und aktives Video wechseln
    const handleVideoDelete = (deletedVideoId: string) => {
        setLocalModul((prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) => ({
            ...ch,
            videos: ch.videos.filter((v) => v.id !== deletedVideoId),
          })),
        }))
    
        // Wenn das gerade angezeigte Video gelöscht wird → nächstes auswählen
        if (activeVideoId === deletedVideoId) {
          const allRemainingVideos = localModul.chapters
            .flatMap((ch) => ch.videos)
            .filter((v) => v.id !== deletedVideoId)
    
          // Bevorzuge ein Video, das schon hochgeladen ist (hat bunnyGuid)
          const nextVideo = allRemainingVideos.find((v) => v.bunnyGuid) || allRemainingVideos[0] || null
    
        setActiveVideoId(nextVideo ? nextVideo.id : null)
      }

      }

      const handleAddChapter = async () => {
        const controller = trackAdminMutation()

        try {
          const res = await fetch('/api/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              name: 'Neues Kapitel',
              moduleId: modul.id,  // ← wichtig: moduleId (wie in Prisma)
            }),
          })
    
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Unbekannter Fehler')
          }
    
          const newChapter = await res.json()
          if (controller.signal.aborted) return

            // Optimistisches Update: sofort in UI anzeigen (mit videos: [] für Sicherheit)
            setLocalModul((prev) => ({
            ...prev,
            chapters: [...prev.chapters, { ...newChapter, videos: [] }],
            }))
    
          toast({
            title: 'Kapitel angelegt',
            description: '„Neues Kapitel“ wurde hinzugefügt. Du kannst es jetzt umbenennen.',
          })
    
          // Optional: Direkt in Edit-Modus gehen
        setEditingChapterId(newChapter.id)
        setTempChapterName(newChapter.name)
        } catch (err) {
          if (controller.signal.aborted || isAbortError(err)) return

          console.error('Fehler beim Anlegen des Kapitels:', err)
          toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Kapitel konnte nicht angelegt werden.',
          })
        } finally {
          releaseAdminMutation(controller)
        }
      }
    

  // Kapitel-Namen speichern (lokal + DB)
  const handleChapterNameSave = async () => {
    if (!editingChapterId || !tempChapterName.trim()) {
      setEditingChapterId(null)
      setTempChapterName('')
      return
    }

    const neuerName = tempChapterName.trim()
    const controller = trackAdminMutation()

    // Sofort lokal anzeigen
    setLocalModul((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === editingChapterId ? { ...ch, name: neuerName } : ch
      ),
    }))

    // In DB speichern
    try {
      const res = await fetch(`/api/chapters/${editingChapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ name: neuerName }),
      })

      if (controller.signal.aborted) return

      if (res.ok) {
        toast({
          title: 'Kapitel umbenannt',
          description: `„${neuerName}“ gespeichert.`,
        })
      } else {
        throw new Error()
      }
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Fehler beim Speichern des Kapitelnamens:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Kapitelname konnte nicht gespeichert werden.',
      })
    } finally {
      releaseAdminMutation(controller)
    }

    setEditingChapterId(null)
    setTempChapterName('')
  }

  const handleChapterDelete = async (chapterId: string) => {
    const controller = trackAdminMutation()

    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'DELETE',
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Löschen fehlgeschlagen')
      }

      if (controller.signal.aborted) return

      // Optimistisch entfernen
      setLocalModul((prev) => ({
        ...prev,
        chapters: prev.chapters.filter((ch) => ch.id !== chapterId),
      }))

      // Wenn aktives Kapitel gelöscht
      if (activeChapter?.id === chapterId) {
        setActiveVideoId(null)
      }

      toast({
        title: 'Kapitel gelöscht',
        description: 'Kapitel und Videos wurden entfernt.',
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return

      console.error('Kapitel löschen Fehler:', err)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Kapitel konnte nicht gelöscht werden.',
      })
    } finally {
      releaseAdminMutation(controller)
    }
  }

  // Mobile Screen: Content (Middle-Sidebar) als „normale“ Full-Screen Ansicht
  // (kein Drawer, kein Video-Player im Hintergrund).
  //
  // Wichtig: Dieser Block muss NACH den Handler-Definitionen stehen (sonst ReferenceError/TDZ).
  if (!isDesktop && mobileView === 'content') {
    return (
      <div className="flex h-full min-h-0 flex-1">
        <MiddleSidebar
          modul={localModul}
          courseTitle={localModul.playlist?.name ?? null}
          courseId={localModul.playlist?.id ?? null}
          activeVideoId={activeVideoId}
          onVideoClick={(id) => {
            setActiveVideoId(id)
            setMobileView('player')
          }}
          watchedVideoIds={watchedVideoIds}
          isAdmin={isAdmin}
          userProgress={
            !isAdmin
              ? {
                  percent: progressPercent,
                  completedLessons,
                  totalLessons,
                }
              : undefined
          }
          editingChapterId={editingChapterId}
          tempChapterName={tempChapterName}
          onChapterEditStart={(id, name) => {
            setEditingChapterId(id)
            setTempChapterName(name)
          }}
          onChapterEditSave={handleChapterNameSave}
          onChapterEditCancel={() => {
            setEditingChapterId(null)
            setTempChapterName('')
          }}
          onTempChapterNameChange={setTempChapterName}
          onVideosReorder={handleVideosReorder}
          onMoveChapterUp={(id) => handleMoveChapter('up', id)}
          onMoveChapterDown={(id) => handleMoveChapter('down', id)}
          onAddVideo={handleAddVideo}
          onAddChapter={handleAddChapter}
          onChaptersReorder={handleChaptersReorder}
          onDeleteChapter={handleChapterDelete}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex min-w-0">
      {/* Desktop: MiddleSidebar dauerhaft sichtbar */}
      {isDesktop ? (
        <MiddleSidebar
          modul={localModul}
          courseTitle={localModul.playlist?.name ?? null}
          courseId={localModul.playlist?.id ?? null}
          activeVideoId={activeVideoId}
          onVideoClick={setActiveVideoId}
          watchedVideoIds={watchedVideoIds}
          isAdmin={isAdmin}
          userProgress={
            !isAdmin
              ? {
                  percent: progressPercent,
                  completedLessons,
                  totalLessons,
                }
              : undefined
          }
          editingChapterId={editingChapterId}
          tempChapterName={tempChapterName}
          onChapterEditStart={(id, name) => {
            setEditingChapterId(id)
            setTempChapterName(name)
          }}
          onChapterEditSave={handleChapterNameSave}
          onChapterEditCancel={() => {
            setEditingChapterId(null)
            setTempChapterName('')
          }}
          onTempChapterNameChange={setTempChapterName}
          onVideosReorder={handleVideosReorder}
          onMoveChapterUp={(id) => handleMoveChapter('up', id)}
          onMoveChapterDown={(id) => handleMoveChapter('down', id)}
          onAddVideo={handleAddVideo}
          onAddChapter={handleAddChapter}
          onChaptersReorder={handleChaptersReorder}
          onDeleteChapter={handleChapterDelete}
        />
      ) : (
        // Platzhalter nur für Desktop vor der ersten MediaQuery-Auswertung (verhindert Layout-Jump)
        <div className="hidden lg:flex w-96 h-full min-h-0 border-r border-border bg-background p-4 sm:p-6 lg:p-8">
          <div className="w-full space-y-4">
            <div className={`${skeletonBase} h-6 w-32`} />
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className={`${skeletonBase} h-4 w-3/4`} />
                  <div className={`${skeletonBase} h-3 w-1/2 opacity-70`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video + Mobile Controls */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Platz unten, damit die Mobile Bottom-Bar nichts verdeckt */}
        <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0">
          <VideoPlayer
            activeVideo={activeVideo || null}
            activeChapterName={activeChapter?.name || null}
            onVideoUpdate={handleVideoUpdate}
            onVideoDelete={handleVideoDelete}
            activeVideoWatched={activeVideoId ? watchedVideoIdSet.has(activeVideoId) : false}
            onVideoWatchedChange={handleWatchedChange}
            isAdmin={isAdmin}
            onBack={!isDesktop ? () => setMobileView('content') : undefined}
            onNextVideo={
              nextVideoId
                ? () => {
                    setActiveVideoId(nextVideoId)
                    setMobileView('player')
                  }
                : undefined
            }
            nextVideoDisabled={!nextVideoId}
            autoPlay={false}
          />
        </div>
      </div>
    </div>
  )
}
