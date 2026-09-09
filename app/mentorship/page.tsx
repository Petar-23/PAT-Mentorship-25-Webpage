// app/mentorship/page.tsx

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getMentorshipDashboardData } from '@/lib/mentorship-dashboard'
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

export default async function MentorshipDashboard({ searchParams = Promise.resolve({}) }: PageProps) {
  const { userId, sessionClaims } = await auth()
  const isAdminPromise = getIsAdmin(userId ?? undefined, sessionClaims)
  const sidebarDataPromise = getSidebarData()

  const onboardingExpired = isOnboardingVideoExpired()
  const onboardingExpiryLabel = formatOnboardingExpiryLabel(getOnboardingVideoExpiryDate())
  const onboardingVideoIdPromise = onboardingExpired ? Promise.resolve(null) : getOnboardingVideoId()
  const learningPromise = Promise.all([isAdminPromise, sidebarDataPromise]).then(([isAdmin, sidebar]) =>
    getMentorshipDashboardData(isAdmin ? null : userId ?? null, sidebar.kurseForSidebar, sidebar.savedSidebarOrder)
  )

  const [
    resolvedParams,
    isAdmin,
    { kurseForSidebar, pagesForSidebar, savedSidebarOrder },
    learning,
    onboardingVideoId,
  ] = await Promise.all([
    searchParams,
    isAdminPromise,
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
