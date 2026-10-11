import { auth } from '@clerk/nextjs/server'
import { getIsAdmin } from '@/lib/authz'
import { MentorshipHomeView } from '@/components/mentorship/views/home-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MentorshipDashboard({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, sessionClaims } = await auth()
  const isAdmin = userId ? await getIsAdmin(userId, sessionClaims) : false
  return <MentorshipHomeView userId={userId} isAdmin={isAdmin} searchParams={searchParams} />
}
