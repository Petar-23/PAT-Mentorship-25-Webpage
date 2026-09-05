'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft'
import { CaretRight as ChevronRight } from '@phosphor-icons/react/CaretRight'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play } from '@phosphor-icons/react/Play'
import { Check } from '@phosphor-icons/react/Check'

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
  const watchedVideoIdSet = useMemo(() => new Set(watchedVideoIds ?? []), [watchedVideoIds])

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

  const toggleChapter = (chapterId: string) => {
    setOpenChaptersState((prev) => {
      const base = prev.key === openChaptersKey ? prev.chapters : defaultOpenChapters
      const next = new Set(base)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return { key: openChaptersKey, chapters: next }
    })
  }

  return (
    <div className="m-lesson-outline">
      <div className="m-outline-header">
        <Button variant="ghost" size="icon" className="m-icon-button"
          onClick={() => courseId ? router.push(`/mentorship/${courseId}`) : router.back()}
          aria-label="Zurück zur Modulübersicht"><ArrowLeft aria-hidden="true" /></Button>
        <div>
          {courseTitle ? <p>{courseTitle}</p> : null}
          <h1>{modul.name}</h1>
        </div>
      </div>
      {userProgress ? <div className="m-outline-progress">
        <p><span>{userProgress.completedLessons} von {userProgress.totalLessons} Lektionen</span><span>{userProgress.percent}%</span></p>
        <Progress value={userProgress.percent} aria-label="Modulfortschritt" />
      </div> : null}
      <ScrollArea className="flex-1 min-h-0">
        {sortedChapters.map(chapter => {
          const isOpen = openChapters.has(chapter.id)
          const videos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))
          const contentId = `chapter-videos-${chapter.id}`
          return <section className="m-chapter" key={chapter.id}>
            <button type="button" className="m-chapter-toggle" onClick={() => toggleChapter(chapter.id)} aria-expanded={isOpen} aria-controls={contentId}>
              <ChevronRight aria-hidden="true" /><span>{chapter.name}</span><small>{videos.length}</small>
            </button>
            <div id={contentId} hidden={!isOpen}>
              {videos.length ? videos.map((video, index) => {
                const isActive = video.id === activeVideoId
                const isWatched = watchedVideoIdSet.has(video.id)
                return <button key={video.id} type="button" className="m-lesson-row" onClick={() => onVideoClick(video.id)}
                  aria-current={isActive ? 'true' : undefined}>
                  <span className="m-lesson-state" aria-hidden="true">{isActive ? <Play weight="fill" /> : isWatched ? <Check /> : String(index + 1).padStart(2, '0')}</span>
                  <span><span className="block text-xs leading-relaxed">{video.title}</span><span className="block mt-1 text-[10px] text-muted-foreground">{formatDuration(video.duration)}{isWatched ? ' · Abgeschlossen' : ''}</span></span>
                </button>
              }) : <p className="px-3 pb-4 text-xs text-muted-foreground">Die Lektionen folgen hier.</p>}
            </div>
          </section>
        })}
      </ScrollArea>
    </div>
  )
}
