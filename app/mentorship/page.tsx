// app/mentorship/page.tsx

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { isTransientDbConnectionError, prisma, withPrismaRetry } from '@/lib/prisma'
import { MentorshipHomeContent } from '@/components/mentorship/home-content'
import { Sidebar } from '@/components/Sidebar'
import { getIsAdmin } from '@/lib/authz'
import { auth } from '@clerk/nextjs/server'
import { OnboardingWelcomeCard } from '@/components/mentorship/onboarding-welcome-card'
import { getSidebarData } from '@/lib/sidebar-data'
import { ONBOARDING_VIDEO_SETTING_KEY, parseOnboardingVideoSetting } from '@/lib/onboarding-video'
import { getOnboardingVideoExpiryDate, isOnboardingVideoExpired } from '@/lib/onboarding-video-expiry'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  searchParams?: Promise<SearchParams> | undefined
}

type ContinueLearning = {
  videoId: string
  videoTitle: string
  moduleId: string
  moduleName: string
  courseId: string | null
  courseName: string | null
  watchedLessons: number
  totalLessons: number
  percent: number
} | null

type NewContentItem = {
  videoId: string
  videoTitle: string
  moduleId: string
  moduleName: string
  courseName: string | null
}

function formatOnboardingExpiryLabel(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(date)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function getContinueLearning(userId: string | null, isAdmin: boolean): Promise<ContinueLearning> {
  if (!userId || isAdmin) return null

  // 1) Prefer: zuletzt angesehen (sehr präzise fürs "Weiter machen")
  let lastViewedVideo:
    | {
        id: string
        title: string
        chapter: {
          module: {
            id: string
            name: string
            playlist: { id: string; name: string } | null
          }
        }
      }
    | null = null

  try {
    const state = await withPrismaRetry(
      () =>
        prisma.userPlaybackState.findUnique({
          where: { userId },
          select: {
            lastVideo: {
              select: {
                id: true,
                title: true,
                chapter: {
                  select: {
                    module: {
                      select: {
                        id: true,
                        name: true,
                        playlist: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      { label: 'Load playback state' }
    )

    if (state?.lastVideo) {
      lastViewedVideo = {
        id: state.lastVideo.id,
        title: state.lastVideo.title,
        chapter: {
          module: {
            id: state.lastVideo.chapter.module.id,
            name: state.lastVideo.chapter.module.name,
            playlist: state.lastVideo.chapter.module.playlist,
          },
        },
      }
    }
  } catch (error) {
    if (isTransientDbConnectionError(error)) throw error
    // Falls die Migration noch nicht gelaufen ist, soll das Dashboard trotzdem funktionieren.
    lastViewedVideo = null
  }

  // 2) Fallback: zuletzt abgeschlossenes Video
  const lastWatched = lastViewedVideo
    ? null
    : await withPrismaRetry(
        () =>
          prisma.videoProgress.findFirst({
            where: { userId, watched: true },
            orderBy: [{ watchedAt: 'desc' }, { updatedAt: 'desc' }],
            select: {
              video: {
                select: {
                  id: true,
                  title: true,
                  chapter: {
                    select: {
                      module: {
                        select: {
                          id: true,
                          name: true,
                          playlist: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        { label: 'Load last watched video' }
      )

  const video = lastViewedVideo ?? lastWatched?.video ?? null
  if (!video) return null

  const moduleId = video.chapter.module.id

  const [totalLessons, watchedLessons] = await withPrismaRetry(
    () =>
      Promise.all([
        prisma.video.count({
          where: { chapter: { moduleId } },
        }),
        prisma.videoProgress.count({
          where: { userId, watched: true, video: { chapter: { moduleId } } },
        }),
      ]),
    { label: 'Load learning progress counts' }
  )

  const percent = totalLessons > 0 ? clampPercent((watchedLessons / totalLessons) * 100) : 0
  const mod = video.chapter.module

  return {
    videoId: video.id,
    videoTitle: video.title,
    moduleId: mod.id,
    moduleName: mod.name,
    courseId: mod.playlist?.id ?? null,
    courseName: mod.playlist?.name ?? null,
    watchedLessons,
    totalLessons,
    percent,
  }
}

async function getNewContent(limit: number): Promise<NewContentItem[]> {
  const videos = await withPrismaRetry(
    () =>
      prisma.video.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          chapter: {
            select: {
              module: {
                select: {
                  id: true,
                  name: true,
                  playlist: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    { label: 'Load new mentorship content' }
  )

  return videos.map((v) => ({
    videoId: v.id,
    videoTitle: v.title,
    moduleId: v.chapter.module.id,
    moduleName: v.chapter.module.name,
    courseName: v.chapter.module.playlist?.name ?? null,
  }))
}


async function getOnboardingVideoId(): Promise<string | null> {
  const setting = await withPrismaRetry(
    () =>
      prisma.adminSetting.findUnique({
        where: { key: ONBOARDING_VIDEO_SETTING_KEY },
        select: { value: true },
      }),
    { label: 'Load onboarding video setting' }
  )

  const parsed = parseOnboardingVideoSetting(setting?.value)
  return parsed.videoId
}

export default async function MentorshipDashboard({ searchParams = Promise.resolve({}) }: PageProps) {
  const { userId, sessionClaims } = await auth()
  const isAdminPromise = getIsAdmin(userId ?? undefined, sessionClaims)
  const sidebarDataPromise = getSidebarData()
  const newContentPromise = getNewContent(3)

  const onboardingExpired = isOnboardingVideoExpired()
  const onboardingExpiryLabel = formatOnboardingExpiryLabel(getOnboardingVideoExpiryDate())
  const onboardingVideoIdPromise = onboardingExpired ? Promise.resolve(null) : getOnboardingVideoId()
  const continueLearningPromise = isAdminPromise.then((isAdmin) =>
    getContinueLearning(userId ?? null, isAdmin)
  )

  const [
    resolvedParams,
    isAdmin,
    { kurseForSidebar, pagesForSidebar, savedSidebarOrder },
    continueLearning,
    newContent,
    onboardingVideoId,
  ] = await Promise.all([
    searchParams,
    isAdminPromise,
    sidebarDataPromise,
    continueLearningPromise,
    newContentPromise,
    onboardingVideoIdPromise,
  ])
  const create = typeof resolvedParams.create === 'string' ? resolvedParams.create : undefined
  const openCreateCourseModal = create === '1' || create === 'true'

  const courseOrder = new Map((savedSidebarOrder ?? []).map((id, index) => [id, index]))
  const unsortedCoursePosition = savedSidebarOrder?.length ?? 0
  const orderedCourses = [...kurseForSidebar].sort((a, b) =>
    (courseOrder.get(a.id) ?? unsortedCoursePosition) - (courseOrder.get(b.id) ?? unsortedCoursePosition)
  )

  return (
    <div className="flex h-full min-h-0">
      <div className={isAdmin ? "hidden lg:block" : "hidden xl:block"}>
        <Sidebar kurse={kurseForSidebar} pages={pagesForSidebar} savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin} openCreateCourseModal={isAdmin && openCreateCourseModal} />
      </div>
      <div className="m-page-scroll">
        <MentorshipHomeContent courses={orderedCourses} continueLearning={continueLearning} newContent={newContent}
          onboarding={!onboardingExpired && onboardingVideoId ? <div className="mb-6"><OnboardingWelcomeCard
            key={onboardingVideoId} videoId={onboardingVideoId} expiresAtLabel={onboardingExpiryLabel} /></div> : null}
        />
      </div>
    </div>
  )
}
