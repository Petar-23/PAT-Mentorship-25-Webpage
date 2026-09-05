'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { Progress } from '@/components/ui/progress'

function formatModuleDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h > 0) return `${h} Std. ${m} Min.`
  return `${m} Min.`
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
  progressLoading?: boolean
  artwork?: 'structure' | 'focus'
  progress?: {
    percent: number
    completedLessons: number
    totalLessons: number
  } | null
}

export function ModuleCardUser({ modul, progress = null, progressLoading = false, artwork = 'structure' }: Props) {
  const router = useRouter()
  const href = `/mentorship/modul/${modul.id}`

  return (
    <Link
      href={href}
      prefetch={false}
      className="m-module-card"
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
    >
      <div className="m-module-cover">
        <Image src={modul.imageUrl || `/images/mentorship/market-${artwork}.webp`} alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw" />
      </div>
      <div className="m-module-content">
        <div className="m-module-meta"><span>{modul.chaptersCount} Kapitel</span><span>{formatModuleDuration(modul.totalDurationSeconds)}</span></div>
        <h2>{modul.name}</h2>
        {modul.description ? <p className="m-module-description line-clamp-3">{modul.description}</p> : null}
        <div className="m-module-progress">
          <div className="m-module-progress-label">
            <span>{progress ? `${progress.completedLessons} von ${progress.totalLessons} Lektionen` : progressLoading ? 'Fortschritt wird geladen…' : 'Fortschritt nicht verfügbar'}</span>
            {progress?.percent === 100 ? <CheckCircle aria-label="Abgeschlossen" /> : progress ? <span>{progress.percent}%</span> : null}
          </div>
          {progress ? <Progress value={progress.percent} aria-label={`Fortschritt in ${modul.name}`} /> : progressLoading ? <div className="h-1 rounded-full bg-neutral-200 animate-pulse" /> : null}
        </div>
      </div>
    </Link>
  )
}
