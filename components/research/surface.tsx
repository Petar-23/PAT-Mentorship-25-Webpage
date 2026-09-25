'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { isResearchSurfaceHostname, isResearchSurfacePathname } from '@/lib/research/surface.mjs'

// Root-Chrome-Hook (Tracking, Cookie-Banner) — bewusst getrennt von base-path.tsx,
// damit das Client-Bundle aller Seiten nicht die Research-Routing-Logik und
// -Konfiguration mitlädt.

const subscribeToNothing = () => () => {}
const readIsResearchBrowserHost = () => isResearchSurfaceHostname(window.location.hostname)
const readUnknownOnServer = () => null

/**
 * true auf Research-Seiten, false auf der Haupt-Seite, null solange unbekannt
 * (Server-Rendering und Hydration auf einem Research-Host ohne /research im Pfad).
 * Wer etwas nur auf der Haupt-Seite rendern will, prüft deshalb `=== false`.
 */
export function useIsResearchSurface(): boolean | null {
  const pathname = usePathname()
  const isResearchBrowserHost = useSyncExternalStore<boolean | null>(
    subscribeToNothing,
    readIsResearchBrowserHost,
    readUnknownOnServer
  )
  if (isResearchSurfacePathname(pathname)) return true
  return isResearchBrowserHost
}
