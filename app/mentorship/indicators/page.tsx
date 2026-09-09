export const dynamic = 'force-dynamic'
export const revalidate = 0

import { ChartLineUp } from '@/components/mentorship/icons'
import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { Sidebar } from '@/components/Sidebar'
import { IndicatorAdminPanel } from '@/components/indicators/indicator-admin-panel'
import { IndicatorMemberBoard } from '@/components/indicators/indicator-member-board'
import { IndicatorUsageGuide } from '@/components/indicators/indicator-usage-guide'
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

  let content: ReactNode
  if (isAdmin) {
    content = <IndicatorAdminPanel overview={await getIndicatorAdminOverview()} />
  } else {
    const [packages, claims, tradingViewAccount] = await Promise.all([
      listVisibleIndicatorPackages(),
      userId ? listIndicatorClaimsForUser(userId) : [],
      userId ? getTradingViewAccountForUser(userId) : null,
    ])
    // Keep static Markdown on the server; the client only filters and claims indicators.
    const usageGuides = Object.fromEntries(packages.flatMap(pkg => pkg.indicators
      .filter(indicator => indicator.usageGuide)
      .map(indicator => [indicator.id, <IndicatorUsageGuide key={indicator.id} content={indicator.usageGuide} className="mt-3" />])
    ))
    content = <IndicatorMemberBoard packages={packages} claims={claims}
      tradingViewAccount={tradingViewAccount} usageGuides={usageGuides} />
  }

  return (
    <div className="m-workspace">
      <div className="m-desktop-sidebar hidden xl:block">
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
