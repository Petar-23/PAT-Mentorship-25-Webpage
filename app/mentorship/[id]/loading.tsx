import { MentorshipModuleGridSkeleton, MentorshipSidebarSkeleton } from '@/components/skeletons/mentorship-skeleton'

export default function MentorshipDynamicLoading() {
  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <MentorshipSidebarSkeleton />
      </div>
      <MentorshipModuleGridSkeleton
        paddingClassName="p-4 sm:p-6 lg:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8"
        titleWidthClassName="w-64"
      />
    </div>
  )
}


