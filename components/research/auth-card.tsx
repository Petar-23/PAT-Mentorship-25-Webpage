'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { useResearchHref } from '@/components/research/base-path'
import { useResearchTheme } from '@/components/research/shell'
import { researchAuthUrls } from '@/lib/research/ui.mjs'

/**
 * Clerk sign-in / sign-up inside the research shell. `redirectUrl` is the raw
 * `redirect_url` query value; it is only honoured when it is a same-origin
 * relative path. The target is always passed as a force redirect so Clerk never
 * evaluates an unsafe `redirect_url` from the address bar on its own.
 */
export function ResearchAuthCard({ mode, redirectUrl }: { mode: 'sign-in' | 'sign-up'; redirectUrl?: string }) {
  const href = useResearchHref()
  const theme = useResearchTheme()
  const urls = researchAuthUrls(href, redirectUrl)
  const dark = theme === 'dark'
  const appearance = {
    variables: {
      colorBackground: dark ? '#1d1d1c' : '#ffffff',
      colorText: dark ? '#faf9f5' : '#141413',
      colorTextSecondary: dark ? '#b0aea5' : '#5e5d59',
      colorPrimary: dark ? '#faf9f5' : '#141413',
      colorTextOnPrimaryBackground: dark ? '#141413' : '#ffffff',
      colorInputBackground: dark ? '#141413' : '#ffffff',
      colorInputText: dark ? '#faf9f5' : '#141413',
      borderRadius: '0.75rem',
    },
    elements: { rootBox: 'r-auth-root', cardBox: 'r-auth-card' },
  }

  if (mode === 'sign-up') {
    return <SignUp routing="path" path={urls.signUpPath} signInUrl={urls.signInUrl}
      fallbackRedirectUrl={urls.home} forceRedirectUrl={urls.target}
      signInFallbackRedirectUrl={urls.home} signInForceRedirectUrl={urls.target} appearance={appearance} />
  }

  return <SignIn routing="path" path={urls.signInPath} signUpUrl={urls.signUpUrl}
    fallbackRedirectUrl={urls.home} forceRedirectUrl={urls.target}
    signUpFallbackRedirectUrl={urls.home} signUpForceRedirectUrl={urls.target} appearance={appearance} />
}
