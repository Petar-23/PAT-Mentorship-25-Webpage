import 'server-only'
import { isTransientDbConnectionError, prisma, withPrismaRetry } from '@/lib/prisma'
import type { SidebarKurs } from '@/lib/sidebar-data'
import { hasLearningMaterial, learningPercent, selectLearningTarget } from '@/lib/mentorship-learning'
import type { CourseLearningProgress, LearningTarget, NewLearningContent } from '@/lib/mentorship-learning'

async function getLastOpenedVideo(userId: string) {
  try {
    const state = await withPrismaRetry(() => prisma.userPlaybackState.findUnique({
      where: { userId },
      select: { lastVideo: { select: { id: true, chapter: { select: { module: { select: { playlistId: true } } } } } } },
    }), { label: 'Load playback state' })
    return state?.lastVideo ?? null
  } catch (error) {
    if (isTransientDbConnectionError(error)) throw error
    // Retain the existing fallback while older installations lack playback-state storage.
    return null
  }
}

async function getLearningCourse(id: string) {
  return withPrismaRetry(() => prisma.playlist.findUnique({
    where: { id },
    select: {
      id: true, name: true,
      modules: { select: {
        id: true, name: true, order: true, createdAt: true,
        chapters: { select: {
          id: true, order: true, createdAt: true,
          videos: { select: {
            id: true, title: true, order: true, createdAt: true,
            bunnyGuid: true, pdfUrl: true, duration: true,
          } },
        } },
      } },
    },
  }), { label: 'Load learning course' })
}

export async function getMentorshipDashboardData(
  userId: string | null,
  courses: SidebarKurs[],
  savedOrder: string[] | null,
): Promise<{ courses: CourseLearningProgress[]; continueLearning: LearningTarget | null; newContent: NewLearningContent[] }> {
  const courseIds = courses.map(course => course.id)
  const [chapters, totals, watched, lastOpened, recent] = await withPrismaRetry(() => Promise.all([
    prisma.chapter.findMany({
      where: { module: { playlistId: { in: courseIds } } },
      select: { id: true, module: { select: { playlistId: true } } },
    }),
    prisma.video.groupBy({
      by: ['chapterId'], where: { chapter: { module: { playlistId: { in: courseIds } } } }, _count: { _all: true },
    }),
    userId ? prisma.videoProgress.findMany({
      where: { userId, watched: true, video: { chapter: { module: { playlistId: { in: courseIds } } } } },
      orderBy: [{ watchedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      select: { videoId: true, video: { select: { id: true, chapter: { select: { module: { select: { playlistId: true } } } } } } },
    }) : Promise.resolve([]),
    userId ? getLastOpenedVideo(userId) : Promise.resolve(null),
    prisma.video.findMany({
      where: {
        chapter: { module: { playlistId: { in: courseIds } } },
        OR: [
          { AND: [{ bunnyGuid: { not: null } }, { bunnyGuid: { not: '' } }] },
          { AND: [{ pdfUrl: { not: null } }, { pdfUrl: { not: '' } }] },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 4,
      select: {
        id: true, title: true, createdAt: true, bunnyGuid: true, pdfUrl: true,
        chapter: { select: { module: { select: { id: true, name: true, playlist: { select: { name: true } } } } } },
      },
    }),
  ]), { label: 'Load mentorship learning overview' })

  const courseByChapter = new Map(chapters.map(chapter => [chapter.id, chapter.module.playlistId]))
  const totalByCourse = new Map<string, number>()
  for (const row of totals) {
    const courseId = courseByChapter.get(row.chapterId)
    if (courseId) totalByCourse.set(courseId, (totalByCourse.get(courseId) ?? 0) + row._count._all)
  }
  const completedByCourse = new Map<string, number>()
  for (const row of watched) {
    const courseId = row.video.chapter.module.playlistId
    completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1)
  }
  const order = new Map((savedOrder ?? []).map((id, index) => [id, index]))
  const compareSavedOrder = (a: SidebarKurs, b: SidebarKurs) =>
    (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size)
  const orderedCourses = [...courses].sort(compareSavedOrder)
  const courseProgress = orderedCourses.map(course => {
    const totalLessons = totalByCourse.get(course.id) ?? 0
    const completedLessons = userId ? completedByCourse.get(course.id) ?? 0 : null
    return {
      id: course.id, name: course.name, modulesLength: course.modulesLength, totalLessons, completedLessons,
      percent: completedLessons === null ? null : learningPercent(completedLessons, totalLessons),
    }
  })

  const watchedIds = new Set(watched.map(row => row.videoId))
  const lastVideo = lastOpened ?? watched[0]?.video ?? null
  let continueLearning: LearningTarget | null = null
  const focusCourseId = lastVideo?.chapter.module.playlistId
  if (userId && focusCourseId && courseIds.includes(focusCourseId)) {
    const course = await getLearningCourse(focusCourseId)
    if (course) continueLearning = selectLearningTarget(course, watchedIds, lastVideo.id)
  }
  if (userId && !continueLearning) {
    // Sidebar input is newest-first. Without a saved order the learning start is the oldest course.
    const startCourses = [...courses].reverse().sort(compareSavedOrder)
    for (const item of startCourses) {
      const course = await getLearningCourse(item.id)
      if (!course) continue
      const target = selectLearningTarget(course, watchedIds)
      continueLearning ??= target
      if (target.kind === 'lesson') { continueLearning = target; break }
    }
  }

  const resumeId = continueLearning?.kind === 'lesson' ? continueLearning.videoId : null
  const newContent = recent.filter(video => video.id !== resumeId && hasLearningMaterial(video)).slice(0, 3).map(video => ({
    videoId: video.id, videoTitle: video.title, moduleId: video.chapter.module.id,
    moduleName: video.chapter.module.name, courseName: video.chapter.module.playlist.name,
    addedAt: video.createdAt.toISOString(), watched: watchedIds.has(video.id),
    isPdf: !video.bunnyGuid?.trim() && Boolean(video.pdfUrl?.trim()),
  }))
  return { courses: courseProgress, continueLearning, newContent }
}
