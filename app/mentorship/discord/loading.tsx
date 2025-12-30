import { MentorshipDiscordSkeleton, MentorshipSidebarSkeleton } from '@/components/skeletons/mentorship-skeleton'

export default function MentorshipDiscordLoading() {
  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <MentorshipSidebarSkeleton />
      </div>
      <MentorshipDiscordSkeleton />
    </div>
  )
}


