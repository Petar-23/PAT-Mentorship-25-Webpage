// app/mentorship/page.tsx


import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getMentorshipDashboardData } from '@/lib/mentorship-dashboard'
import { MentorshipHomeContent } from '@/components/mentorship/home-content'
import { Sidebar } from '@/components/Sidebar'
import { OnboardingWelcomeCard } from '@/components/mentorship/onboarding-welcome-card'
import { getSidebarData } from '@/lib/sidebar-data'
import { ONBOARDING_VIDEO_SETTING_KEY, parseOnboardingVideoSetting } from '@/lib/onboarding-video'
import { getOnboardingVideoExpiryDate, isOnboardingVideoExpired } from '@/lib/onboarding-video-expiry'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  userId: string | null
  isAdmin: boolean
  searchParams?: Promise<SearchParams> | undefined
}

function formatOnboardingExpiryLabel(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(date)
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

export async function MentorshipHomeView({ userId, isAdmin, searchParams = Promise.resolve({}) }: PageProps) {
  const sidebarDataPromise = getSidebarData()

  const onboardingExpired = isOnboardingVideoExpired()
  const onboardingExpiryLabel = formatOnboardingExpiryLabel(getOnboardingVideoExpiryDate())
  const onboardingVideoIdPromise = onboardingExpired ? Promise.resolve(null) : getOnboardingVideoId()
  const learningPromise = sidebarDataPromise.then(sidebar =>
    getMentorshipDashboardData(isAdmin ? null : userId ?? null, sidebar.kurseForSidebar, sidebar.savedSidebarOrder)
  )

  const [
    resolvedParams,
    { kurseForSidebar, pagesForSidebar, savedSidebarOrder },
    learning,
    onboardingVideoId,
  ] = await Promise.all([
    searchParams,
    sidebarDataPromise,
    learningPromise,
    onboardingVideoIdPromise,
  ])
  const create = typeof resolvedParams.create === 'string' ? resolvedParams.create : undefined
  const openCreateCourseModal = create === '1' || create === 'true'

  return (
    <div className="m-workspace">
      <div className="m-desktop-sidebar hidden xl:block">
        <Sidebar kurse={kurseForSidebar} pages={pagesForSidebar} savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin} openCreateCourseModal={isAdmin && openCreateCourseModal} />
      </div>
      <div className="m-page-scroll">
        <MentorshipHomeContent {...learning}
          onboarding={!onboardingExpired && onboardingVideoId ? <div className="mb-6"><OnboardingWelcomeCard
            key={onboardingVideoId} videoId={onboardingVideoId} expiresAtLabel={onboardingExpiryLabel} /></div> : null}
        />
      </div>
    </div>
  )
}
