'use client'

import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  logicalResearchPath,
  researchHref,
  type ResearchBasePath,
} from '@/lib/research/routing.mjs'

// Basis-Pfad für Links innerhalb von Research: '' auf research.*, '/research' im
// Pfad-Modus (Previews, lokal). Der Server bestimmt ihn aus dem Host-Header
// (getResearchRequestContext) und reicht ihn über den Provider an den Client.

export type { ResearchBasePath }

const ResearchBasePathContext = createContext<ResearchBasePath | null>(null)

export function ResearchBasePathProvider({
  basePath,
  children,
}: {
  basePath: ResearchBasePath
  children: ReactNode
}) {
  return <ResearchBasePathContext.Provider value={basePath}>{children}</ResearchBasePathContext.Provider>
}

export function useResearchBasePath(): ResearchBasePath {
  const basePath = useContext(ResearchBasePathContext)
  if (basePath === null) {
    throw new Error('useResearchBasePath() must be used inside <ResearchBasePathProvider>.')
  }
  return basePath
}

/** Liefert `(path) => href`, z. B. href('/pricing') → '/research/pricing' im Pfad-Modus. */
export function useResearchHref(): (path: string) => string {
  const basePath = useResearchBasePath()
  return useCallback((path: string) => researchHref(basePath, path), [basePath])
}

/** Aktueller Pfad ohne Basis ('/pricing'), für aktive Navigation und Rücksprünge. */
export function useResearchLogicalPath(): string {
  const basePath = useResearchBasePath()
  const pathname = usePathname()
  return logicalResearchPath(basePath, pathname)
}

// Der Root-Chrome-Hook useIsResearchSurface liegt in components/research/surface.tsx
// (eigenes Mini-Modul, damit das Client-Bundle aller Seiten klein bleibt).
