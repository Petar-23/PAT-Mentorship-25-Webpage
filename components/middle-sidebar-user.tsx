'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import Image from 'next/image'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Film } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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

export type MiddleSidebarProps = {
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
  // Admin-Props werden für User ignoriert (werden aber weiterhin vom Parent übergeben)
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
  isWatched,
}: {
  bunnyGuid: string | null
  title: string
  isWatched?: boolean
}) {
  const [errorGuid, setErrorGuid] = useState<string | null>(null)
  const hasError = Boolean(bunnyGuid && errorGuid === bunnyGuid)

  const showWatchedOverlay = Boolean(isWatched)

  return (
    <div className="relative w-24 h-14 flex-shrink-0 cursor-pointer">
      {!bunnyGuid || hasError ? (
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
          referrerPolicy="origin"
          unoptimized
          onError={() => setErrorGuid(bunnyGuid)}
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

function VideoRow({
  video,
  isActive,
  onClick,
  durationText,
  isWatched,
}: {
  video: Video
  isActive: boolean
  onClick: () => void
  durationText: string
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
      <VideoThumbnail bunnyGuid={video.bunnyGuid} title={video.title} isWatched={isWatched} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
          {video.title}
        </p>
        <p className="text-xs text-muted-foreground">{durationText}</p>
      </div>
    </div>
  )
}

export function MiddleSidebarUser({
  modul,
  courseTitle,
  courseId,
  activeVideoId,
  onVideoClick,
  userProgress,
  watchedVideoIds,
}: MiddleSidebarProps) {
  const router = useRouter()

  const sortedChapters = useMemo(() => {
    return [...(modul.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [modul.chapters])

  const [openChapters, setOpenChapters] = useState<Set<string>>(
    new Set(sortedChapters.map((ch) => ch.id))
  )

  // Durations (leicht, ohne aggressive Retries)
  const bunnyGuids = useMemo(() => {
    const guids = sortedChapters
      .flatMap((ch) => ch.videos)
      .map((v) => v.bunnyGuid)
      .filter((g): g is string => typeof g === 'string' && g.length > 0)
    return Array.from(new Set(guids))
  }, [sortedChapters])

  const [videoDurations, setVideoDurations] = useState<Record<string, number | null>>({})

  useEffect(() => {
    let cancelled = false

    const missing = bunnyGuids.filter((guid) => videoDurations[guid] === undefined)
    if (missing.length === 0) return

    const fetchGuids = async (guids: string[]) => {
      const results = await Promise.all(
        guids.map(async (guid) => {
          try {
            const res = await fetch(`/api/videos/duration/${guid}`)
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

    void fetchGuids(missing)

    return () => {
      cancelled = true
    }
  }, [bunnyGuids, videoDurations])

  const toggleChapter = (chapterId: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const getDurationText = (video: Video) => {
    if (!video.bunnyGuid) return '—'
    const seconds = videoDurations[video.bunnyGuid]
    if (seconds === undefined) return 'Lädt...'
    if (seconds === null) return '—'
    return formatDuration(seconds)
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
          {courseTitle ? <p className="text-xs text-muted-foreground truncate">{courseTitle}</p> : null}
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">{modul.name}</h1>
        </div>
      </div>

      {userProgress ? (
        <Card className="mb-6 border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Fortschritt</p>
                <p className="text-xs text-muted-foreground">
                  {userProgress.completedLessons} von {userProgress.totalLessons} Lektionen abgeschlossen
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

      <ScrollArea className="flex-1 min-h-0 pb-2 sm:pb-4">
        <div className="space-y-2 pr-2">
          {sortedChapters.map((chapter) => {
            const isOpen = openChapters.has(chapter.id)
            const sortedVideos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))

            return (
              <Card className="border border-border shadow-sm" key={chapter.id}>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between select-none">
                    <div className="flex items-center space-x-3 flex-1">
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

                      <h3 className="text-md font-bold truncate flex-1 px-2 py-1 rounded select-text">
                        {chapter.name}
                      </h3>
                    </div>
                  </div>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-3 border-t border-border pt-2">
                        {sortedVideos.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">Noch keine Videos</div>
                        ) : (
                          sortedVideos.map((video) => {
                            const isWatched = Boolean(watchedVideoIds?.includes(video.id))
                            return (
                              <VideoRow
                                key={video.id}
                                video={video}
                                isActive={video.id === activeVideoId}
                                onClick={() => onVideoClick(video.id)}
                                durationText={getDurationText(video)}
                                isWatched={isWatched}
                              />
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}


