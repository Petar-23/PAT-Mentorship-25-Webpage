// components/middle-sidebar.tsx

'use client'

import { useUser } from '@clerk/nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import Image from 'next/image'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Film,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  verticalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { CSS } from '@dnd-kit/utilities'

const DURATION_RETRY_MS = 15_000
const MAX_DURATION_ATTEMPTS = 30
const STATUS_RETRY_MS = 8_000
const MAX_STATUS_ATTEMPTS = 120

type Video = {
  id: string
  title: string
  bunnyGuid: string | null
  pdfUrl: string | null
  order: number
}

type Chapter = {
  id: string
  name: string
  videos: Video[]
  order: number
}

type Modul = {
  id: string
  name: string
  chapters: Chapter[]
}

type Props = {
  modul: Modul
  courseTitle?: string | null
  courseId?: string | null
  activeVideoId: string | null
  onVideoClick: (videoId: string) => void
  userProgress?: {
    percent: number
    completedLessons: number
    totalLessons: number
  }
  watchedVideoIds?: string[]
  editingChapterId: string | null
  tempChapterName: string
  onChapterEditStart: (chapterId: string, name: string) => void
  onChapterEditSave: () => void
  onChapterEditCancel: () => void
  onTempChapterNameChange: (name: string) => void
  onVideosReorder: (chapterId: string, newVideoOrder: Video[]) => void
  onChaptersReorder: (newChapterOrder: Chapter[]) => void
  onAddVideo: (chapterId: string) => void
  onAddChapter: () => void
  onMoveChapterUp: (chapterId: string) => void
  onMoveChapterDown: (chapterId: string) => void
  onDeleteChapter?: (chapterId: string) => void
}

