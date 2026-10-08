import { auth } from '@clerk/nextjs/server'
import { getIsAdmin } from '@/lib/authz'
import { MentorshipCourseView } from '@/components/mentorship/views/course-view'

export default async function DynamicCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, sessionClaims } = await auth()
  const { id } = await params
  const isAdmin = userId ? await getIsAdmin(userId, sessionClaims) : false
  return <MentorshipCourseView id={id} userId={userId} isAdmin={isAdmin} />
}
