import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { cookies } from 'next/headers'
import { MentorshipShell } from '@/components/mentorship/shell'
import { getSidebarData } from '@/lib/sidebar-data'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { mentorshipSans, mentorshipSerif } from './fonts'
import './mentorship.css'

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)

  if (!access.allowed) {
    if (!access.mentorshipAccessible && access.hasSubscription) {
      // User hat Abo, aber Mentorship startet erst später
      redirect('/dashboard?message=mentorship-not-started')
    } else {
      // Kein Abo oder andere Blockierung
      redirect('/dashboard?paywall=courses')
    }
  }

  const [preferences, navigation] = await Promise.all([cookies(), getSidebarData()])
  const theme = preferences.get('pat-mentorship-theme')?.value === 'dark' ? 'dark' : 'light'

  return (
    <>
      <div hidden data-hide-root-footer="true" />
      <MentorshipShell className={`m-pat-fonts ${mentorshipSans.variable} ${mentorshipSerif.variable}`} initialTheme={theme} headerNavigation={<MobileCoursesDrawer
        kurse={navigation.kurseForSidebar} pages={navigation.pagesForSidebar} savedSidebarOrder={navigation.savedSidebarOrder}
      />}>{children}</MentorshipShell>
    </>
  )
}