type BunnyStatus = {
  status: number
  encodeProgress: number
  transcodingFailed: boolean
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function VideoThumbnail({
  bunnyGuid,
  title,
  isProcessing,
  isWatched,
}: {
  bunnyGuid: string | null
  title: string
  isProcessing: boolean
  isWatched?: boolean
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [bunnyGuid])

  useEffect(() => {
    if (!hasError) return
    const t = setTimeout(() => setHasError(false), 20_000)
    return () => clearTimeout(t)
  }, [hasError])

  const showWatchedOverlay = Boolean(isWatched) && !isProcessing

  return (
    <div className="relative w-24 h-14 flex-shrink-0 cursor-pointer">
      {isProcessing ? (
        <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 w-6 h-6 rounded-full border-2 border-gray-500"></div>
            <div className="absolute inset-0 w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : !bunnyGuid || hasError ? (
        <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
          <Film className="h-5 w-5 text-muted-foreground/70" />
        </div>
      ) : (
        <Image
          src={`https://vz-dc8da426-d71.b-cdn.net/${bunnyGuid}/thumbnail.jpg`}
          alt={title}
          fill
          sizes="96px"
          className="object-cover rounded-md"
          // Wichtig: direkt vom Bunny-CDN laden (nicht über Next Image Proxy),
          // sonst können Thumbnails je nach CDN/Hotlink-Settings leer bleiben.
          unoptimized
          referrerPolicy="origin"
          onError={() => setHasError(true)}
        />
      )}

      {showWatchedOverlay ? (
        <div className="pointer-events-none absolute inset-0 rounded-md bg-gray-600/30 flex items-center justify-center">
          <div className="h-7 w-7 rounded-full bg-white/40 border border-white/60 flex items-center justify-center shadow-sm">
            <Check className="h-4 w-4 text-black/70" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SortableVideo({
  video,
  isActive,
  onClick,
  durationText,
  isProcessing,
  isWatched,
}: {
  video: Video
  isActive: boolean
  onClick: () => void
  durationText: string
  isProcessing: boolean
  isWatched: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `video-${video.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
      <div
        className={[
          'p-2 flex items-center space-x-2 cursor-pointer transition-colors rounded-md border border-l-4',
          isActive
            ? 'bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-400 border-l-gray-400 dark:border-l-gray-400'
            : 'border-transparent border-l-transparent hover:bg-gray-100 dark:hover:bg-gray-800/40',
        ].join(' ')}
        onClick={onClick}
        aria-current={isActive ? 'true' : undefined}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none select-none p-1 rounded hover:bg-accent/30 flex items-center justify-center min-w-[20px]"
        >
          <GripVertical className="h-4 w-5 text-muted-foreground" />
        </div>

        <VideoThumbnail
          bunnyGuid={video.bunnyGuid}
          title={video.title}
          isProcessing={isProcessing}
          isWatched={isWatched}
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
            {video.title}
          </p>
          <p className="text-xs text-muted-foreground">{durationText}</p>
        </div>
      </div>
    </div>
  )
}

function VideoRow({
  video,
  isActive,
  onClick,
  durationText,
  isProcessing,
  isWatched,
}: {
  video: Video
  isActive: boolean
  onClick: () => void
  durationText: string
  isProcessing: boolean
  isWatched: boolean
}) {
  return (
    <div
      className={[
        'p-2 flex items-center space-x-2 cursor-pointer transition-colors rounded-md border border-l-4',
        isActive
          ? 'bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 border-l-gray-400 dark:border-l-gray-400'
          : 'border-transparent border-l-transparent hover:bg-gray-100 dark:hover:bg-gray-800/40',
      ].join(' ')}
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
    >
      <VideoThumbnail
        bunnyGuid={video.bunnyGuid}
        title={video.title}
        isProcessing={isProcessing}
        isWatched={isWatched}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
          {video.title}
        </p>
        <p className="text-xs text-muted-foreground">{durationText}</p>
      </div>
    </div>
  )
}

export function MiddleSidebar({
  modul,
  courseTitle,
  courseId,
  activeVideoId,
  onVideoClick,
  userProgress,
  watchedVideoIds,
  editingChapterId,
  tempChapterName,
  onChapterEditStart,
  onChapterEditSave,
  onChapterEditCancel,
  onTempChapterNameChange,
  onVideosReorder,
  onAddVideo,
  onAddChapter,
  onMoveChapterUp,
  onMoveChapterDown,
  onDeleteChapter,
}: Props) {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const isAdmin =
    isLoaded && user?.organizationMemberships?.some((m) => m.role === 'org:admin')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sortedChapters = useMemo(() => {
    return [...(modul.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [modul.chapters])

  const [openChapters, setOpenChapters] = useState<Set<string>>(
    new Set(sortedChapters.map((ch) => ch.id))
  )
  const [deleteDialogChapterId, setDeleteDialogChapterId] = useState<string | null>(null)

  const [videoDurations, setVideoDurations] = useState<Record<string, number | null>>({})
  const durationAttemptsRef = useRef<Record<string, number>>({})
  const [videoStatuses, setVideoStatuses] = useState<Record<string, BunnyStatus | null>>({})
  const statusAttemptsRef = useRef<Record<string, number>>({})

  const bunnyGuids = useMemo(() => {
    const guids = sortedChapters
      .flatMap((ch) => ch.videos)
      .map((v) => v.bunnyGuid)
      .filter((g): g is string => typeof g === 'string' && g.length > 0)

    return Array.from(new Set(guids))
  }, [sortedChapters])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const missing = bunnyGuids.filter((guid) => videoDurations[guid] === undefined)
    const pending = bunnyGuids.filter((guid) => {
      const value = videoDurations[guid]
      if (value !== null) return false
      const attempts = durationAttemptsRef.current[guid] ?? 0
      return attempts < MAX_DURATION_ATTEMPTS
    })

    if (missing.length === 0 && pending.length === 0) return

    const fetchGuids = async (guids: string[]) => {
      const results = await Promise.all(
        guids.map(async (guid) => {
          durationAttemptsRef.current[guid] = (durationAttemptsRef.current[guid] ?? 0) + 1
          try {
            const res = await fetch(`/api/videos/duration/${guid}`, { cache: 'no-store' })
            if (!res.ok) return [guid, null] as const

            const data = (await res.json()) as { durationSeconds?: unknown }
            const seconds = typeof data.durationSeconds === 'number' ? data.durationSeconds : null
            return [guid, seconds] as const
          } catch {
            return [guid, null] as const
          }
        })
      )

      if (cancelled) return

      setVideoDurations((prev) => {
        const next = { ...prev }
        for (const [guid, seconds] of results) next[guid] = seconds
        return next
      })
    }

    if (missing.length > 0) {
      void fetchGuids(missing)
    }

    if (pending.length > 0) {
      timer = setTimeout(() => {
        void fetchGuids(pending)
      }, DURATION_RETRY_MS)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [bunnyGuids, videoDurations])

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const missing = bunnyGuids.filter((guid) => videoStatuses[guid] === undefined)
    const pending = bunnyGuids.filter((guid) => {
      const value = videoStatuses[guid]
      if (!value) return false

      const attempts = statusAttemptsRef.current[guid] ?? 0
      if (attempts >= MAX_STATUS_ATTEMPTS) return false

      const failed =
        value.transcodingFailed === true || value.status === 5 || value.status === 6
      const finished = value.status === 4 && (value.encodeProgress ?? 0) === 100

      return !failed && !finished
    })

    if (missing.length === 0 && pending.length === 0) return

    const fetchGuids = async (guids: string[]) => {
      const results = await Promise.all(
        guids.map(async (guid) => {
          statusAttemptsRef.current[guid] = (statusAttemptsRef.current[guid] ?? 0) + 1
          try {
            const res = await fetch(`/api/videos/status/${guid}`, { cache: 'no-store' })
            if (!res.ok) return { guid, ok: false } as const

            const data = (await res.json()) as Partial<BunnyStatus>
            const status = typeof data.status === 'number' ? data.status : 0
            const encodeProgress =
              typeof data.encodeProgress === 'number' ? data.encodeProgress : 0
            const transcodingFailed = data.transcodingFailed === true

            return {
              guid,
              ok: true,
              value: { status, encodeProgress, transcodingFailed } satisfies BunnyStatus,
            } as const
          } catch {
            return { guid, ok: false } as const
          }
        })
      )

      if (cancelled) return

      setVideoStatuses((prev) => {
        const next = { ...prev }
        for (const r of results) {
          if (r.ok) {
            next[r.guid] = r.value
          } else if (prev[r.guid] === undefined) {
            // nur beim ersten Fehler als "nicht verfügbar" markieren,
            // damit wir bestehende Statusdaten nicht überschreiben.
            next[r.guid] = null
          }
        }
        return next
      })
    }

    if (missing.length > 0) {
      void fetchGuids(missing)
    }

    if (pending.length > 0) {
      timer = setTimeout(() => {
        void fetchGuids(pending)
      }, STATUS_RETRY_MS)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [isAdmin, bunnyGuids, videoStatuses])

  const getProcessingInfo = (video: Video) => {
    if (!isAdmin || !video.bunnyGuid) {
      return { isProcessing: false, progress: null as number | null }
    }

    const s = videoStatuses[video.bunnyGuid]
    if (!s) {
      return { isProcessing: false, progress: null as number | null }
    }

    const failed = s.transcodingFailed === true || s.status === 5 || s.status === 6
    const finished = s.status === 4 && (s.encodeProgress ?? 0) === 100

    if (!failed && !finished) {
      return {
        isProcessing: true,
        progress: typeof s.encodeProgress === 'number' ? Math.round(s.encodeProgress) : 0,
      }
    }

    return { isProcessing: false, progress: null as number | null }
  }

  const getDurationText = (video: Video) => {
    const processing = getProcessingInfo(video)
    if (processing.isProcessing) {
      return typeof processing.progress === 'number'
        ? `Processing: ${processing.progress}%`
        : 'Processing...'
    }

    if (!video.bunnyGuid) return '—'

    const seconds = videoDurations[video.bunnyGuid]
    if (seconds === undefined) return 'Lädt...'

    if (seconds === null) {
      const attempts = durationAttemptsRef.current[video.bunnyGuid] ?? 0
      return attempts >= MAX_DURATION_ATTEMPTS ? '—' : 'Lädt...'
    }

    return formatDuration(seconds)
  }
  
  useEffect(() => {
    if (editingChapterId) {
      setOpenChapters((prev) => {
        const newSet = new Set(prev)
        newSet.add(editingChapterId)
        return newSet
      })
    }
  }, [editingChapterId])

  const toggleChapter = (chapterId: string) => {
    setOpenChapters((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(chapterId)) newSet.delete(chapterId)
      else newSet.add(chapterId)
      return newSet
    })
  }

  const handleVideoDragEnd = (event: DragEndEvent, chapterId: string) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const chapter = modul.chapters.find((ch) => ch.id === chapterId)
    if (!chapter) return

    const sortedVideos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))

    const activeId = (active.id as string).replace('video-', '')
    const overId = over?.id ? (over.id as string).replace('video-', '') : ''

    const oldIndex = sortedVideos.findIndex((v) => v.id === activeId)
    const newIndex = sortedVideos.findIndex((v) => v.id === overId || '')

    if (oldIndex === -1 || newIndex === -1) return

    const newVideos = arrayMove(sortedVideos, oldIndex, newIndex)
    onVideosReorder(chapterId, newVideos)
  }


  return (
    <div className="w-full lg:w-96 border-r border-border bg-background p-4 sm:p-6 lg:p-8 flex flex-col h-full min-h-0">
      <div className="mb-6 sm:mb-8 flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 hover:bg-gray-300"
          onClick={() => {
            if (courseId) {
              router.push(`/mentorship/${courseId}`)
              return
            }
            router.back()
          }}
          aria-label="Zurück zur Modulübersicht"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          {courseTitle ? (
            <p className="text-xs text-muted-foreground truncate">{courseTitle}</p>
          ) : null}
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">{modul.name}</h1>
        </div>
      </div>

      {!isAdmin && userProgress ? (
        <Card className="mb-6 border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Fortschritt</p>
                <p className="text-xs text-muted-foreground">
                  {userProgress.completedLessons} von {userProgress.totalLessons} Lektionen
                  abgeschlossen
                </p>
              </div>
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {userProgress.percent}%
              </div>
            </div>
            <Progress value={userProgress.percent} className="h-2.5" />
          </CardContent>
        </Card>
      ) : null}

      <ScrollArea className="flex-1 min-h-0 pb-20">
      <div className="space-y-2 pr-2">
        {sortedChapters.map((chapter) => {
          const isOpen = openChapters.has(chapter.id)
          const sortedVideos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))

          return (
            <Card className="border border-border shadow-sm" key={chapter.id}>
              <CardContent className="p-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 select-none min-w-0">
                  <div className="flex items-center space-x-3 min-w-0">

                    {/* Chevron zum Auf-/Zuklappen */}
                    <span
                      className="cursor-pointer p-1 hover:bg-accent/50 rounded flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleChapter(chapter.id)
                      }}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>

                    {/* Kapitel-Titel oder Edit-Modus */}
                    {isAdmin && editingChapterId === chapter.id ? (
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <input
                          type="text"
                          value={tempChapterName}
                          onChange={(e) => onTempChapterNameChange(e.target.value)}
                          className="text-md font-bold bg-transparent border-b-2 border-primary focus:outline-none flex-1 min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onChapterEditSave()
                              e.stopPropagation()
                            }
                            if (e.key === 'Escape') onChapterEditCancel()
                          }}
                          onBlur={onChapterEditSave}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button size="sm" variant="outline" onClick={(e) => {
                          e.stopPropagation()
                          onChapterEditSave()
                        }}>
                          <Check className="h-5 w-5 text-green-500" />
                        </Button>
                      </div>
                    ) : (
                      <h3
                        className={`text-md font-bold truncate flex-1 min-w-0 px-2 py-1 rounded select-text ${
                          isAdmin ? 'cursor-pointer hover:bg-accent/50' : ''
                        }`}
                        onClick={() => {
                          if (!isAdmin) return
                          onChapterEditStart(chapter.id, chapter.name)
                        }}
                      >
                        {chapter.name}
                      </h3>
                    )}
                  </div>

                  {/* RECHTS: Up/Down + Plus + Trash */}
                  {isAdmin && editingChapterId !== chapter.id && (
                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Up/Down Buttons – jetzt rechts, kleiner und outline */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddVideo(chapter.id)
                        }}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-destructive hover:border-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteDialogChapterId(chapter.id)
                        }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>

                      <div className="flex flex-col space-y-px">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5 rounded-t-md rounded-b-none p-0 bg-gray-200 hover:bg-gray-300 border-border/50"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveChapterUp(chapter.id)
                          }}
                          disabled={sortedChapters.findIndex((ch) => ch.id === chapter.id) === 0}
                        >
                          <ChevronUp className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5 rounded-t-none rounded-b-md p-0 bg-gray-200 hover:bg-gray-300 border-t-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveChapterDown(chapter.id)
                          }}
                          disabled={sortedChapters.findIndex((ch) => ch.id === chapter.id) === sortedChapters.length - 1}
                        >
                          <ChevronDown className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Video-Liste mit Drag-and-Drop – bleibt komplett unverändert! */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="mt-3 border-t border-border pt-2">
                    {isAdmin ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleVideoDragEnd(e, chapter.id)}
                      >
                        <SortableContext
                          items={sortedVideos.map((v) => `video-${v.id}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          {sortedVideos.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                              Noch keine Videos
                            </div>
                          ) : (
                            sortedVideos.map((video) => (
                              (() => {
                                const processing = getProcessingInfo(video)
                                return (
                                  <SortableVideo
                                    key={video.id}
                                    video={video}
                                    isActive={video.id === activeVideoId}
                                    onClick={() => onVideoClick(video.id)}
                                    durationText={getDurationText(video)}
                                    isProcessing={processing.isProcessing}
                                    isWatched={false}
                                  />
                                )
                              })()
                            ))
                          )}
                        </SortableContext>
                      </DndContext>
                    ) : sortedVideos.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Noch keine Videos
                      </div>
                    ) : (
                      sortedVideos.map((video) => (
                        (() => {
                          const processing = getProcessingInfo(video)
                          const isWatched = Boolean(watchedVideoIds?.includes(video.id))
                          return (
                            <VideoRow
                              key={video.id}
                              video={video}
                              isActive={video.id === activeVideoId}
                              onClick={() => onVideoClick(video.id)}
                              durationText={getDurationText(video)}
                              isProcessing={processing.isProcessing}
                              isWatched={isWatched}
                            />
                          )
                        })()
                      ))
                    )}
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

        {/* Delete Confirm Dialog (nur Admin) */}
        {isAdmin && (
          <AlertDialog
            open={deleteDialogChapterId !== null}
            onOpenChange={() => setDeleteDialogChapterId(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kapitel löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Das gesamte Kapitel &quot;
                  {
                    sortedChapters.find((ch) => ch.id === deleteDialogChapterId)
                      ?.name
                  }
                  &quot; und alle Videos (inkl. Bunny) werden{' '}
                  {deleteDialogChapterId ? 'permanent ' : ''}gelöscht.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDeleteChapter?.(deleteDialogChapterId!)
                    setDeleteDialogChapterId(null)
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Neues Kapitel anlegen (nur Admin) */}
        {isAdmin && (
          <Card
            className="border-2 border-dashed border-muted-foreground/50 bg-gray-100/50 cursor-pointer hover:bg-accent/30 transition-colors mt-8"
            onClick={onAddChapter}
          >
            <CardContent className="p-4 flex items-center justify-center space-x-4">
              <div className="w-7 h-7 rounded-md border border-muted-foreground/50 flex items-center justify-center bg-muted/20">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Neues Kapitel anlegen
              </p>
            </CardContent>
          </Card>
        )}
      </ScrollArea>
    </div>
  )
}