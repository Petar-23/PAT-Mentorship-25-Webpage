'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserButton, useUser } from '@clerk/nextjs'
import { Sun } from '@phosphor-icons/react/Sun'
import { Moon } from '@phosphor-icons/react/Moon'

export type MentorshipTheme = 'light' | 'dark'
const ThemeContext = createContext<MentorshipTheme>('light')
export const useMentorshipTheme = () => useContext(ThemeContext)

export function MentorshipShell({ children, headerNavigation, initialTheme = 'light' }: {
  children: ReactNode
  headerNavigation?: ReactNode
  initialTheme?: MentorshipTheme
}) {
  const [theme, setTheme] = useState(initialTheme)
  const { user } = useUser()
  const isAdmin = user?.organizationMemberships?.some(membership => membership.role === 'org:admin')

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
      <div className={`mentorship-typography m-app ${theme === 'dark' ? 'dark' : ''}`} data-theme={theme}>
        <header className="m-topbar">
          <div className="m-header-menu">{headerNavigation}</div>
          <Link href="/mentorship" className="m-brand" aria-label="PAT Mentorship – Übersicht">
            <Image src="/images/hero/PAT-logo.png" alt="" width={44} height={44} className="m-brand-logo" sizes="44px" />
            <span className="m-brand-name">Mentorship</span>
          </Link>
          <div className="m-topbar-actions">
            {isAdmin ? <Link href="/owner" className="m-admin-link" prefetch={false}>Verwaltung</Link> : null}
            <button type="button" className="m-appearance-toggle" aria-label={theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}
              onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <UserButton afterSignOutUrl="/" appearance={{
              elements: { avatarBox: 'h-8 w-8', userButtonTrigger: 'h-11 w-11 justify-center' },
              variables: { colorBackground: theme === 'dark' ? '#3d3d3a' : '#ffffff', colorText: theme === 'dark' ? '#faf9f5' : '#141413', colorPrimary: theme === 'dark' ? '#faf9f5' : '#141413' },
            }} />
          </div>
        </header>
        <div className="m-app-content">{children}</div>
      </div>
    </ThemeContext.Provider>
  )
}
