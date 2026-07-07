'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { claimIndicatorForUser } from '@/lib/indicators/store'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getRaidMapAccessState, getRaidMapIndicator } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'
import { sendCortanaTelegram } from '@/lib/telegram-notify'

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
    // Raid-Map-Kunden duerfen ihren TV-Namen selbst korrigieren; der alte
    // TradingView-Grant wird dabei best effort automatisch entzogen —
    // nur bei Fehlschlag geht eine ⚠️-Telegram-Meldung an Petar.
    allowRebind: true,
  })

  if (result.ok && result.reboundFrom) {
    const revoke = result.rebindRevoke
    if (revoke && revoke.failed > 0) {
      const reason = revoke.firstError ?? 'unbekannter Fehler'
      await sendCortanaTelegram(
        `⚠️ Raid Map: TV-Username geändert\n@${result.reboundFrom} → @${result.tvUsername}\nAlten Zugang @${result.reboundFrom} in TradingView "Manage access" manuell entfernen (Auto-Revoke fehlgeschlagen: ${reason}).`
      )
    } else if (revoke && revoke.attempted > 0) {
      await sendCortanaTelegram(
        `✅ Raid Map: Zugang von @${result.reboundFrom} zu @${result.tvUsername} umgezogen (alter Zugang entfernt).`
      )
    } else {
      // Nichts zu entziehen: der alte Name hatte nie einen erfolgreichen Grant.
      await sendCortanaTelegram(
        `✅ Raid Map: Zugang von @${result.reboundFrom} zu @${result.tvUsername} umgezogen (kein alter Zugang vorhanden).`
      )
    }
  }

  revalidatePath(RAIDMAP_CONFIG.accountPath)
  return { ok: result.ok, message: result.message ?? (result.ok ? 'Access request queued.' : 'Something went wrong.') }
}

export type RaidMapTestimonialResult = { ok: boolean; message: string }

// Muss zum maxLength der Testimonial-Form passen (testimonial-form.tsx).
// Kein export: 'use server'-Module duerfen nur async Functions exportieren.
const TESTIMONIAL_TEXT_MAX = 600
const TESTIMONIAL_NAME_MAX = 80

// Testimonial einreichen: nur mit aktivem Raid-Map-Abo, max. 1 pending pro
// User (bestehendes pending wird aktualisiert statt dupliziert). Geht erst
// nach Review durch Petar live — die Erfolgsmeldung sagt das ehrlich.
export async function submitRaidMapTestimonialAction(input: {
  displayName: string
  rating: number
  text: string
}): Promise<RaidMapTestimonialResult> {
  const { userId: clerkUserId } = await auth()
  // Dev-only Test-Mode: gleicher Fallback wie claimRaidMapAction
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    return { ok: false, message: 'Please sign in again.' }
  }

  const access = await getRaidMapAccessState(userId)
  if (!access.hasAccess) {
    return { ok: false, message: 'No active Raid Map subscription found for this account.' }
  }

  const displayName = String(input.displayName ?? '').trim().slice(0, TESTIMONIAL_NAME_MAX)
  const text = String(input.text ?? '').trim().slice(0, TESTIMONIAL_TEXT_MAX)
  const rating = Math.round(Number(input.rating))

  if (!displayName) {
    return { ok: false, message: 'Please add a name — that’s what shows next to your words.' }
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: 'Please pick a rating (1–5 stars).' }
  }
  if (!text) {
    return { ok: false, message: 'Please write a sentence or two.' }
  }

  const existingPending = await withPrismaRetry(
    () =>
      prisma.raidMapTestimonial.findFirst({
        where: { userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    { label: 'Load pending raidmap testimonial' }
  )

  if (existingPending) {
    await withPrismaRetry(
      () =>
        prisma.raidMapTestimonial.update({
          where: { id: existingPending.id },
          data: { displayName, text, rating },
        }),
      { label: 'Update pending raidmap testimonial' }
    )
  } else {
    await withPrismaRetry(
      () => prisma.raidMapTestimonial.create({ data: { userId, displayName, text, rating } }),
      { label: 'Create raidmap testimonial' }
    )
  }

  await sendCortanaTelegram(
    `📝 Neues Raid-Map-Testimonial (pending) von ${displayName} (${rating}/5)`
  )

  return { ok: true, message: 'Thanks! Your feedback goes live after a quick review.' }
}
