import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription } from '@/lib/stripe'
import { getIsAdmin } from '@/lib/authz'

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Performance/UX: Erst Subscription prüfen (meist DB-fast) und nur im "kein Abo" Fall
  // noch den Admin-Check gegen Clerk machen.
  const hasSub = await hasActiveSubscription(userId)
  const allowed = hasSub || (await getIsAdmin())

  if (!allowed) {
    redirect('/dashboard?paywall=courses')
  }

  // Wichtig für UX: Mentorship ist "App-like" und braucht eine definierte Höhe,
  // damit interne ScrollAreas (MiddleSidebar) wirklich scrollen statt die Seite endlos zu verlängern.
  // 4rem = Navbar-Höhe (h-16).
  return <div className="h-[calc(100dvh-4rem)] min-h-0">{children}</div>
}