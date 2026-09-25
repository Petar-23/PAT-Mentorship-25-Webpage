'use client'

import { Tag } from '@phosphor-icons/react/dist/ssr/Tag'
import { FileText, House, UserCircle } from '@/components/mentorship/icons'
import { MentorshipLink as Link } from '@/components/mentorship/navigation-link'
import { useResearchHref, useResearchLogicalPath } from '@/components/research/base-path'
import { useResearchNavigation } from '@/components/research/shell'
import type { ComponentPropsWithoutRef, ComponentType } from 'react'

type IconProps = ComponentPropsWithoutRef<'svg'>

function PricingIcon(props: IconProps) {
  return <Tag size={24} weight="bold" focusable="false" aria-hidden="true" {...props} />
}

type Item = { id: string; title: string; path: string; Icon: ComponentType<IconProps> }

type Props = {
  isMember: boolean
  signedIn: boolean
  /** Set in the mobile menu: closes the menu after choosing a destination. */
  onNavigate?: () => void
}

function isActive(logicalPath: string, path: string) {
  return path === '/' ? logicalPath === '/' : logicalPath === path || logicalPath.startsWith(`${path}/`)
}

export function ResearchSidebar({ isMember, signedIn, onNavigate }: Props) {
  const href = useResearchHref()
  const logicalPath = useResearchLogicalPath()
  const navigationOpen = useResearchNavigation()
  const hidden = !onNavigate && !navigationOpen
  const items: Item[] = [
    { id: 'home', title: 'Home', path: '/', Icon: House },
    ...(isMember ? [] : [{ id: 'pricing', title: 'Pricing', path: '/pricing', Icon: PricingIcon }]),
    ...(signedIn ? [{ id: 'account', title: 'Account', path: '/account', Icon: UserCircle }] : []),
  ]

  return (
    <aside className="m-sidebar" id={onNavigate ? undefined : 'research-desktop-navigation'}
      aria-label="Research navigation" aria-hidden={hidden || undefined}
      ref={element => { if (element) element.inert = hidden }}>
      <nav className="m-nav">
        <div className="m-nav-items">
          {items.map(({ id, title, path, Icon }) => (
            <Link key={id} href={href(path)} prefetch={false} className="m-nav-link" onNavigate={onNavigate}
              aria-current={isActive(logicalPath, path) ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{title}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="m-sidebar-footer">
        <Link href={href('/terms')} prefetch={false} className="m-account-link" onNavigate={onNavigate}
          aria-current={isActive(logicalPath, '/terms') ? 'page' : undefined}>
          <FileText aria-hidden="true" /><span>Terms</span>
        </Link>
      </div>
    </aside>
  )
}
