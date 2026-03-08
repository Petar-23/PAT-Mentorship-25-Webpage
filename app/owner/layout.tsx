import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getIsAdmin } from '@/lib/authz'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
