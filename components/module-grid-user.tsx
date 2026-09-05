'use client'

import { useEffect, useRef, useState } from 'react'
import { ModuleCardUser } from './module-card-user'
import type { ReactNode } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass'

type Props = {
  modules: Array<{
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    chaptersCount: number
    totalDurationSeconds: number | null
  }>
  playlistId: string
  playlistName?: string
  initialProgressByModuleId?: Record<
    string,
    { percent: number; completedLessons: number; totalLessons: number }
  >
  mobileCoursesDrawer?: ReactNode
}

export function ModuleGridUser({
  modules,
  playlistId,
  playlistName,
  initialProgressByModuleId,
  mobileCoursesDrawer,
}: Props) {
  const [query, setQuery] = useState('')
  const [progressLoading, setProgressLoading] = useState(!initialProgressByModuleId)
  const [fetchedProgressByModuleId, setFetchedProgressByModuleId] = useState<
    Record<string, { percent: number; completedLessons: number; totalLessons: number }>
  >({})
  const progressAbortRef = useRef<AbortController | null>(null)

  const progressByModuleId = initialProgressByModuleId ?? fetchedProgressByModuleId

  useEffect(() => {
    if (initialProgressByModuleId) return

    let cancelled = false

    const load = async () => {
      const controller = new AbortController()
      progressAbortRef.current?.abort()
      progressAbortRef.current = controller

      try {
        const res = await fetch(`/api/progress/playlist/${playlistId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { modules?: unknown }
        if (cancelled || controller.signal.aborted) return

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

        setFetchedProgressByModuleId(next)
      } catch (error) {
        if (controller.signal.aborted) return
        // Progress is non-critical; keep the existing UI state on transient failures.
      } finally {
        if (!cancelled) setProgressLoading(false)
        if (progressAbortRef.current === controller) {
          progressAbortRef.current = null
        }
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
      progressAbortRef.current?.abort()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [playlistId, initialProgressByModuleId])

  const search = query.trim().toLocaleLowerCase('de')
  const visibleModules = search ? modules.filter(module =>
    `${module.name} ${module.description ?? ''}`.toLocaleLowerCase('de').includes(search)
  ) : modules

  return (
    <div className="m-page">
      <div className="m-page-header">
        {mobileCoursesDrawer}
        <div>
          <p className="m-eyebrow">Deine Kurse</p>
          <h1 className="m-page-title">{playlistName || 'Module'}</h1>
          <p className="m-page-intro">Wissen aufbauen. Zusammenhänge erkennen. Im Chart wiederfinden.</p>
        </div>
      </div>
      <div className="m-modules-toolbar">
        <p aria-live="polite">{search ? `${visibleModules.length} Treffer · ` : ''}{modules.length} {modules.length === 1 ? 'Modul' : 'Module'}</p>
        <label className="m-search">
          <MagnifyingGlass aria-hidden="true" />
          <input type="search" aria-label="Module durchsuchen" placeholder="Modul finden…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>
      {visibleModules.length ? <div className="m-module-grid">
        {visibleModules.map(modul => <ModuleCardUser key={modul.id} modul={modul} artwork={modules.indexOf(modul) % 2 ? 'focus' : 'structure'} progress={progressByModuleId[modul.id] ?? null} progressLoading={progressLoading} />)}
      </div> : <div className="m-empty" role="status">
        <h2>{search ? 'Noch nicht gefunden.' : 'Hier geht es bald los.'}</h2>
        <p>{search ? 'Versuch es mit einem anderen Begriff.' : 'Die Module für diesen Kurs erscheinen hier, sobald sie bereit sind.'}</p>
        {search ? <button type="button" className="mt-4 underline underline-offset-4" onClick={() => setQuery('')}>Alle Module anzeigen</button> : null}
      </div>}
    </div>
  )
}
