// components/middle-sidebar.tsx

'use client'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft'
import { CaretRight as ChevronRight } from '@phosphor-icons/react/CaretRight'
import { CaretUp as ChevronUp } from '@phosphor-icons/react/CaretUp'
import { Check } from '@phosphor-icons/react/Check'
import { X } from '@phosphor-icons/react/X'
import { Pencil } from '@phosphor-icons/react/Pencil'
import { DotsThree } from '@phosphor-icons/react/DotsThree'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DotsSixVertical as GripVertical } from '@phosphor-icons/react/DotsSixVertical'
import { Plus } from '@phosphor-icons/react/Plus'
import { Trash as Trash2 } from '@phosphor-icons/react/Trash'
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
import { useMentorshipMobileNavigation, useMentorshipTheme } from '@/components/mentorship/shell'
import { useRouter } from 'next/navigation'

import { CSS } from '@dnd-kit/utilities'
import { VideoThumbnail } from '@/components/mentorship/video-thumbnail'

const DURATION_RETRY_MS = 15_000
const MAX_DURATION_ATTEMPTS = 30
const STATUS_RETRY_MS = 8_000
const MAX_STATUS_ATTEMPTS = 120
const VIDEO_METADATA_FETCH_CONCURRENCY = 4
const EMPTY_DURATION_ATTEMPTS: Record<string, number> = {}
const EMPTY_VIDEO_STATUSES: Record<string, BunnyStatus | null> = {}

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

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
    <div ref={setNodeRef} style={style} className={`m-admin-lesson-row ${isActive ? 'is-active' : ''}`}>
      <button type="button" {...attributes} {...listeners} className="m-admin-drag"
        aria-label={`${video.title} verschieben`}>
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" className="m-admin-lesson-select" onClick={onClick}
        aria-current={isActive ? 'true' : undefined}>
        <span className="m-admin-lesson-thumbnail" aria-hidden="true">
          <VideoThumbnail bunnyGuid={video.bunnyGuid} thumbnailUrl={video.thumbnailUrl} title={video.title}
            isProcessing={isProcessing} isWatched={isWatched} updatedAt={video.updatedAt ?? null} />
        </span>
        <span className="m-admin-lesson-copy"><span className="m-admin-lesson-title">{video.title}</span>
          <span className="m-admin-lesson-duration">{durationText}</span>
        </span>
      </button>
    </div>
  )
}

