// app/courses/create/page.tsx
//
// Diese Route bleibt für alte Links/Bookmarks bestehen,
// leitet aber jetzt auf die Kurse-Seite weiter und öffnet dort das Kurs-Modal.

import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getIsAdmin } from '@/lib/authz'

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/') // nicht eingeloggt
  }

  const isAdmin = await getIsAdmin(userId, sessionClaims)

  if (!isAdmin) {
    redirect('/courses') // eingeloggt, aber kein Admin
  }
}

export default async function CreateCoursePage() {
  await requireAdmin()
  redirect('/courses?create=1')
}
