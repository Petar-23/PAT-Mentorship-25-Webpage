'use client'

import { useSearchParams } from 'next/navigation'
import {
  MentorshipMiddleSidebarSkeleton,
  MentorshipModulDetailSkeleton,
  MentorshipSidebarSkeleton,
} from '@/components/skeletons/mentorship-skeleton'

export default function MentorshipModulLoading() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const showContent = view === 'content'

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <MentorshipSidebarSkeleton />
      </div>
      {showContent ? <MentorshipMiddleSidebarSkeleton /> : <MentorshipModulDetailSkeleton />}
    </div>
  )
}


