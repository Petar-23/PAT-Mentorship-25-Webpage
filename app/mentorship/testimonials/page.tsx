export const dynamic = 'force-dynamic'
export const revalidate = 0

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Star } from '@phosphor-icons/react/dist/ssr/Star'
import { Sidebar } from '@/components/Sidebar'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getIsAdmin } from '@/lib/authz'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getSidebarData } from '@/lib/sidebar-data'
import {
  approveRaidMapTestimonialAction,
  rejectRaidMapTestimonialAction,
} from './actions'

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400" aria-label={`${rating} von 5 Sternen`}>
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}
      <span className="text-gray-300">{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  )
}

export default async function MentorshipTestimonialsPage() {
  const { userId, sessionClaims } = await auth()
  const isAdminPromise = getIsAdmin(userId ?? undefined, sessionClaims)
  const sidebarDataPromise = getSidebarData()

  const [isAdmin, { kurseForSidebar, pagesForSidebar, savedSidebarOrder }] = await Promise.all([
    isAdminPromise,
    sidebarDataPromise,
  ])

  if (!isAdmin) {
    redirect('/mentorship')
  }

  const testimonials = await withPrismaRetry(
    () => prisma.raidMapTestimonial.findMany({ orderBy: { createdAt: 'desc' } }),
    { label: 'Load raidmap testimonials for review' }
  )

  const groups: { status: string; title: string; empty: string }[] = [
    { status: 'pending', title: 'Wartet auf Review', empty: 'Nichts offen — alles reviewed.' },
    { status: 'approved', title: 'Approved (live auf der Landing)', empty: 'Noch keine freigegeben.' },
    { status: 'rejected', title: 'Rejected', empty: 'Keine abgelehnten.' },
  ]

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
                <Star className="h-4 w-4" />
                Raid Map
              </div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-balance sm:text-3xl">
                Testimonials
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
                Mitglieder-Feedback reviewen: Nur approved Stimmen erscheinen auf der Raid-Map-Landing
                (neueste zuerst, max. 6).
              </p>
            </div>
          </div>

          <div className="space-y-10">
            {groups.map((group) => {
              const rows = testimonials.filter((t) => t.status === group.status)
              return (
                <section key={group.status}>
                  <h2 className="text-lg font-semibold">
                    {group.title}{' '}
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">({rows.length})</span>
                  </h2>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{group.empty}</p>
                  ) : (
                    <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {rows.map((t) => (
                        <Card key={t.id}>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between gap-3">
                              <Stars rating={t.rating} />
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[t.status] ?? 'bg-gray-100 text-gray-800'}`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-pretty whitespace-pre-line">{t.text}</p>
                            <p className="mt-3 text-sm font-semibold">{t.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground break-all">
                              {t.userId} · {t.createdAt.toLocaleDateString('de-DE')}
                              {t.reviewedAt ? ` · reviewed ${t.reviewedAt.toLocaleDateString('de-DE')}` : ''}
                            </p>
                            <div className="mt-4 flex gap-2">
                              {t.status !== 'approved' ? (
                                <form action={approveRaidMapTestimonialAction.bind(null, t.id)}>
                                  <Button type="submit" size="sm">
                                    Freigeben
                                  </Button>
                                </form>
                              ) : null}
                              {t.status !== 'rejected' ? (
                                <form action={rejectRaidMapTestimonialAction.bind(null, t.id)}>
                                  <Button type="submit" size="sm" variant="outline">
                                    Ablehnen
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
