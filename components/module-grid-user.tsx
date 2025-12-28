'use client'

import { useEffect, useState } from 'react'
import { ModuleCardUser } from './module-card-user'

type Props = {
  modules: Array<{
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    chapters: { length: number }[]
    totalDurationSeconds: number | null
  }>
  playlistId: string
  playlistName?: string
}

export function ModuleGridUser({ modules, playlistId, playlistName }: Props) {
  const [progressByModuleId, setProgressByModuleId] = useState<
    Record<string, { percent: number; completedLessons: number; totalLessons: number }>
  >({})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/progress/playlist/${playlistId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { modules?: unknown }
        const raw = data.modules
        if (!raw || typeof raw !== 'object') return

        const next: Record<
          string,
          { percent: number; completedLessons: number; totalLessons: number }
        > = {}

        const byModule = raw as Record<string, unknown>
        for (const [moduleId, value] of Object.entries(byModule)) {
          if (!value || typeof value !== 'object') continue
          const v = value as Record<string, unknown>
          const percent = typeof v.percent === 'number' ? v.percent : 0
          const completedLessons =
            typeof v.completedLessons === 'number' ? v.completedLessons : 0
          const totalLessons = typeof v.totalLessons === 'number' ? v.totalLessons : 0
          next[moduleId] = { percent, completedLessons, totalLessons }
        }

        if (!cancelled) setProgressByModuleId(next)
      } catch {
        // ignore
      }
    }

    void load()

    const onFocus = () => void load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [playlistId])

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-foreground">{playlistName || 'Module'}</h1>
      </div>

      <div className="grid w-full max-w-[1920px] grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-6 auto-rows-fr">
        {modules.map((modul) => (
          <ModuleCardUser
            key={modul.id}
            modul={modul}
            progress={progressByModuleId[modul.id] ?? null}
          />
        ))}
      </div>
    </div>
  )
}


