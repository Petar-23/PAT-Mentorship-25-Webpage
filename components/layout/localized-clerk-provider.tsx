'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { deDE, enUS } from '@clerk/localizations'
import { usePathname } from 'next/navigation'
import { isResearchBrowserHostname, isResearchPathname } from '@/lib/research/routing.mjs'

// PAT Research ist englisch: /research/* im Pfad-Modus; auf research.* fehlt der
// Präfix im sichtbaren Pfad, dort entscheidet der Hostname (Namenskonvention
// research.* / research-staging.*, siehe lib/research/routing.mjs). Den Host
// kennt nur der Browser; Clerk rendert seine UI ohnehin erst clientseitig.
function usesResearchAccountUi(pathname: string) {
  if (isResearchPathname(pathname)) return true
  return typeof window !== 'undefined' && isResearchBrowserHostname(window.location.hostname)
}

function usesEnglishAccountUi(pathname: string) {
  if (!pathname.startsWith('/raid-map')) return false
  const isGermanRoute =
    pathname === '/raid-map/de' ||
    pathname.startsWith('/raid-map/de/') ||
    pathname === '/raid-map/docs/de' ||
    pathname.startsWith('/raid-map/docs/de/')

  return !isGermanRoute
}

export function LocalizedClerkProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const localization = usesResearchAccountUi(pathname) || usesEnglishAccountUi(pathname) ? enUS : deDE

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      localization={localization}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  )
}
