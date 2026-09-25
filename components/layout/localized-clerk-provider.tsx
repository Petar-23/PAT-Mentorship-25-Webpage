'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { deDE, enUS } from '@clerk/localizations'
import { usePathname } from 'next/navigation'
import { isResearchSurfaceHostname, isResearchSurfacePathname } from '@/lib/research/surface.mjs'

// PAT Research ist englisch: /research/* im Pfad-Modus; auf research.* fehlt der
// Präfix im sichtbaren Pfad, dort entscheidet der Hostname (Namenskonvention
// research.* / research-staging.*, siehe lib/research/surface.mjs). Den Host
// kennt nur der Browser; Clerk rendert seine UI ohnehin erst clientseitig.
function usesResearchAccountUi(pathname: string) {
  if (isResearchSurfacePathname(pathname)) return true
  return typeof window !== 'undefined' && isResearchSurfaceHostname(window.location.hostname)
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
