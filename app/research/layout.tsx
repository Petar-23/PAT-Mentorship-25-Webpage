import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { mentorshipSans, mentorshipSerif } from '@/app/mentorship/fonts'
import { ResearchBasePathProvider } from '@/components/research/base-path'
import { ResearchMobileNavigation } from '@/components/research/mobile-navigation'
import { ResearchShell } from '@/components/research/shell'
import { ResearchSidebar } from '@/components/research/sidebar'
import { getResearchRequestContext } from '@/lib/research/request-context'
import { RESEARCH_THEME_COOKIE } from '@/lib/research/ui.mjs'
import { getResearchViewer } from '@/lib/research/viewer'
import '@/app/mentorship/mentorship.css'
import './research.css'

const description =
  'Tested studies of ICT concepts on NQ futures — method, charts and numbers. Plus clearly marked ICT teachings that are not tested yet.'

// Die Root-Metadaten (deutsch, www-Canonical, Mentorship-Banner) werden hier
// überschrieben. Indexierung entscheidet Phase b.
export const metadata: Metadata = {
  title: { absolute: 'PAT Research', template: '%s | PAT Research' },
  description,
  keywords: null,
  alternates: { canonical: null },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'PAT Research',
    title: 'PAT Research',
    description,
  },
  twitter: { card: 'summary', title: 'PAT Research', description },
  robots: { index: false },
}

export default async function ResearchLayout({ children }: { children: ReactNode }) {
  // Zuerst (nicht parallel): notFound(), wenn Research hier nicht ausgeliefert
  // wird oder die Middleware übersprungen wurde; sonst würde Clerk auth() werfen.
  const context = await getResearchRequestContext()
  const [viewer, preferences] = await Promise.all([getResearchViewer(), cookies()])
  const theme = preferences.get(RESEARCH_THEME_COOKIE)?.value === 'dark' ? 'dark' : 'light'
  const signedIn = viewer.userId !== null

  return (
    <div lang="en">
      {/* Markers: globals.css hides the German root navbar and footer while research is shown. */}
      <div hidden data-hide-root-footer="true" />
      <div hidden data-hide-root-navbar="true" />
      <ResearchBasePathProvider basePath={context.basePath}>
        <ResearchShell className={`m-pat-fonts ${mentorshipSans.variable} ${mentorshipSerif.variable}`}
          initialTheme={theme} signedIn={signedIn}
          sidebar={<ResearchSidebar isMember={viewer.isMember} signedIn={signedIn} />}
          headerNavigation={<ResearchMobileNavigation isMember={viewer.isMember} signedIn={signedIn} />}>
          {children}
        </ResearchShell>
      </ResearchBasePathProvider>
    </div>
  )
}
