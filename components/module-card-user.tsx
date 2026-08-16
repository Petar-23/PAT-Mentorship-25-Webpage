'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ModuleCardCover } from '@/components/mentorship/module-cover-gradient'

function formatModuleDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

type Props = {
  modul: {
    id: string
    name: string
    description?: string | null
    imageUrl?: string | null
    chaptersCount: number
    totalDurationSeconds?: number | null
  }
  progress?: {
    percent: number
    completedLessons: number
    totalLessons: number
  } | null
}

export function ModuleCardUser({ modul, progress = null }: Props) {
  const router = useRouter()
  const desktopHref = `/mentorship/modul/${modul.id}`
  const mobileHref = `${desktopHref}?view=content`

  return (
    <Link
      href={desktopHref}
      prefetch={false}
      className="relative group block w-full h-full"
      onMouseEnter={() => router.prefetch(desktopHref)}
      onClick={(event) => {
        if (
          typeof window === 'undefined' ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return
        }

        const isDesktop = window.matchMedia('(min-width: 1024px)').matches
        if (!isDesktop) {
          event.preventDefault()
          router.push(mobileHref)
        }
      }}
    >
      <Card
        className="overflow-hidden h-full flex flex-col transition-all border-gray-200 hover:border-gray-500/50 cursor-pointer"
      >
        <ModuleCardCover id={modul.id} name={modul.name} imageUrl={modul.imageUrl} />

        <CardContent className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-md font-semibold mb-1 leading-tight">{modul.name}</h3>
            <p className="text-sm font-light text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
              {modul.description || ''}
            </p>

            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs text-muted-foreground">
                  {progress ? (
                    <>
                      zu{' '}
                      <span className="font-medium text-foreground">{progress.percent}%</span>{' '}
                      komplettiert
                    </>
                  ) : (
                    'Fortschritt wird geladen...'
                  )}
                </p>
                {progress ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {progress.completedLessons}/{progress.totalLessons}
                  </p>
                ) : null}
              </div>
              <Progress
                value={progress?.percent ?? 0}
                className={`h-2.5 ${progress ? '' : 'animate-pulse opacity-60'}`}
              />
            </div>

            <div className="text-xs text-gray-500 flex items-center justify-between gap-3">
              <span>{modul.chaptersCount} Kapitel</span>
              <span>{formatModuleDuration(modul.totalDurationSeconds ?? null)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
