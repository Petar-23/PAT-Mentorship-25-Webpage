'use client'

import { CheckCircle } from '@/components/mentorship/icons'
import { MentorshipLink as Link } from '@/components/mentorship/navigation-link'
import Image from 'next/image'
import { Progress } from '@/components/ui/progress'
import { formatLearningDuration } from '@/lib/mentorship-learning'
import { mentorshipModuleArtwork } from '@/lib/mentorship-module-artwork'
import type { CSSProperties } from 'react'

type Props = {
  modul: {
    id: string
    name: string
    description?: string | null
    imageUrl?: string | null
    chaptersCount: number
    totalDurationSeconds?: number | null
  }
  artwork?: 'structure' | 'focus'
  entranceOrder?: number
  progress?: {
    percent: number
    completedLessons: number
    totalLessons: number
  } | null
}

export function ModuleCardUser({ modul, progress = null, artwork = 'structure', entranceOrder = 0 }: Props) {
  const href = `/mentorship/modul/${modul.id}`
  const imageUrl = mentorshipModuleArtwork[modul.id] || modul.imageUrl || `/images/mentorship/market-${artwork}.webp`
  const completed = Boolean(progress && progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons)

  return (
    <Link
      href={href}
      prefetch={false}
      className="m-module-card"
      style={{ '--m-card-delay': `${Math.min(entranceOrder, 5) * 40}ms` } as CSSProperties}
    >
      <div className="m-module-cover">
        <Image src={imageUrl} alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw" />
      </div>
      <div className="m-module-content">
        <div className="m-module-meta"><span>{modul.chaptersCount} Kapitel</span>{formatLearningDuration(modul.totalDurationSeconds) ? <span>{formatLearningDuration(modul.totalDurationSeconds)}</span> : null}</div>
        <h2>{modul.name}</h2>
        {modul.description ? <p className="m-module-description line-clamp-3">{modul.description}</p> : null}
        <div className="m-module-progress">
          <div className="m-module-progress-label">
            <span>{completed ? 'Abgeschlossen' : progress ? `${progress.completedLessons} von ${progress.totalLessons} Lektionen` : 'Fortschritt nicht verfügbar'}</span>
            {completed ? <CheckCircle aria-hidden="true" /> : progress ? <span>{progress.percent}%</span> : null}
          </div>
          {progress && !completed ? <Progress value={progress.percent} aria-label={`Fortschritt in ${modul.name}`} /> : null}
        </div>
      </div>
    </Link>
  )
}
