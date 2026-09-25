import 'server-only'

import { prisma, withPrismaRetry } from '@/lib/prisma'
import { computeResearchAccess } from '@/lib/research/access-rules.mjs'
import { getResearchTestAccessOverride } from '@/lib/research/test-mode'

// Zugangs-Status für PAT Research: rein über den ResearchSubscription-Cache
// (Webhook und /welcome halten ihn aktuell). Die Regeln selbst stehen in
// lib/research/access-rules.mjs (reine Funktion, per node:test abgedeckt).
// Wird bei JEDER Anfrage neu geprüft (Seiten, API, später MCP/RSS/Telegram).

export type ResearchAccessSource = 'subscription' | 'admin' | 'test'

export type ResearchAccessState = ReturnType<typeof computeResearchAccess> & {
  source: ResearchAccessSource
}

export async function getResearchAccessState(
  userId: string,
  nowMs: number = Date.now()
): Promise<ResearchAccessState> {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('getResearchAccessState requires a userId')
  }

  // Dev-only Test-Mode: simulierter Abo-Zustand, keine DB-Abfrage
  // (doppelt geguarded in lib/research/test-mode.ts, in Production immer aus).
  const override = getResearchTestAccessOverride(nowMs)
  if (override) {
    return { ...computeResearchAccess(override.row, nowMs), source: 'test' }
  }

  const subscription = await withPrismaRetry(
    () =>
      prisma.researchSubscription.findUnique({
        where: { userId },
        select: {
          status: true,
          tier: true,
          billingInterval: true,
          cancelAtPeriodEnd: true,
          cancelAt: true,
          currentPeriodEnd: true,
          pastDueSince: true,
          updatedAt: true,
        },
      }),
    { label: 'Load research subscription' }
  )

  return { ...computeResearchAccess(subscription, nowMs), source: 'subscription' }
}

/**
 * Fail-closed Ersatz, wenn der Abo-Status nicht geladen werden konnte (DB-Fehler):
 * kein Zugang, keine Abo-Daten. Nur für die Anzeige öffentlicher Seiten gedacht
 * (siehe getResearchViewer); Zugangs-Entscheidungen werfen stattdessen.
 */
export function unavailableResearchAccessState(nowMs: number = Date.now()): ResearchAccessState {
  return { ...computeResearchAccess(null, nowMs), source: 'subscription' }
}

/**
 * Admins (org:admin) haben immer Zugang. Die echten Abo-Daten bleiben erhalten
 * (z. B. für die Account-Seite), nur `hasAccess` und `source` werden gesetzt.
 */
export function withResearchAdminAccess(state: ResearchAccessState): ResearchAccessState {
  return { ...state, hasAccess: true, source: 'admin' }
}
