'use client'

// Fork of components/mentorship/shell.tsx for PAT Research: English labels,
// brand "Research", own theme cookie, sidebar rendered by the shell itself.
// The mentorship shell stays untouched; both share mentorship.css and its tokens.
import { Sun, Moon, SidebarSimple } from '@/components/mentorship/icons'
import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserButton, useAuth } from '@clerk/nextjs'
import { useResearchHref, useResearchLogicalPath } from '@/components/research/base-path'
import { ResearchSignInLink } from '@/components/research/sign-in-link'
import { RESEARCH_THEME_COOKIE } from '@/lib/research/ui.mjs'

export type ResearchTheme = 'light' | 'dark'

const ThemeContext = createContext<ResearchTheme>('light')
export const useResearchTheme = () => useContext(ThemeContext)
const NavigationContext = createContext(true)
export const useResearchNavigation = () => useContext(NavigationContext)
const MobileNavigationContext = createContext<{
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  container: HTMLDivElement | null
} | null>(null)
export function useResearchMobileNavigation() {
  const navigation = useContext(MobileNavigationContext)
  if (!navigation) throw new Error('Mobile navigation requires ResearchShell')
  return navigation
}

export function ResearchShell({ children, sidebar, headerNavigation, initialTheme = 'light', signedIn: initialSignedIn, className = '' }: {
  children: ReactNode
  /** Desktop navigation (from 1280px). */
  sidebar?: ReactNode
  /** Menu trigger for phones and tablets. */
  headerNavigation?: ReactNode
  initialTheme?: ResearchTheme
  /** Server-side sign-in state, used until Clerk has loaded in the browser. */
  signedIn: boolean
  className?: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const [navigationOpen, setNavigationOpen] = useState(true)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [navigationContainer, setNavigationContainer] = useState<HTMLDivElement | null>(null)
  const { isLoaded, isSignedIn } = useAuth()
  const signedIn = isLoaded ? Boolean(isSignedIn) : initialSignedIn
  const href = useResearchHref()
  // On /sign-in and /sign-up the Clerk card is the page; a second "Sign in" would only repeat it.
  const onAuthPage = /^\/sign-(in|up)(\/|$)/.test(useResearchLogicalPath())

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)')
    const closeMobileNavigation = () => { if (desktop.matches) setMobileNavigationOpen(false) }
    desktop.addEventListener('change', closeMobileNavigation)
    return () => desktop.removeEventListener('change', closeMobileNavigation)
  }, [])

  function changeTheme(next: ResearchTheme) {
    setTheme(next)
    // The layout reads this preference too, so the first paint already has the chosen theme.
    try {
      document.cookie = `${RESEARCH_THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {
      // The switch still works if this browser does not allow preference cookies.
    }
  }

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationContext.Provider value={navigationOpen}>
      <MobileNavigationContext.Provider value={{ open: mobileNavigationOpen, setOpen: setMobileNavigationOpen, container: navigationContainer }}>
      <div className={`mentorship-typography m-app research-app ${theme === 'dark' ? 'dark' : ''} ${className}`} data-theme={theme} data-sidebar={navigationOpen ? 'open' : 'closed'} data-mobile-navigation={mobileNavigationOpen ? 'open' : 'closed'}>
        {/* Replaces the German root skip link, which globals.css hides on research pages. */}
        <a href="#research-content" className="sr-only focus:not-sr-only r-skip-link">Skip to content</a>
        <div className="m-mobile-navigation-host" ref={setNavigationContainer} />
        <div className="m-app-frame">
        <header className="m-topbar">
          <div className="m-topbar-leading">
            <button type="button" className="m-icon-button m-sidebar-toggle"
              aria-label={navigationOpen ? 'Hide navigation' : 'Show navigation'}
              title={navigationOpen ? 'Hide navigation' : 'Show navigation'}
              aria-expanded={navigationOpen} aria-controls="research-desktop-navigation"
              onClick={() => setNavigationOpen(open => !open)}><SidebarSimple /></button>
            <div className="m-header-menu">{headerNavigation}</div>
            <Link href={href('/')} className="m-brand" aria-label="PAT Research – Home">
              <Image src="/images/hero/PAT-logo.png" alt="" width={32} height={32} className="m-brand-logo" sizes="32px" />
              <span className="m-brand-name">Research</span>
            </Link>
          </div>
          <div className="m-topbar-actions">
            <button type="button" className="m-appearance-toggle" aria-label={theme === 'dark' ? 'Use light appearance' : 'Use dark appearance'}
              title={theme === 'dark' ? 'Use light appearance' : 'Use dark appearance'}
              onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className="m-appearance-symbol" aria-hidden="true"><Sun className="m-theme-sun" /><Moon className="m-theme-moon" /></span>
            </button>
            {signedIn ? <UserButton afterSignOutUrl={href('/')} appearance={{
              elements: { avatarBox: 'h-8 w-8', userButtonTrigger: 'h-11 w-11 justify-center' },
              variables: { colorBackground: theme === 'dark' ? '#3d3d3a' : '#ffffff', colorText: theme === 'dark' ? '#faf9f5' : '#141413', colorPrimary: theme === 'dark' ? '#faf9f5' : '#141413' },
            }} /> : onAuthPage ? null : <ResearchSignInLink className="r-signin-pill" />}
          </div>
        </header>
        <div className="m-app-content">
          <div className="m-workspace">
            {sidebar ? <div className="m-desktop-sidebar hidden xl:block">{sidebar}</div> : null}
            <div className="m-page-scroll" id="research-content" tabIndex={-1}>{children}</div>
          </div>
        </div>
        </div>
      </div>
      </MobileNavigationContext.Provider>
      </NavigationContext.Provider>
    </ThemeContext.Provider>
  )
}
