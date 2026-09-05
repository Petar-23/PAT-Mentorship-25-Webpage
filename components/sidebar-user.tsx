'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BookOpen } from '@phosphor-icons/react/BookOpen'
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp'
import { FileText } from '@phosphor-icons/react/FileText'
import { House } from '@phosphor-icons/react/House'
import { Users } from '@phosphor-icons/react/Users'
import { ArrowUpRight } from '@phosphor-icons/react/ArrowUpRight'
import { usePathname } from 'next/navigation'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'

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

export function SidebarUser({ kurse, pages = [], savedSidebarOrder, activeCourseId, onNavigate }: Props) {
  const pathname = usePathname()
  const items = [
    { id: 'discord', title: 'Community', href: '/mentorship/discord', Icon: Users, iconUrl: null, count: null },
    { id: 'indicators', title: 'Indikatoren', href: '/mentorship/indicators', Icon: ChartLineUp, iconUrl: null, count: null },
    ...kurse.map(kurs => ({ id: kurs.id, title: kurs.name, href: `/mentorship/${kurs.id}`, Icon: BookOpen, iconUrl: kurs.iconUrl, count: kurs.modulesLength })),
    ...pages.map(page => ({ id: `page:${page.id}`, title: page.title, href: `/mentorship/page/${page.slug}`, Icon: FileText, iconUrl: page.iconUrl, count: null })),
  ]
  if (savedSidebarOrder) {
    const order = new Map(savedSidebarOrder.map((id, index) => [id, index]))
    items.sort((a, b) => (order.get(a.id) ?? savedSidebarOrder.length) - (order.get(b.id) ?? savedSidebarOrder.length))
  }

  return (
    <aside className="m-sidebar" aria-label="Mentorship-Navigation">
      <nav className="m-nav">
        <Link href="/mentorship" className="m-nav-link m-nav-home" aria-current={pathname === '/mentorship' ? 'page' : undefined} onClick={onNavigate}>
          <House aria-hidden="true" /><span>Übersicht</span>
        </Link>
        <p className="m-nav-label">Deine Mentorship</p>
        <div className="m-nav-items">
          {items.map(({ id, title, href, Icon, iconUrl, count }) => (
            <Link key={id} href={href} prefetch={false} className="m-nav-link" onClick={onNavigate}
              aria-current={pathname === href || (activeCourseId === id && pathname?.startsWith('/mentorship/modul/')) ? 'page' : undefined}>
              {iconUrl ? <Image src={iconUrl} alt="" width={20} height={20} className="m-nav-image" quality={70} /> : <Icon aria-hidden="true" />}
              <span>{title}</span>
              {count !== null ? <small aria-label={`${count} Module`}>{count}</small> : null}
            </Link>
          ))}
        </div>
      </nav>
      <div className="m-sidebar-footer">
        <p>Ein Chart nach dem anderen.</p>
        <ManageSubscriptionButton variant="ghost" label="Mitgliedschaft" className="m-account-link" />
        <Link href="/dashboard" prefetch={false} className="m-account-link" onClick={onNavigate}>Mein Konto <ArrowUpRight aria-hidden="true" /></Link>
      </div>
    </aside>
  )
}
