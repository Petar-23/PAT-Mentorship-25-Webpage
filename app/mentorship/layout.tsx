import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getMentorshipAccessState } from '@/lib/mentorship-access'

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

  // Wichtig für UX: Mentorship ist "App-like" und braucht eine definierte Höhe,
  // damit interne ScrollAreas (MiddleSidebar) wirklich scrollen statt die Seite endlos zu verlängern.
  // 4rem = Navbar-Höhe (h-16).
  return (
    <>
      <div hidden data-hide-root-footer="true" />
      <div className="mentorship-typography h-[calc(100dvh-4rem)] min-h-0">{children}</div>
    </>
  )
}
