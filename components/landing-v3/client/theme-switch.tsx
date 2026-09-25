'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { applyLandingTheme, THEME_STORAGE_KEY, type ThemePreference } from '@/components/landing-v3/theme-core'

// Kleiner Modul-Store für die Wahl im Umschalter (localStorage, auch zwischen Tabs).
const listeners = new Set<() => void>()
// Wahl, die nicht gespeichert werden konnte (Speicher gesperrt): gilt dann nur für diese Seite.
let memoryPreference: ThemePreference | null = null

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function writePreference(value: ThemePreference) {
  try {
    if (value === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, value)
    memoryPreference = null
  } catch {
    memoryPreference = value
  }
  listeners.forEach((listener) => listener())
}

function getPreference(): ThemePreference {
  return memoryPreference ?? readPreference()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const getServerPreference = (): ThemePreference => 'auto'

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: ReactNode }> = [
  {
    value: 'auto',
    label: 'Automatisch nach Tageszeit',
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v11" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'Tag',
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.8" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Nacht',
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" />
      </svg>
    ),
  },
]

/**
 * Umschalter Auto/Tag/Nacht als Radiogruppe mit Roving-Tabindex (ein Tab-Stopp, Pfeiltasten wählen).
 * Hält das Farbschema am Wrapper aktuell: bei Wahl, jede Minute im Auto-Modus und beim Zurückkehren in den Tab.
 */
export function ThemeSwitch() {
  const groupRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference)
  const [autoTitle, setAutoTitle] = useState(OPTIONS[0].label)

  // Layout-Effekt: nach einer Client-Navigation (Inline-Skript lief nicht) steht das Schema so vor dem ersten Paint.
  useLayoutEffect(() => {
    const root = groupRef.current?.closest('.pat-lf')
    if (!root) return

    const refresh = (animate: boolean) => {
      const state = applyLandingTheme(root, getPreference(), animate)
      setAutoTitle(`Automatisch: hell von ${state.rise} bis ${state.set} Uhr, danach dunkel`)
    }

    if (!root.hasAttribute('data-js')) root.setAttribute('data-js', '')
    refresh(false)

    const unsubscribe = subscribe(() => refresh(true))
    const interval = window.setInterval(() => {
      if (getPreference() === 'auto') refresh(true)
    }, 60_000)
    const onVisibility = () => {
      if (!document.hidden && getPreference() === 'auto') refresh(true)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsubscribe()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % OPTIONS.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + OPTIONS.length) % OPTIONS.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = OPTIONS.length - 1
    if (next === null) return
    event.preventDefault()
    writePreference(OPTIONS[next].value)
    buttonRefs.current[next]?.focus()
  }

  return (
    <div className="seg" role="radiogroup" aria-label="Farbschema" ref={groupRef}>
      {OPTIONS.map((option, index) => {
        const checked = preference === option.value
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            aria-label={option.label}
            title={option.value === 'auto' ? autoTitle : option.label}
            onClick={() => writePreference(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon}
          </button>
        )
      })}
    </div>
  )
}
