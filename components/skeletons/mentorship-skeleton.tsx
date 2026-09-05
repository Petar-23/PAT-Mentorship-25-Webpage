import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('m-skeleton animate-pulse rounded-md', className)} />
}

export function MentorshipSidebarSkeleton({ className }: { className?: string }) {
  return <div className={cn('m-sidebar', className)} aria-hidden="true">
    <Skeleton className="h-11 w-full mb-8" />
    <Skeleton className="h-3 w-24 mb-6" />
    <div className="space-y-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6 w-4/5" />)}</div>
  </div>
}
function HeaderSkeleton() {
  return <div className="m-page-header"><div className="w-full"><Skeleton className="h-3 w-24 mb-4" /><Skeleton className="h-9 w-3/4 max-w-md" /><Skeleton className="h-4 w-1/2 mt-4" /></div></div>
}

export function MentorshipModuleGridSkeleton({ className, paddingClassName, titleWidthClassName }: {
  className?: string; paddingClassName?: string; titleWidthClassName?: string
}) {
  return <div className={cn('m-page-scroll', paddingClassName, className)} role="status" aria-label="Module werden geladen" aria-busy="true"><div className="m-page">
    <div className={titleWidthClassName}><HeaderSkeleton /></div>
    <div className="m-module-grid">{Array.from({ length: 6 }, (_, i) => <div key={i}>
      <Skeleton className="aspect-video w-full rounded-xl" /><Skeleton className="h-5 w-3/4 mt-5" /><Skeleton className="h-3 w-1/2 mt-3" /><Skeleton className="h-1 w-full mt-8" />
    </div>)}</div>
  </div></div>
}

export function MentorshipDashboardSkeleton({ className, paddingClassName }: { className?: string; paddingClassName?: string }) {
  return <div className={cn('m-page-scroll', paddingClassName, className)} role="status" aria-label="Dein Lernplatz wird geladen" aria-busy="true"><div className="m-page">
    <HeaderSkeleton /><Skeleton className="h-64 w-full rounded-2xl mb-10" />
    <div className="m-home-columns">{[0,1].map(i => <div key={i}><Skeleton className="h-5 w-36 mb-6" />{[0,1,2].map(j => <Skeleton key={j} className="h-12 w-full mb-5" />)}</div>)}</div>
  </div></div>
}

export function MentorshipMiddleSidebarSkeleton({ className }: { className?: string }) {
  return <div className={cn('m-lesson-outline', className)} aria-hidden="true"><HeaderSkeleton /><Skeleton className="h-1 mb-8" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full mb-5" />)}</div>
}

export function MentorshipModulDetailSkeleton({ className }: { className?: string }) {
  return <div className={cn('m-lesson-workspace', className)} role="status" aria-label="Lektion wird geladen" aria-busy="true">
    <div className="hidden lg:block"><MentorshipMiddleSidebarSkeleton /></div>
    <div className="m-player-scroll"><div className="m-video-player"><HeaderSkeleton /><Skeleton className="aspect-video rounded-2xl" /><Skeleton className="h-10 w-1/2 mt-8" /></div></div>
  </div>
}

export function MentorshipDiscordSkeleton({ className, paddingClassName }: { className?: string; paddingClassName?: string }) {
  return <div className={cn('m-page-scroll', paddingClassName, className)} role="status" aria-label="Community wird geladen" aria-busy="true"><div className="m-page m-community"><HeaderSkeleton /><Skeleton className="h-44 w-full rounded-2xl mb-9" /><Skeleton className="h-6 w-2/3 mb-6" /><Skeleton className="h-10 w-60" /></div></div>
}
