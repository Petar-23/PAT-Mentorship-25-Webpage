'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

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

  return (
    <div className="relative group w-full">
      <Card
        className="overflow-hidden h-full flex flex-col transition-all border-gray-200 hover:border-gray-500/50 cursor-pointer"
        onClick={() => {
          if (typeof window === 'undefined') {
            router.push(`/mentorship/modul/${modul.id}`)
            return
          }

          const isDesktop = window.matchMedia('(min-width: 1024px)').matches
          router.push(isDesktop ? `/mentorship/modul/${modul.id}` : `/mentorship/modul/${modul.id}?view=content`)
        }}
      >
        {/* Bild oben */}
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/10 overflow-hidden flex items-center justify-center cursor-pointer">
          {modul.imageUrl ? (
            <Image
              src={modul.imageUrl}
              alt={`${modul.name} Thumbnail`}
              fill
              className="object-cover cursor-pointer"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
            />
          ) : (
            <span className="text-5xl z-10 cursor-pointer">📚</span>
          )}
        </div>

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
    </div>
  )
}


