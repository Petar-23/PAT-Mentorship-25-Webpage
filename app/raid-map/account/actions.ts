'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import {
  claimIndicatorForUser,
  processTradingViewClaimInstantly,
} from '@/lib/indicators/store'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getRaidMapAccessState, getRaidMapIndicator } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'
import { sendCortanaTelegram } from '@/lib/telegram-notify'

export type RaidMapClaimResult = { ok: boolean; message: string }

function localize(lang: RaidMapLang, english: string, german: string) {
  return lang === 'de' ? german : english
}

export async function claimRaidMapAction(
  tvUsername: string,
  lang: RaidMapLang = 'en'
): Promise<RaidMapClaimResult> {
  const { userId: clerkUserId } = await auth()
  // Dev-only Test-Mode: gleicher Fallback wie auf der Account-Seite
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    return { ok: false, message: localize(lang, 'Please sign in again.', 'Bitte melde dich erneut an.') }
  }

  const access = await getRaidMapAccessState(userId)
  if (!access.hasAccess) {
    return {
      ok: false,
      message: localize(
        lang,
        'No active Raid Map subscription found for this account.',
        'Für diesen Account wurde kein aktives Raid-Map-Abo gefunden.'
      ),
    }
  }

  const indicator = await getRaidMapIndicator()
  if (!indicator || !indicator.ready || !indicator.pineId?.startsWith('PUB;')) {
    return {
      ok: false,
      message: localize(
        lang,
        'Access provisioning is being set up. Your username was received; please check back shortly or contact support.',
        'Die Freigabe wird gerade eingerichtet. Dein Username wurde gespeichert; prüfe den Status bitte gleich noch einmal oder kontaktiere den Support.'
      ),
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

  let message = result.message ?? (result.ok ? 'Access request queued.' : 'Something went wrong.')
  if (result.ok && result.claimStatus !== 'granted') {
    try {
      const instant = await processTradingViewClaimInstantly({
        userId,
        indicatorId: indicator.id,
        workerId: 'raidmap-account-instant',
      })

      if (instant.status === 'granted') {
        message = localize(
          lang,
          'Access granted. PAT Raid Map is now available on your TradingView account.',
          'Zugang erteilt. PAT Raid Map ist jetzt in deinem TradingView-Account verfügbar.'
        )
      } else if (instant.blockedBySession) {
        message = localize(
          lang,
          'Your request is saved. We are reconnecting TradingView and will retry automatically.',
          'Deine Anfrage ist gespeichert. Wir verbinden TradingView neu und versuchen es automatisch erneut.'
        )
      } else if (instant.status === 'processing') {
        message = localize(
          lang,
          'Your request is saved and is being processed right now.',
          'Deine Anfrage ist gespeichert und wird gerade verarbeitet.'
        )
      } else if (instant.status === 'failed') {
        message =
          instant.errorMessage ??
          localize(
            lang,
            'TradingView could not finish the activation yet. We will retry automatically.',
            'TradingView konnte die Freigabe noch nicht abschließen. Wir versuchen es automatisch erneut.'
          )
      }
    } catch (error) {
      console.error('[raidmap] Instant account claim failed; cron will retry:', error)
    }
  }

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
  revalidatePath(RAIDMAP_CONFIG.accountPathDe)
  return { ok: result.ok, message }
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
}, lang: RaidMapLang = 'en'): Promise<RaidMapTestimonialResult> {
  const { userId: clerkUserId } = await auth()
  // Dev-only Test-Mode: gleicher Fallback wie claimRaidMapAction
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    return { ok: false, message: localize(lang, 'Please sign in again.', 'Bitte melde dich erneut an.') }
  }

  const access = await getRaidMapAccessState(userId)
  if (!access.hasAccess) {
    return {
      ok: false,
      message: localize(
        lang,
        'No active Raid Map subscription found for this account.',
        'Für diesen Account wurde kein aktives Raid-Map-Abo gefunden.'
      ),
    }
  }

  const displayName = String(input.displayName ?? '').trim().slice(0, TESTIMONIAL_NAME_MAX)
  const text = String(input.text ?? '').trim().slice(0, TESTIMONIAL_TEXT_MAX)
  const rating = Math.round(Number(input.rating))

  if (!displayName) {
    return {
      ok: false,
      message: localize(
        lang,
        'Please add a name. It will be shown next to your words.',
        'Bitte gib einen Namen an. Er wird neben deinem Beitrag angezeigt.'
      ),
    }
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return {
      ok: false,
      message: localize(lang, 'Please pick a rating (1-5 stars).', 'Bitte wähle eine Bewertung von 1 bis 5 Sternen.'),
    }
  }
  if (!text) {
    return {
      ok: false,
      message: localize(lang, 'Please write a sentence or two.', 'Bitte schreibe ein oder zwei Sätze.'),
    }
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

  return {
    ok: true,
    message: localize(
      lang,
      'Thanks! Your feedback goes live after a quick review.',
      'Danke! Dein Feedback erscheint nach einer kurzen Prüfung.'
    ),
  }
}
