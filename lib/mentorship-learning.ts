type Ordered = { id: string; order: number; createdAt?: Date | string }

export type LearningVideo = Ordered & {
  title: string
  bunnyGuid: string | null
  pdfUrl: string | null
  duration: number | null
}

export type LearningModule = Ordered & {
  name: string
  chapters: Array<Ordered & { videos: LearningVideo[] }>
}

export type LearningCourse = { id: string; name: string; modules: LearningModule[] }

type ProgressCounts = { completedLessons: number; totalLessons: number; percent: number }

export type LearningTarget = ProgressCounts & { courseId: string; courseName: string } & (
  | {
      kind: 'lesson'
      reason: 'last-opened' | 'next' | 'gap' | 'next-module' | 'start'
      moduleId: string
      moduleName: string
      videoId: string
      videoTitle: string
      position: number
      duration: number | null
      isPdf: boolean
    }
  | { kind: 'waiting'; moduleId: string | null; moduleName: string | null; hasAvailableLessons: boolean }
  | { kind: 'completed' }
)

export type CourseLearningProgress = {
  id: string
  name: string
  modulesLength: number
  totalLessons: number
  completedLessons: number | null
  percent: number | null
}

export type NewLearningContent = {
  videoId: string
  videoTitle: string
  moduleId: string
  moduleName: string
  courseName: string
  addedAt: string
  watched: boolean
  isPdf: boolean
}

export function learningPercent(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(completed)) return 0
  if (completed === total) return 100
  return Math.max(0, Math.min(99, Math.round((completed / total) * 100)))
}

export function formatLearningDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null
  const minutes = Math.ceil(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0
    ? `${hours} Std.${remainder ? ` ${remainder} Min.` : ''}`
    : `${minutes} Min.`
}

// Material presence is enough for a recommendation; it does not certify video encoding/readiness.
export function hasLearningMaterial(video: { bunnyGuid: string | null; pdfUrl: string | null }): boolean {
  return Boolean(video.bunnyGuid?.trim() || video.pdfUrl?.trim())
}

function compareOrder(a: Ordered, b: Ordered): number {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
  return a.order - b.order || timeA - timeB || a.id.localeCompare(b.id)
}

/** Select only within this course. All lesson rows, including placeholders, count toward completion. */
export function selectLearningTarget(
  course: LearningCourse,
  watchedIds: ReadonlySet<string>,
  lastVideoId: string | null = null,
): LearningTarget {
  const modules = [...course.modules].sort(compareOrder).map(module => ({
    ...module,
    videos: [...module.chapters].sort(compareOrder).flatMap(chapter => [...chapter.videos].sort(compareOrder)),
  }))
  const allVideos = modules.flatMap(module => module.videos)
  const counts = (videos: LearningVideo[]): ProgressCounts => {
    const completedLessons = videos.filter(video => watchedIds.has(video.id)).length
    return { completedLessons, totalLessons: videos.length, percent: learningPercent(completedLessons, videos.length) }
  }
  const courseInfo = { courseId: course.id, courseName: course.name }
  const open = (video: LearningVideo) => !watchedIds.has(video.id) && hasLearningMaterial(video)
  const lesson = (moduleIndex: number, video: LearningVideo, reason: Extract<LearningTarget, { kind: 'lesson' }>['reason']): LearningTarget => {
    const learningModule = modules[moduleIndex]
    return {
      ...courseInfo, ...counts(learningModule.videos), kind: 'lesson', reason,
      moduleId: learningModule.id, moduleName: learningModule.name, videoId: video.id, videoTitle: video.title,
      position: learningModule.videos.findIndex(item => item.id === video.id) + 1,
      duration: video.duration, isPdf: !video.bunnyGuid?.trim() && Boolean(video.pdfUrl?.trim()),
    }
  }
  const currentModuleIndex = modules.findIndex(module => module.videos.some(video => video.id === lastVideoId))

  if (currentModuleIndex >= 0) {
    const current = modules[currentModuleIndex]
    const index = current.videos.findIndex(video => video.id === lastVideoId)
    const last = current.videos[index]
    if (open(last)) return lesson(currentModuleIndex, last, 'last-opened')
    const next = current.videos.slice(index + 1).find(open)
    if (next) return lesson(currentModuleIndex, next, 'next')
    const gap = current.videos.slice(0, index).find(open)
    if (gap) return lesson(currentModuleIndex, gap, 'gap')
    for (let i = currentModuleIndex + 1; i < modules.length; i++) {
      const video = modules[i].videos.find(open)
      if (video) return lesson(i, video, 'next-module')
    }
    for (let i = 0; i < currentModuleIndex; i++) {
      const video = modules[i].videos.find(open)
      if (video) return lesson(i, video, 'gap')
    }
  } else {
    for (let i = 0; i < modules.length; i++) {
      const video = modules[i].videos.find(open)
      if (video) return lesson(i, video, watchedIds.size ? 'next' : 'start')
    }
  }

  const courseCounts = counts(allVideos)
  if (courseCounts.totalLessons > 0 && courseCounts.completedLessons === courseCounts.totalLessons) {
    return { ...courseInfo, ...courseCounts, kind: 'completed' }
  }
  const waitingModule = modules.find(module => module.videos.some(video => !watchedIds.has(video.id)))
    ?? modules.find(module => module.videos.length === 0) ?? modules[0]
  return {
    ...courseInfo, ...(waitingModule ? counts(waitingModule.videos) : courseCounts), kind: 'waiting',
    moduleId: waitingModule?.id ?? null, moduleName: waitingModule?.name ?? null,
    hasAvailableLessons: allVideos.some(hasLearningMaterial),
  }
}
