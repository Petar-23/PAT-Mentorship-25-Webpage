import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type SkeletonVariant = 'neutral' | 'success'

function Skeleton({
  className,
  variant = 'neutral',
}: {
  className?: string
  variant?: SkeletonVariant
}) {
  const bg =
    variant === 'success'
      ? 'bg-neutral-200/80 dark:bg-neutral-800/70'
      : 'bg-neutral-200/80 dark:bg-neutral-800/70'
  return (
    <div className={cn('animate-pulse rounded-md', bg, className)} />
  )
}

export function MentorshipSidebarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full lg:w-80 border-r border-border p-4 flex flex-col h-full min-h-0 bg-muted/40',
        className
      )}
    >
      {/* Banner */}
      <div className="relative mb-1 -mx-4 -mt-4 h-48 overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 pb-3 flex justify-center">
          <Skeleton className="h-9 w-52 rounded-lg" />
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 min-h-0 mt-2 overflow-hidden">
        <Skeleton className="h-5 w-44 mb-3" />

        <div className="space-y-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-4 py-2 px-2 rounded-lg border border-border"
            >
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 opacity-70" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer (Abo + User) */}
      <div className="mt-4 pt-4 border-t border-border">
        <Skeleton className="h-8 w-36" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44 opacity-70" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MentorshipMobileBottomBarSkeleton() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-300/75 backdrop-blur supports-[backdrop-filter]:bg-neutral-300/60 lg:hidden">
      <div className="mx-auto max-w-7xl px-4 pt-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  )
}

function MentorshipModuleCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted/40 flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
      <CardHeader className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-3/4 opacity-70" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}

export function MentorshipModuleGridSkeleton({
  className,
  paddingClassName = 'p-4 sm:p-6 lg:p-12 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12',
  titleWidthClassName = 'w-48',
}: {
  className?: string
  paddingClassName?: string
  titleWidthClassName?: string
}) {
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <MentorshipMobileBottomBarSkeleton />
      <div className={paddingClassName}>
        <Skeleton className={cn('mb-6 sm:mb-10 lg:mb-12 h-10', titleWidthClassName)} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <MentorshipModuleCardSkeleton key={i} />
          ))}

          <Card className="border-dashed border-2 border-muted-foreground/40 flex items-center justify-center">
            <CardContent className="p-10 sm:p-12 text-center w-full">
              <Skeleton className="mx-auto h-14 w-14 rounded-xl" />
              <Skeleton className="mx-auto mt-4 h-5 w-40 opacity-70" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function MentorshipDashboardSkeleton({
  className,
  paddingClassName = 'p-4 sm:p-6 lg:p-10 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10',
}: {
  className?: string
  paddingClassName?: string
}) {
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <MentorshipMobileBottomBarSkeleton />
      <div className={paddingClassName}>
        <div className="w-full max-w-[1920px]">
          {/* Welcome */}
          <div className="mb-6 sm:mb-8">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="mt-2 h-4 w-80 opacity-70" />
          </div>

          <div className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-6 auto-rows-fr">
            {/* Weiterlernen */}
            <Card className="md:col-span-2 xl:col-span-2 min-[1800px]:col-span-2">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-72 opacity-70" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <Skeleton className="h-4 w-52" />
                      <Skeleton className="h-3 w-40 opacity-70" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <Skeleton className="h-3 w-56 opacity-70" />
                  <Skeleton className="h-10 w-full sm:w-36 rounded-md" />
                </div>
              </CardContent>
            </Card>

            {/* Neue Inhalte */}
            <Card className="md:col-span-2 xl:col-span-1 min-[1800px]:col-span-2">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-48 opacity-70" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="mt-2 h-3 w-8/12 opacity-70" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-3 w-10/12 opacity-70" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MentorshipModulDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex-1 flex min-w-0', className)}>
      {/* Desktop: Kapitel/Middle-Sidebar */}
      <div className="hidden lg:flex w-96 h-full min-h-0 border-r border-border bg-background p-4 sm:p-6 lg:p-8 flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2 opacity-70" />
            </div>
          ))}
        </div>
      </div>

      {/* Video + Mobile Controls */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/30">
              <Skeleton className="h-full w-full rounded-none" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2 opacity-70" />
              <Skeleton className="h-4 w-11/12 opacity-70" />
              <Skeleton className="h-4 w-10/12 opacity-70" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        </div>

        {/* Mobile Bottom-Bar: Kurse + Inhalt */}
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-300/75 text-neutral-50 backdrop-blur supports-[backdrop-filter]:bg-neutral-300/60">
          <div className="mx-auto max-w-7xl px-4 pt-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MentorshipDiscordSkeleton({
  className,
  paddingClassName = 'p-4 sm:p-6 lg:p-12 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12',
}: {
  className?: string
  paddingClassName?: string
}) {
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <MentorshipMobileBottomBarSkeleton />
      <div className={paddingClassName}>
        <Card className="mx-auto w-full max-w-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 lg:p-10 text-center space-y-6">
            {/* Kein Color-Split: nur ein cleanes Card-Skeleton */}
            <div className="mx-auto w-fit">
              <Skeleton variant="success" className="h-32 w-32 rounded-2xl" />
            </div>

            <div className="space-y-3">
              <Skeleton variant="success" className="mx-auto h-8 w-72" />
              <div className="mx-auto max-w-lg space-y-3">
                <Skeleton variant="success" className="h-4 w-full opacity-80" />
                <Skeleton variant="success" className="h-4 w-11/12 opacity-80" />
                <Skeleton variant="success" className="h-4 w-9/12 opacity-80" />
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <Skeleton variant="success" className="h-11 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


