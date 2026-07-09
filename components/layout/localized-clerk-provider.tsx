'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { deDE, enUS } from '@clerk/localizations'
import { usePathname } from 'next/navigation'

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
  const localization = usesEnglishAccountUi(pathname) ? enUS : deDE

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