export function MiddleSidebar({
  modul,
  courseTitle,
  courseId,
  activeVideoId,
  onVideoClick,
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
  const { container: portalContainer } = useMentorshipMobileNavigation()
  const theme = useMentorshipTheme()
  const router = useRouter()
  const pendingRef = useRef(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  async function runAction(name: string, action: () => void | Promise<void>) {
    if (pendingRef.current) return
    pendingRef.current = true
    setPendingAction(name)
    try { await action() } finally { pendingRef.current = false; setPendingAction(null) }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sortedChapters = useMemo(() => {
    return [...(modul.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [modul.chapters])

  const initiallyOpenChapterId = useMemo(() => {
    return (
      sortedChapters.find((chapter) => chapter.videos.some((video) => video.id === activeVideoId))?.id ??
      sortedChapters[0]?.id ??
      null
    )
  }, [activeVideoId, sortedChapters])

  const defaultOpenChapters = useMemo(() => {
    return initiallyOpenChapterId ? new Set([initiallyOpenChapterId]) : new Set<string>()
  }, [initiallyOpenChapterId])
  const openChaptersKey = `${modul.id}:${initiallyOpenChapterId ?? 'none'}`
  const [openChaptersState, setOpenChaptersState] = useState<{
    key: string
    chapters: Set<string>
  }>(() => ({
    key: openChaptersKey,
    chapters: defaultOpenChapters,
  }))
  const openChapters =
    openChaptersState.key === openChaptersKey ? openChaptersState.chapters : defaultOpenChapters
  const [deleteDialogChapterId, setDeleteDialogChapterId] = useState<string | null>(null)

  const initialVideoDurations = useMemo(() => {
    const entries = sortedChapters
      .flatMap((chapter) => chapter.videos)
      .flatMap((video) =>
        video.bunnyGuid && typeof video.duration === 'number' && video.duration > 0
          ? [[video.bunnyGuid, video.duration] as const]
          : []
      )

    return Object.fromEntries(entries) as Record<string, number>
  }, [sortedChapters])

  const videoStateKey = useMemo(() => {
    const videoFingerprint = sortedChapters
      .flatMap((chapter) =>
        chapter.videos.map((video) => [
          video.id,
          video.bunnyGuid ?? '',
          typeof video.duration === 'number' ? video.duration : '',
          video.updatedAt ? new Date(video.updatedAt).getTime() : '',
        ].join(':'))
      )
      .join('|')

    return `${modul.id}:${videoFingerprint}`
  }, [modul.id, sortedChapters])

  const [videoDurationsState, setVideoDurationsState] = useState<{
    key: string
    values: Record<string, number | null>
  }>(() => ({ key: videoStateKey, values: initialVideoDurations }))
  const [durationAttemptsState, setDurationAttemptsState] = useState<{
    key: string
    values: Record<string, number>
  }>(() => ({ key: videoStateKey, values: {} }))
  const [videoStatusesState, setVideoStatusesState] = useState<{
    key: string
    values: Record<string, BunnyStatus | null>
  }>(() => ({ key: videoStateKey, values: {} }))
  const durationAttemptsRef = useRef<{ key: string; values: Record<string, number> }>({
    key: videoStateKey,
    values: {},
  })
  const statusAttemptsRef = useRef<{ key: string; values: Record<string, number> }>({
    key: videoStateKey,
    values: {},
  })

  const videoDurations =
    videoDurationsState.key === videoStateKey ? videoDurationsState.values : initialVideoDurations
  const durationAttempts =
    durationAttemptsState.key === videoStateKey ? durationAttemptsState.values : EMPTY_DURATION_ATTEMPTS
  const videoStatuses =
    videoStatusesState.key === videoStateKey ? videoStatusesState.values : EMPTY_VIDEO_STATUSES

  const videosMissingDuration = useMemo(() => {
    return sortedChapters.flatMap((chapter) =>
      chapter.videos.filter((video) => video.bunnyGuid && !(typeof video.duration === 'number' && video.duration > 0))
    )
  }, [sortedChapters])

  const bunnyGuids = useMemo(() => {
    const guids = videosMissingDuration
      .map((video) => video.bunnyGuid)
      .filter((g): g is string => typeof g === 'string' && g.length > 0)

    return Array.from(new Set(guids))
  }, [videosMissingDuration])

  const durationCandidateGuids = useMemo(() => {
    const guids = sortedChapters
      .flatMap((chapter) => chapter.videos)
      .filter((video) => video.bunnyGuid && !(typeof video.duration === 'number' && video.duration > 0))
      .map((video) => video.bunnyGuid)
      .filter((g): g is string => typeof g === 'string' && g.length > 0)

    return Array.from(new Set(guids))
  }, [sortedChapters])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    const controller = new AbortController()

    const fetchableGuids = durationCandidateGuids.filter((guid) => {
      const status = videoStatuses[guid]
      if (!status) return true

      const failed =
        status.transcodingFailed === true || status.status === 5 || status.status === 6
      const finished = status.status === 4 && (status.encodeProgress ?? 0) === 100
      return !failed && finished
    })

    const missing = fetchableGuids.filter((guid) => videoDurations[guid] === undefined)
    const pending = fetchableGuids.filter((guid) => {
      const value = videoDurations[guid]
      if (value !== null) return false
      const attempts =
        durationAttemptsRef.current.key === videoStateKey
          ? durationAttemptsRef.current.values[guid] ?? 0
          : 0
      return attempts < MAX_DURATION_ATTEMPTS
    })

    if (missing.length === 0 && pending.length === 0) return

    const fetchGuids = async (guids: string[]) => {
      if (cancelled || inFlight || isDocumentHidden()) return
      inFlight = true
      const attemptUpdates: Record<string, number> = {}
      if (durationAttemptsRef.current.key !== videoStateKey) {
        durationAttemptsRef.current = { key: videoStateKey, values: {} }
      }

      try {
        const results = await mapWithConcurrency(
          guids,
          VIDEO_METADATA_FETCH_CONCURRENCY,
          async (guid) => {
            const nextAttempt = (durationAttemptsRef.current.values[guid] ?? 0) + 1
            durationAttemptsRef.current.values[guid] = nextAttempt
            attemptUpdates[guid] = nextAttempt
            try {
              const res = await fetch(`/api/videos/duration/${guid}`, {
                cache: 'no-store',
                signal: controller.signal,
              })
              if (!res.ok) return [guid, null] as const

              const data = (await res.json()) as { durationSeconds?: unknown }
              const seconds = typeof data.durationSeconds === 'number' ? data.durationSeconds : null
              return [guid, seconds] as const
            } catch {
              return [guid, null] as const
            }
          }
        )

        if (cancelled) return

        setDurationAttemptsState((prev) => ({
          key: videoStateKey,
          values: {
            ...(prev.key === videoStateKey ? prev.values : {}),
            ...attemptUpdates,
          },
        }))

        setVideoDurationsState((prev) => {
          const next = {
            ...(prev.key === videoStateKey ? prev.values : initialVideoDurations),
          }
          for (const [guid, seconds] of results) next[guid] = seconds
          return { key: videoStateKey, values: next }
        })
      } finally {
        inFlight = false
      }
    }

    const loadVisibleMetadata = () => {
      if (isDocumentHidden()) return

      if (missing.length > 0) {
        void fetchGuids(missing)
      }

      if (pending.length > 0 && !timer) {
        timer = setTimeout(() => {
          timer = null
          void fetchGuids(pending)
        }, DURATION_RETRY_MS)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadVisibleMetadata()
      }
    }

    loadVisibleMetadata()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer) clearTimeout(timer)
    }
  }, [durationCandidateGuids, initialVideoDurations, videoDurations, videoStateKey, videoStatuses])

  useEffect(() => {

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    const controller = new AbortController()

    const missing = bunnyGuids.filter((guid) => videoStatuses[guid] === undefined)
    const pending = bunnyGuids.filter((guid) => {
      const value = videoStatuses[guid]
      if (!value) return false

      const attempts =
        statusAttemptsRef.current.key === videoStateKey
          ? statusAttemptsRef.current.values[guid] ?? 0
          : 0
      if (attempts >= MAX_STATUS_ATTEMPTS) return false

      const failed =
        value.transcodingFailed === true || value.status === 5 || value.status === 6
      const finished = value.status === 4 && (value.encodeProgress ?? 0) === 100

      return !failed && !finished
    })

    if (missing.length === 0 && pending.length === 0) return

    const fetchGuids = async (guids: string[]) => {
      if (cancelled || inFlight || isDocumentHidden()) return
      inFlight = true
      if (statusAttemptsRef.current.key !== videoStateKey) {
        statusAttemptsRef.current = { key: videoStateKey, values: {} }
      }

      try {
        const results = await mapWithConcurrency(
          guids,
          VIDEO_METADATA_FETCH_CONCURRENCY,
          async (guid) => {
            statusAttemptsRef.current.values[guid] =
              (statusAttemptsRef.current.values[guid] ?? 0) + 1
            try {
              const res = await fetch(`/api/videos/status/${guid}`, {
                cache: 'no-store',
                signal: controller.signal,
              })
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
          }
        )

        if (cancelled) return

        setVideoStatusesState((prev) => {
          const previousValues = prev.key === videoStateKey ? prev.values : {}
          const next = { ...previousValues }
          for (const r of results) {
            if (r.ok) {
              next[r.guid] = r.value
            } else if (previousValues[r.guid] === undefined) {
              // nur beim ersten Fehler als "nicht verfügbar" markieren,
              // damit wir bestehende Statusdaten nicht überschreiben.
              next[r.guid] = null
            }
          }
          return { key: videoStateKey, values: next }
        })
      } finally {
        inFlight = false
      }
    }

    const loadVisibleMetadata = () => {
      if (isDocumentHidden()) return

      if (missing.length > 0) {
        void fetchGuids(missing)
      }

      if (pending.length > 0 && !timer) {
        timer = setTimeout(() => {
          timer = null
          void fetchGuids(pending)
        }, STATUS_RETRY_MS)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadVisibleMetadata()
      }
    }

    loadVisibleMetadata()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer) clearTimeout(timer)
    }
  }, [bunnyGuids, videoStateKey, videoStatuses])

  const getProcessingInfo = (video: Video) => {
    if (!video.bunnyGuid) {
      return { isProcessing: false, progress: null as number | null }
    }

    const knownDuration = videoDurations[video.bunnyGuid] ?? video.duration ?? null
    if (typeof knownDuration === 'number' && knownDuration > 0) {
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
        ? `Verarbeitung · ${processing.progress} %`
        : 'Wird verarbeitet …'
    }

    if (!video.bunnyGuid) return '—'

    const seconds = videoDurations[video.bunnyGuid] ?? video.duration ?? undefined
    if (seconds === undefined) return 'Lädt...'

    if (seconds === null) {
      const attempts = durationAttempts[video.bunnyGuid] ?? 0
      return attempts >= MAX_DURATION_ATTEMPTS ? '—' : 'Lädt...'
    }

    return formatDuration(seconds)
  }
  
  const toggleChapter = (chapterId: string) => {
    setOpenChaptersState((prev) => {
      const base = prev.key === openChaptersKey ? prev.chapters : defaultOpenChapters
      const newSet = new Set(base)
      if (newSet.has(chapterId)) newSet.delete(chapterId)
      else newSet.add(chapterId)
      return { key: openChaptersKey, chapters: newSet }
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
    void runAction('sort', () => onVideosReorder(chapterId, newVideos))
  }


  return (
    <aside className="m-lesson-outline m-admin-outline" aria-label="Kapitel und Lektionen">
      <div className="m-outline-header">
        <button type="button" className="m-outline-back" onClick={() => courseId ? router.push(`/mentorship/${courseId}`) : router.back()}
          aria-label="Zurück zur Modulübersicht">
          <ArrowLeft aria-hidden="true" /><span>{courseTitle || 'Modulübersicht'}</span>
        </button>
        <h1>{modul.name}</h1>
        <p className="m-admin-outline-meta">{sortedChapters.reduce((sum, chapter) => sum + chapter.videos.length, 0)} Lektionen</p>
      </div>
      <ScrollArea className="m-outline-scroll flex-1 min-h-0">
        {sortedChapters.map((chapter, index) => {
          const isOpen = openChapters.has(chapter.id) || editingChapterId === chapter.id
          const sortedVideos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))
          return (
            <section className="m-chapter" key={chapter.id}>
              <div className="m-admin-chapter-heading">
                {editingChapterId === chapter.id ? (
                  <div className="m-admin-chapter-edit">
                    <input type="text" aria-label="Kapitelname" value={tempChapterName} autoFocus disabled={pendingAction !== null}
                      onChange={event => onTempChapterNameChange(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') { event.preventDefault(); void runAction('rename', onChapterEditSave) }
                        if (event.key === 'Escape' && !pendingAction) { event.preventDefault(); onChapterEditCancel() }
                      }} />
                    <Button variant="ghost" size="icon" className="m-admin-menu" aria-label={pendingAction === 'rename' ? 'Kapitelname wird gespeichert' : 'Kapitelname speichern'} disabled={pendingAction !== null} onClick={() => void runAction('rename', onChapterEditSave)}><Check /></Button>
                    <Button variant="ghost" size="icon" className="m-admin-menu" aria-label="Umbenennen abbrechen" disabled={pendingAction !== null} onClick={onChapterEditCancel}><X /></Button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="m-chapter-toggle" aria-expanded={isOpen}
                      aria-controls={`admin-chapter-${chapter.id}`} onClick={() => toggleChapter(chapter.id)}>
                      <ChevronRight aria-hidden="true" /><span className="m-chapter-name">{chapter.name}</span>
                      <small>{sortedVideos.length}</small>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="m-admin-menu" disabled={pendingAction !== null} aria-label={`Aktionen für Kapitel ${chapter.name}`}><DotsThree /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent container={portalContainer} data-theme={theme} className="mentorship-portal m-admin-popover" align="end">
                        <DropdownMenuItem onSelect={() => void runAction('add-lesson', () => onAddVideo(chapter.id))}><Plus className="mr-2 h-4 w-4" />Lektion hinzufügen</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onChapterEditStart(chapter.id, chapter.name)}><Pencil className="mr-2 h-4 w-4" />Umbenennen</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={index === 0} onSelect={() => void runAction('sort', () => onMoveChapterUp(chapter.id))}><ChevronUp className="mr-2 h-4 w-4" />Nach oben</DropdownMenuItem>
                        <DropdownMenuItem disabled={index === sortedChapters.length - 1} onSelect={() => void runAction('sort', () => onMoveChapterDown(chapter.id))}><ChevronRight className="mr-2 h-4 w-4 rotate-90" />Nach unten</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteDialogChapterId(chapter.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Kapitel löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
              <div id={`admin-chapter-${chapter.id}`} hidden={!isOpen} className="m-chapter-lessons">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => handleVideoDragEnd(event, chapter.id)}>
                  <SortableContext items={sortedVideos.map(video => `video-${video.id}`)} strategy={verticalListSortingStrategy}>
                    {sortedVideos.map(video => (
                      <SortableVideo key={video.id} video={video} isActive={video.id === activeVideoId}
                        onClick={() => onVideoClick(video.id)} durationText={getDurationText(video)}
                        isProcessing={getProcessingInfo(video).isProcessing} isWatched={false} />
                    ))}
                  </SortableContext>
                </DndContext>
                {sortedVideos.length === 0 ? <p className="m-admin-empty">Hier gibt es noch keine Lektionen.</p> : null}
                <Button variant="ghost" className="m-admin-add" disabled={pendingAction !== null} onClick={() => void runAction('add-lesson', () => onAddVideo(chapter.id))}>
                  <Plus className="mr-2 h-4 w-4" />{pendingAction === 'add-lesson' ? 'Lektion wird angelegt …' : 'Lektion hinzufügen'}
                </Button>
              </div>
            </section>
          )
        })}
        <Button variant="outline" className="m-admin-add m-admin-add-chapter" disabled={pendingAction !== null} onClick={() => void runAction('add-chapter', onAddChapter)}>
          <Plus className="mr-2 h-4 w-4" />{pendingAction === 'add-chapter' ? 'Kapitel wird angelegt …' : 'Kapitel hinzufügen'}
        </Button>
      </ScrollArea>
      <AlertDialog open={deleteDialogChapterId !== null} onOpenChange={open => { if (!open) setDeleteDialogChapterId(null) }}>
        <AlertDialogContent container={portalContainer} data-theme={theme} className="mentorship-typography m-admin-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Kapitel löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Kapitel „{sortedChapters.find(chapter => chapter.id === deleteDialogChapterId)?.name}“
              und alle zugehörigen Videos werden dauerhaft gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteDialogChapterId) onDeleteChapter?.(deleteDialogChapterId); setDeleteDialogChapterId(null) }}>Kapitel löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
