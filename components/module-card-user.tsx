'use client'

import { CheckCircle } from '@/components/mentorship/icons'
import { MentorshipLink as Link } from '@/components/mentorship/navigation-link'
import { Progress } from '@/components/ui/progress'
import { formatLearningDuration } from '@/lib/mentorship-learning'
import { ModuleCover, motifFor, splitModuleName } from '@/components/mentorship/module-cover'
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
  courseName?: string
  entranceOrder?: number
  progress?: {
    percent: number
    completedLessons: number
    totalLessons: number
  } | null
}

export function ModuleCardUser({ modul, progress = null, courseName = '', entranceOrder = 0 }: Props) {
  const href = `/mentorship/modul/${modul.id}`
  const name = splitModuleName(modul.name)
  const completed = Boolean(progress && progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons)

  return (
    <Link
      href={href}
      prefetch={false}
      className="m-module-card"
      style={{ '--m-card-delay': `${Math.min(entranceOrder, 5) * 40}ms` } as CSSProperties}
    >
      <div className="m-module-cover" data-image-state="loaded">
        <ModuleCover seed={modul.id} motif={motifFor(courseName, modul.id)} code={'M-' + (name.number ?? String(entranceOrder + 1).padStart(2, '0'))} title={name.title} />
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
