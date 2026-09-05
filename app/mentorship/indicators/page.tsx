export const dynamic = 'force-dynamic'
export const revalidate = 0

import { auth } from '@clerk/nextjs/server'
import { ChartLineUp } from '@phosphor-icons/react/dist/ssr/ChartLineUp'
import { Sidebar } from '@/components/Sidebar'
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
      <div className={isAdmin ? "hidden lg:block" : "hidden xl:block"}>
        <Sidebar
          kurse={kurseForSidebar}
          pages={pagesForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
        />
      </div>

      <div className="m-page-scroll">
        <div className="m-page">
          <div className="m-page-header">

            <div className="min-w-0 flex-1">
              <div className="m-eyebrow flex items-center gap-2">
                <ChartLineUp className="h-4 w-4" />
                Mentorship
              </div>
              <h1 className="m-page-title">
                Indikatoren
              </h1>
              <p className="m-page-intro">
                {isAdmin
                  ? 'TradingView-Indikatoren importieren, Claims verwalten und Preview-Bilder pflegen.'
                  : 'Deine Werkzeuge für einen klareren Blick auf den Chart. Direkt mit deinem TradingView-Account verbinden.'}
              </p>
            </div>
          </div>

          {content}
        </div>
      </div>
    </div>
  )
}
