'use client'

import { BookOpen, BookBookmark, CalendarDots, ChartLineUp, FileText, House, Users, Stack, Strategy, SlidersHorizontal, CreditCard, UserCircle } from '@/components/mentorship/icons'
import { MentorshipLink as Link } from '@/components/mentorship/navigation-link'
import { usePathname } from 'next/navigation'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { useMentorshipNavigation } from '@/components/mentorship/shell'
import { Fragment } from 'react'

type Kurs = {
  id: string
  name: string
  slug: string
  modulesLength: number
  description?: string | null
  iconUrl?: string | null
}
type Page = { id: string; title: string; slug: string; description?: string | null; iconUrl?: string | null }
type Props = {
  kurse: Kurs[]
  pages?: Page[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
  onNavigate?: () => void
}

function courseIcon(slug: string) {
  switch (slug) {
    case 'weekly-reviews': return CalendarDots
    case 'daily-reviews': return ChartLineUp
    case 'advanced-content': return Stack
    case '03---model-series': return Strategy
    default: return BookOpen
  }
}

export function SidebarUser({ kurse, pages = [], savedSidebarOrder, activeCourseId, onNavigate }: Props) {
  const pathname = usePathname()
  const navigationOpen = useMentorshipNavigation()
  const hidden = !onNavigate && !navigationOpen
  const items = [
    { id: 'discord', title: 'Community', href: '/mentorship/discord', Icon: Users, group: 'resources' },
    { id: 'indicators', title: 'Indikatoren', href: '/mentorship/indicators', Icon: SlidersHorizontal, group: 'tools' },
    ...kurse.map(kurs => ({ id: kurs.id, title: kurs.name, href: `/mentorship/${kurs.id}`, Icon: courseIcon(kurs.slug), group: 'series' })),
    ...pages.map(page => ({ id: `page:${page.id}`, title: page.title, href: `/mentorship/page/${page.slug}`, Icon: page.slug === 'glossar' ? BookBookmark : FileText, group: 'resources' })),
  ]
  if (savedSidebarOrder) {
    const order = new Map(savedSidebarOrder.map((id, index) => [id, index]))
    items.sort((a, b) => (order.get(a.id) ?? savedSidebarOrder.length) - (order.get(b.id) ?? savedSidebarOrder.length))
  }

  return (
    <aside className="m-sidebar" id={onNavigate ? undefined : 'mentorship-desktop-navigation'}
      aria-label="Mentorship-Navigation" aria-hidden={hidden || undefined}
      ref={element => { if (element) element.inert = hidden }}>
      <nav className="m-nav">
        <Link href="/mentorship" className="m-nav-link m-nav-home" aria-current={pathname === '/mentorship' ? 'page' : undefined} onNavigate={onNavigate}>
          <House aria-hidden="true" /><span>Übersicht</span>
        </Link>
        <p className="m-nav-label">Inhalte</p>
        <div className="m-nav-items">
          {items.map(({ id, title, href, Icon, group }, index) => (
            <Fragment key={id}>
            {onNavigate && index > 0 && group !== items[index - 1].group ? <hr className="m-nav-divider" aria-hidden="true" /> : null}
            <Link href={href} prefetch={false} className="m-nav-link" onNavigate={onNavigate}
              aria-current={pathname === href || (activeCourseId === id && pathname?.startsWith('/mentorship/modul/')) ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{title}</span>
            </Link>
            </Fragment>
          ))}
        </div>
      </nav>
      <div className="m-sidebar-footer">
        <ManageSubscriptionButton variant="ghost" label="Mitgliedschaft" className="m-account-link" icon={<CreditCard aria-hidden="true" />} />
        <Link href="/dashboard" prefetch={false} className="m-account-link" onNavigate={onNavigate}><UserCircle aria-hidden="true" /><span>Mein Konto</span></Link>
      </div>
    </aside>
  )
}
