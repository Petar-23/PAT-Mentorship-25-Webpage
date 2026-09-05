import { MentorshipModuleGridSkeleton, MentorshipSidebarSkeleton } from '@/components/skeletons/mentorship-skeleton'

export default function MentorshipDynamicLoading() {
  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden xl:block">
        <MentorshipSidebarSkeleton />
      </div>
      <MentorshipModuleGridSkeleton />
    </div>
  )
}


