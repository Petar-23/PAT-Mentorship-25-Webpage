'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { claimIndicatorForUser } from '@/lib/indicators/store'
import { getRaidMapAccessState, getRaidMapIndicator } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'

export type RaidMapClaimResult = { ok: boolean; message: string }

export async function claimRaidMapAction(tvUsername: string): Promise<RaidMapClaimResult> {
  const { userId: clerkUserId } = await auth()
  // Dev-only Test-Mode: gleicher Fallback wie auf der Account-Seite
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    return { ok: false, message: 'Please sign in again.' }
  }

  const access = await getRaidMapAccessState(userId)
  if (!access.hasAccess) {
    return { ok: false, message: 'No active Raid Map subscription found for this account.' }
  }

  const indicator = await getRaidMapIndicator()
  if (!indicator || !indicator.ready || !indicator.pineId?.startsWith('PUB;')) {
    return {
      ok: false,
      message: 'Access provisioning is being set up — your username was received, please check back shortly or contact support.',
    }
  }

  const result = await claimIndicatorForUser({
    userId,
    indicatorId: indicator.id,
    tvUsername,
  })

  revalidatePath(RAIDMAP_CONFIG.accountPath)
  return { ok: result.ok, message: result.message ?? (result.ok ? 'Access request queued.' : 'Something went wrong.') }
}
