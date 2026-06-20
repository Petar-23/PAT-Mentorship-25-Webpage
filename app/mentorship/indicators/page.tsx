export const dynamic = 'force-dynamic'
export const revalidate = 0

import { auth } from '@clerk/nextjs/server'
import { ChartLineUp } from '@phosphor-icons/react/dist/ssr/ChartLineUp'
import { Sidebar } from '@/components/Sidebar'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { IndicatorAdminPanel } from '@/components/indicators/indicator-admin-panel'
import { IndicatorMemberBoard } from '@/components/indicators/indicator-member-board'
import { getIsAdmin } from '@/lib/authz'
import { getSidebarData } from '@/lib/sidebar-data'
import {
  getIndicatorAdminOverview,
  getTradingViewAccountForUser,
  listIndicatorClaimsForUser,
  listVisibleIndicatorPackages,
} from '@/lib/indicators/store'

export default async function MentorshipIndicatorsPage() {
  const { userId, sessionClaims } = await auth()
  const isAdminPromise = getIsAdmin(userId ?? undefined, sessionClaims)
  const sidebarDataPromise = getSidebarData()

  const [isAdmin, { kurseForSidebar, pagesForSidebar, savedSidebarOrder }] = await Promise.all([
    isAdminPromise,
    sidebarDataPromise,
  ])

  const content = isAdmin ? (
    <IndicatorAdminPanel overview={await getIndicatorAdminOverview()} />
  ) : (
    <IndicatorMemberBoard
      packages={await listVisibleIndicatorPackages()}
      claims={userId ? await listIndicatorClaimsForUser(userId) : []}
      tradingViewAccount={userId ? await getTradingViewAccountForUser(userId) : null}
    />
  )

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          pages={pagesForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
        />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-10 lg:pb-10">
        <div className="mx-auto w-full max-w-[1920px]">
          <div className="mb-6 flex items-start gap-3 sm:mb-8">
            <MobileCoursesDrawer
              variant="icon"
              kurse={kurseForSidebar}
              pages={pagesForSidebar}
              savedSidebarOrder={savedSidebarOrder}
              isAdmin={isAdmin}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChartLineUp className="h-4 w-4" />
                Mentorship
              </div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-balance sm:text-3xl">
                Indikatoren
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
                {isAdmin
                  ? 'TradingView-Indikatoren importieren, Claims verwalten und Preview-Bilder pflegen.'
                  : 'Claim deine freigegebenen TradingView-Indikatoren direkt für deinen verknüpften Account.'}
              </p>
            </div>
          </div>

          {content}
        </div>
      </main>
    </div>
  )
}
