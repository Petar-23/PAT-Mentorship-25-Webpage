// app/courses/create/page.tsx
//
// Diese Route bleibt für alte Links/Bookmarks bestehen,
// leitet aber jetzt auf die Kurse-Seite weiter und öffnet dort das Kurs-Modal.

import { redirect } from 'next/navigation'
import { auth, clerkClient } from '@clerk/nextjs/server'

async function requireAdmin() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/') // nicht eingeloggt
  }

  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  const isAdmin = memberships.data.some((m) => m.role === 'org:admin')

  if (!isAdmin) {
    redirect('/courses') // eingeloggt, aber kein Admin
  }
}

export default async function CreateCoursePage() {
  await requireAdmin()
  redirect('/courses?create=1')
}