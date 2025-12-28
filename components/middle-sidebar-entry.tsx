'use client'

import dynamic from 'next/dynamic'
import { MiddleSidebarUser, type MiddleSidebarProps } from './middle-sidebar-user'
import { useMediaQuery } from '@/hooks/use-media-query'

// Die bisherige, schwere Implementierung (inkl. Admin-Tools) bleibt in `components/middle-sidebar.tsx`
// und wird nur noch für Admins dynamisch geladen.
const MiddleSidebarAdmin = dynamic(
  () => import('./middle-sidebar').then((m) => m.MiddleSidebar),
  { ssr: false }
)

export function MiddleSidebar({ isAdmin, ...props }: MiddleSidebarProps & { isAdmin: boolean }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  if (isAdmin && isDesktop) return <MiddleSidebarAdmin {...props} />
  return <MiddleSidebarUser {...props} />
}


