'use client'

import { Sun, Moon, SidebarSimple } from '@/components/mentorship/icons'
import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserButton, useUser } from '@clerk/nextjs'

export type MentorshipTheme = 'light' | 'dark'
const ThemeContext = createContext<MentorshipTheme>('light')
export const useMentorshipTheme = () => useContext(ThemeContext)
const NavigationContext = createContext(true)
export const useMentorshipNavigation = () => useContext(NavigationContext)
const MobileNavigationContext = createContext<{
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  container: HTMLDivElement | null
} | null>(null)
export function useMentorshipMobileNavigation() {
  const navigation = useContext(MobileNavigationContext)
  if (!navigation) throw new Error('Mobile navigation requires MentorshipShell')
  return navigation
}

export function MentorshipShell({ children, headerNavigation, headerStatus, initialTheme = 'light', className = '' }: {
  children: ReactNode
  headerNavigation?: ReactNode
  headerStatus?: ReactNode
  initialTheme?: MentorshipTheme
  className?: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const [navigationOpen, setNavigationOpen] = useState(true)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [navigationContainer, setNavigationContainer] = useState<HTMLDivElement | null>(null)
  const { user } = useUser()
  const isAdmin = user?.organizationMemberships?.some(membership => membership.role === 'org:admin')

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)')
    const closeMobileNavigation = () => { if (desktop.matches) setMobileNavigationOpen(false) }
    desktop.addEventListener('change', closeMobileNavigation)
    return () => desktop.removeEventListener('change', closeMobileNavigation)
  }, [])

  function changeTheme(next: MentorshipTheme) {
    setTheme(next)
    // This preference is also read by the layout: the first paint already has the chosen theme.
    try {
      document.cookie = `pat-mentorship-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {
      // The switch still works if this browser does not allow preference cookies.
    }
  }

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationContext.Provider value={navigationOpen}>
      <MobileNavigationContext.Provider value={{ open: mobileNavigationOpen, setOpen: setMobileNavigationOpen, container: navigationContainer }}>
      <div className={`mentorship-typography m-app ${theme === 'dark' ? 'dark' : ''} ${className}`} data-theme={theme} data-sidebar={navigationOpen ? 'open' : 'closed'} data-mobile-navigation={mobileNavigationOpen ? 'open' : 'closed'}>
        <div className="m-mobile-navigation-host" ref={setNavigationContainer} />
        <div className="m-app-frame">
        <header className="m-topbar">
          <div className="m-topbar-leading">
            {!isAdmin ? <button type="button" className="m-icon-button m-sidebar-toggle"
              aria-label={navigationOpen ? 'Navigation ausblenden' : 'Navigation einblenden'}
              title={navigationOpen ? 'Navigation ausblenden' : 'Navigation einblenden'}
              aria-expanded={navigationOpen} aria-controls="mentorship-desktop-navigation"
              onClick={() => setNavigationOpen(open => !open)}><SidebarSimple /></button> : null}
            <div className="m-header-menu">{headerNavigation}</div>
            <Link href="/mentorship" className="m-brand" aria-label="PAT Mentorship – Übersicht">
              <Image src="/images/hero/PAT-logo.png" alt="" width={32} height={32} className="m-brand-logo" sizes="32px" />
              <span className="m-brand-name">Mentorship</span>
            </Link>
          </div>
          <div className="m-topbar-actions">
            {headerStatus}
            {isAdmin ? <Link href="/owner" className="m-admin-link" prefetch={false}>Verwaltung</Link> : null}
            <button type="button" className="m-appearance-toggle" aria-label={theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
              title={theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
              onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className="m-appearance-symbol" aria-hidden="true"><Sun className="m-theme-sun" /><Moon className="m-theme-moon" /></span>
            </button>
            <UserButton afterSignOutUrl="/" appearance={{
              elements: { avatarBox: 'h-8 w-8', userButtonTrigger: 'h-11 w-11 justify-center' },
              variables: { colorBackground: theme === 'dark' ? '#3d3d3a' : '#ffffff', colorText: theme === 'dark' ? '#faf9f5' : '#141413', colorPrimary: theme === 'dark' ? '#faf9f5' : '#141413' },
            }} />
          </div>
        </header>
        <div className="m-app-content">{children}</div>
        </div>
      </div>
      </MobileNavigationContext.Provider>
      </NavigationContext.Provider>
    </ThemeContext.Provider>
  )
}
