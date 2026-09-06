'use client'

import { MagnifyingGlass, SquaresFour, ListBullets } from '@/components/mentorship/icons'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ModuleCardUser } from './module-card-user'

type Props = {
  modules: Array<{
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    chaptersCount: number
    totalDurationSeconds: number | null
  }>
  playlistName?: string
  playlistDescription?: string | null
  progressByModuleId: Record<
    string,
    { percent: number; completedLessons: number; totalLessons: number }
  >
}

export function ModuleGridUser({
  modules,
  playlistName,
  playlistDescription,
  progressByModuleId,
}: Props) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedView, setSelectedView] = useState<'grid' | 'list'>('grid')
  const [presentCards, setPresentCards] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const requestedViewRef = useRef<'grid' | 'list'>('grid')
  const search = query.trim().toLocaleLowerCase('de')
  const orderedModules = modules.map((module, index) => ({ ...module, artwork: index % 2 ? 'focus' as const : 'structure' as const }))
  const visibleModules = search ? orderedModules.filter(module =>
    `${module.name} ${module.description ?? ''}`.toLocaleLowerCase('de').includes(search)
  ) : orderedModules

  useEffect(() => () => {
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  async function changeView(nextView: 'grid' | 'list') {
    if (nextView === requestedViewRef.current) return
    requestedViewRef.current = nextView
    setSelectedView(nextView)
    setPresentCards(false)

    const grid = gridRef.current
    const currentStyle = grid ? getComputedStyle(grid) : null
    const from = { opacity: currentStyle?.opacity ?? '1', transform: currentStyle?.transform ?? 'none' }
    animationRef.current?.cancel()
    animationRef.current = null

    if (!grid || !visibleModules.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setView(nextView)
      return
    }

    const leaving = grid.animate([from, { opacity: 0, transform: 'translateY(-4px)' }], {
      duration: 100, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards',
    })
    animationRef.current = leaving
    await leaving.finished.catch(() => null)
    if (animationRef.current !== leaving) return

    // Change the layout while invisible, before the browser starts revealing it.
    flushSync(() => setView(nextView))
    const entering = grid.animate([
      { opacity: 0, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 200, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' })
    animationRef.current = entering
    leaving.cancel()
    await entering.finished.catch(() => null)
    if (animationRef.current === entering) {
      entering.cancel()
      animationRef.current = null
    }
  }

  return (
    <div className="m-page m-course-page">
      <div className="m-page-header">
        <div>
          <p className="m-eyebrow">Kurs</p>
          <h1 className="m-page-title">{playlistName || 'Module'}</h1>
          {playlistDescription?.trim() ? <p className="m-page-intro">{playlistDescription}</p> : null}
        </div>
      </div>
      <div className="m-modules-toolbar">
        <label className="m-search">
          <MagnifyingGlass aria-hidden="true" />
          <input type="search" aria-label="Module durchsuchen" placeholder="Modul finden…" value={query} onChange={event => { setPresentCards(false); setQuery(event.target.value) }} />
        </label>
        <div className="m-view-options">
          <p aria-live="polite">{search ? `${visibleModules.length} Treffer` : `${modules.length} ${modules.length === 1 ? 'Modul' : 'Module'}`}</p>
          <div className="m-view-control" data-view={selectedView} role="group" aria-label="Modulansicht">
            <button type="button" aria-label="Kachelansicht" title="Kachelansicht" aria-pressed={selectedView === 'grid'} onClick={() => changeView('grid')}><SquaresFour /></button>
            <button type="button" aria-label="Listenansicht" title="Listenansicht" aria-pressed={selectedView === 'list'} onClick={() => changeView('list')}><ListBullets /></button>
          </div>
        </div>
      </div>
      <div ref={gridRef} className={visibleModules.length ? 'm-module-grid' : 'm-empty'} data-view={view} data-present={presentCards} role={visibleModules.length ? undefined : 'status'}>
        {visibleModules.length ? visibleModules.map((modul, index) => <ModuleCardUser key={modul.id} modul={modul} entranceOrder={index} artwork={modul.artwork} progress={progressByModuleId[modul.id] ?? null} />) : <>
          <h2>{search ? 'Noch nicht gefunden.' : 'Hier geht es bald los.'}</h2>
          <p>{search ? 'Versuch es mit einem anderen Begriff.' : 'Die Module für diesen Kurs erscheinen hier, sobald sie bereit sind.'}</p>
          {search ? <button type="button" className="m-text-link mt-4" onClick={() => setQuery('')}>Alle Module anzeigen</button> : null}
        </>}
      </div>
    </div>
  )
}
