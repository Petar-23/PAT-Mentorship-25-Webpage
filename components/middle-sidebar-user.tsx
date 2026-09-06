'use client'

import { MentorshipLink } from '@/components/mentorship/navigation-link'

import { ArrowLeft, CaretRight as ChevronRight, FileText, Play, Check } from '@/components/mentorship/icons'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { useMemo, useState, type CSSProperties } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { useRouter } from 'next/navigation'
import { formatLearningDuration } from '@/lib/mentorship-learning'

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
  const [presentLessons, setPresentLessons] = useState(true)
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

  return (
    <div className="m-lesson-outline" data-present={presentLessons} onFocusCapture={() => setPresentLessons(false)}>
      <div className="m-outline-header">
        {courseId ? <MentorshipLink href={`/mentorship/${courseId}`} className="m-outline-back"
          aria-label={courseTitle ? `Zurück zur Modulübersicht von ${courseTitle}` : 'Zurück zur Modulübersicht'}>
          <ArrowLeft aria-hidden="true" /><span>{courseTitle || 'Modulübersicht'}</span>
        </MentorshipLink> : <button type="button" className="m-outline-back" onClick={() => router.back()} aria-label="Zurück zur Modulübersicht">
          <ArrowLeft aria-hidden="true" /><span>Modulübersicht</span>
        </button>}
        <h1>{modul.name}</h1>
      </div>
      {userProgress ? <div className="m-outline-progress">
        <p><span>{userProgress.completedLessons} von {userProgress.totalLessons} Lektionen</span><span>{userProgress.percent}%</span></p>
        <Progress value={userProgress.percent} aria-label={`Fortschritt im Modul ${modul.name}`} />
      </div> : null}
      <ScrollArea className="m-outline-scroll flex-1 min-h-0">
        <Accordion.Root type="multiple" value={Array.from(openChapters)}
          onValueChange={(chapters) => {
            setPresentLessons(false)
            setOpenChaptersState({ key: openChaptersKey, chapters: new Set(chapters) })
          }}>
        {sortedChapters.map((chapter, chapterIndex) => {
          const lessonOffset = sortedChapters.slice(0, chapterIndex).reduce((sum, item) => sum + item.videos.length, 0)
          const isOpen = openChapters.has(chapter.id)
          const videos = [...chapter.videos].sort((a, b) => (a.order || 0) - (b.order || 0))
          const contentId = `chapter-videos-${chapter.id}`
          return <Accordion.Item asChild value={chapter.id} key={chapter.id}><section className="m-chapter">
            <Accordion.Header className="m-chapter-heading" style={{ '--m-chapter-delay': `${60 + Math.min(chapterIndex, 4) * 35}ms` } as CSSProperties}><Accordion.Trigger asChild>
            <button type="button" className="m-chapter-toggle" aria-expanded={isOpen} aria-controls={contentId}>
              <span className="m-chapter-name">{chapter.name}</span><small>{videos.length}<span className="sr-only"> {videos.length === 1 ? 'Lektion' : 'Lektionen'}</span></small><ChevronRight aria-hidden="true" />
            </button>
            </Accordion.Trigger></Accordion.Header>
            <Accordion.Content className="m-chapter-reveal" id={contentId}>
            <div className="m-chapter-lessons">
              {videos.length ? videos.map((video, index) => {
                const isActive = video.id === activeVideoId
                const isWatched = watchedVideoIdSet.has(video.id)
                const isPdf = !video.bunnyGuid?.trim() && Boolean(video.pdfUrl?.trim())
                const detail = isPdf ? 'PDF' : formatLearningDuration(video.duration)
                return <button key={video.id} type="button" className="m-lesson-row"
                  style={{ '--m-lesson-delay': `${100 + Math.min(index, 5) * 35}ms` } as CSSProperties}
                  onClick={() => { setPresentLessons(false); onVideoClick(video.id) }}
                  aria-current={isActive ? 'true' : undefined} data-completed={isWatched} data-has-detail={Boolean(detail)} title={video.title}>
                  <span className="m-lesson-state" aria-hidden="true">{isActive ? isPdf ? <FileText /> : <Play /> : isWatched ? <Check /> : String(lessonOffset + index + 1).padStart(2, '0')}</span>
                  <span className="m-lesson-copy"><span className="m-lesson-title">{video.title}</span>{isWatched ? <span className="sr-only"> · Abgeschlossen</span> : null}</span>
                  {detail ? <span className="m-lesson-meta">{detail}</span> : null}
                </button>
              }) : <p className="px-3 pb-4 text-xs text-muted-foreground">Die Lektionen folgen hier.</p>}
            </div>
            </Accordion.Content>
          </section></Accordion.Item>
        })}
        </Accordion.Root>
      </ScrollArea>
    </div>
  )
}
