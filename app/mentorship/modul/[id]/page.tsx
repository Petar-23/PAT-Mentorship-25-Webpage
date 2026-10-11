import { auth } from '@clerk/nextjs/server'
import { getIsAdmin } from '@/lib/authz'
import { MentorshipModuleView } from '@/components/mentorship/views/module-view'

export default async function MentorshipModulPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, sessionClaims } = await auth()
  const { id } = await params
  const isAdmin = userId ? await getIsAdmin(userId, sessionClaims) : false
  return <MentorshipModuleView id={id} userId={userId} isAdmin={isAdmin} searchParams={searchParams} />
}
