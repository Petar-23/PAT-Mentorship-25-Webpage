import 'server-only'

import type { RaidMapAccessState } from '@/lib/raidmap-access'

// Dev-only Test-Mode für den PAT-Raid-Map-Flow: erlaubt lokales Testen von
// Account-Seite, Claim-Action und Checkout OHNE Clerk-Login und OHNE Stripe.
//
// Doppelter Guard (beide Bedingungen müssen gelten, zentral NUR hier geprüft):
//   1. NODE_ENV !== 'production'  → in Production-Builds immer aus
//   2. RAIDMAP_TEST_MODE === '1'  → muss explizit in .env.local gesetzt sein
//
// Env-Vars (alle optional außer RAIDMAP_TEST_MODE):
//   RAIDMAP_TEST_MODE=1                       → aktiviert den Test-Mode
//   RAIDMAP_TEST_ACCESS=active|trialing|none  → simulierter Abo-Status (default: trialing)
//   RAIDMAP_TEST_TIER=monthly|annual          → simulierter Plan (default: monthly)

export const RAIDMAP_TEST_USER_ID = 'raidmap_test_user'

export function isRaidMapTestMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.RAIDMAP_TEST_MODE === '1'
}

export function getRaidMapTestAccess(): RaidMapAccessState {
  const rawAccess = process.env.RAIDMAP_TEST_ACCESS
  const access: 'active' | 'trialing' | 'none' =
    rawAccess === 'active' || rawAccess === 'none' ? rawAccess : 'trialing'

  if (access === 'none') {
    return { hasAccess: false, status: null, tier: null }
  }

  const tier: 'monthly' | 'annual' =
    process.env.RAIDMAP_TEST_TIER === 'annual' ? 'annual' : 'monthly'

  return { hasAccess: true, status: access, tier }
}
