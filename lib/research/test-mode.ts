import 'server-only'

import type { ResearchAccessRow } from '@/lib/research/access-rules.mjs'
import {
  RESEARCH_DEFAULT_INTERVAL,
  RESEARCH_DEFAULT_TIER,
  isResearchInterval,
  isResearchTier,
} from '@/lib/research/config.mjs'

// Dev-only Test-Mode für PAT Research: erlaubt lokales Testen von Pricing,
// Checkout-Validierung, Welcome- und Account-Seite OHNE Stripe. Anders als bei
// der Raid Map bleibt der Clerk-Login echt (Dev-Instanz); simuliert wird nur
// der Abo-Zustand des eingeloggten Users.
//
// Doppelter Guard (beide Bedingungen müssen gelten, zentral NUR hier geprüft):
//   1. NODE_ENV !== 'production'   → in Production-Builds immer aus
//   2. RESEARCH_TEST_MODE === '1'  → muss explizit in .env.local gesetzt sein
//
// Env-Vars (alle optional außer RESEARCH_TEST_MODE):
//   RESEARCH_TEST_MODE=1                    → aktiviert den Test-Mode (Checkout ohne Stripe)
//   RESEARCH_TEST_ACCESS=active|canceling|renewal_pending|past_due|past_due_expired|expired|none
//                                           → simulierter Abo-Zustand für JEDEN eingeloggten User
//                                             (nicht gesetzt/ungültig = echter DB-Zustand)
//   RESEARCH_TEST_TIER=reader|member|supporter  → simulierte Stufe (default: member)
//   RESEARCH_TEST_INTERVAL=month|year           → simuliertes Intervall (default: month)
//
// Bedeutung der Zustände:
//   active            → aktives Abo, verlängert sich
//   canceling         → aktives Abo, zum Periodenende gekündigt
//   renewal_pending   → aktives Abo, Periode vor 1 h abgelaufen, Verlängerungs-
//                       Webhook noch nicht verarbeitet (24-h-Karenz)
//   past_due          → Zahlung fehlgeschlagen, seit 24 h in der 72-h-Kulanz
//   past_due_expired  → Zahlung fehlgeschlagen, Kulanz abgelaufen
//   expired           → gekündigt, Periode vorbei
//   none              → nie abonniert

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const RESEARCH_TEST_ACCESS_VALUES = [
  'active',
  'canceling',
  'renewal_pending',
  'past_due',
  'past_due_expired',
  'expired',
  'none',
] as const

export type ResearchTestAccess = (typeof RESEARCH_TEST_ACCESS_VALUES)[number]

export type ResearchTestAccessOverride = {
  access: ResearchTestAccess
  // null = simuliert "kein Abo" (computeResearchAccess liefert dann reason 'none').
  row: ResearchAccessRow | null
}

export function isResearchTestMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.RESEARCH_TEST_MODE === '1'
}

function readTestAccess(): ResearchTestAccess | null {
  const raw = process.env.RESEARCH_TEST_ACCESS?.trim()
  return RESEARCH_TEST_ACCESS_VALUES.find((value) => value === raw) ?? null
}

/**
 * Simulierter Abo-Zustand für den Test-Mode. Liefert null, wenn der Test-Mode
 * aus ist oder RESEARCH_TEST_ACCESS fehlt — dann gilt der echte DB-Zustand.
 */
export function getResearchTestAccessOverride(nowMs: number = Date.now()): ResearchTestAccessOverride | null {
  if (!isResearchTestMode()) return null

  const access = readTestAccess()
  if (!access) return null
  if (access === 'none') return { access, row: null }

  const rawTier = process.env.RESEARCH_TEST_TIER?.trim()
  const rawInterval = process.env.RESEARCH_TEST_INTERVAL?.trim()
  const tier = isResearchTier(rawTier) ? rawTier : RESEARCH_DEFAULT_TIER
  const interval = isResearchInterval(rawInterval) ? rawInterval : RESEARCH_DEFAULT_INTERVAL
  const periodMs = interval === 'year' ? 365 * DAY_MS : 30 * DAY_MS

  const base = {
    tier,
    billingInterval: interval,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    pastDueSince: null,
    updatedAt: new Date(nowMs),
  }

  switch (access) {
    case 'active':
      return { access, row: { ...base, status: 'active', currentPeriodEnd: new Date(nowMs + periodMs) } }
    case 'canceling': {
      const periodEnd = new Date(nowMs + 10 * DAY_MS)
      return {
        access,
        row: { ...base, status: 'active', currentPeriodEnd: periodEnd, cancelAtPeriodEnd: true, cancelAt: periodEnd },
      }
    }
    case 'renewal_pending':
      return { access, row: { ...base, status: 'active', currentPeriodEnd: new Date(nowMs - HOUR_MS) } }
    case 'past_due':
      return {
        access,
        row: {
          ...base,
          status: 'past_due',
          currentPeriodEnd: new Date(nowMs + periodMs),
          pastDueSince: new Date(nowMs - 24 * HOUR_MS),
        },
      }
    case 'past_due_expired':
      return {
        access,
        row: {
          ...base,
          status: 'past_due',
          currentPeriodEnd: new Date(nowMs + periodMs),
          pastDueSince: new Date(nowMs - 96 * HOUR_MS),
        },
      }
    case 'expired':
      return {
        access,
        row: {
          ...base,
          status: 'canceled',
          currentPeriodEnd: new Date(nowMs - DAY_MS),
          cancelAt: new Date(nowMs - DAY_MS),
        },
      }
  }
}
