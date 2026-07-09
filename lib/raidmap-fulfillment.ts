import 'server-only'

import type Stripe from 'stripe'
import {
  claimIndicatorForUser,
  processTradingViewClaimInstantly,
} from '@/lib/indicators/store'
import { getRaidMapIndicator } from '@/lib/raidmap-access'
import { sendCortanaTelegram } from '@/lib/telegram-notify'

// Nach erfolgreichem Raid-Map-Checkout: TradingView-Username aus dem Checkout-
// Custom-Field lesen und den Invite-Only-Claim sofort verarbeiten. Der
// stündliche TradingView-Cron bleibt als Fallback für temporäre Fehler aktiv.
// Fehler werden NUR geloggt — der Webhook darf am Fulfillment nie scheitern,
// der Kunde kann den Username jederzeit im Account-Bereich nachtragen.

export async function handleRaidMapCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.userId
    if (!userId) {
      console.warn('[raidmap] checkout.session.completed ohne userId in metadata')
      return
    }

    const tvUsername = session.custom_fields
      ?.find((field) => field.key === 'tradingview_username')
      ?.text?.value?.trim()

    // Petars Telegram (Cortana-Chat): Trial-Start sofort melden — unabhaengig
    // davon, ob der Claim unten klappt.
    await sendCortanaTelegram(
      `🚀 Raid Map TRIAL gestartet\nPlan: ${session.metadata?.tier ?? '?'} · ${session.customer_details?.email ?? session.customer_email ?? '?'}\nTV-Username: ${tvUsername || 'nicht angegeben'}`
    )

    if (!tvUsername) {
      console.log('[raidmap] Kein TradingView-Username im Checkout — Claim folgt über den Account-Bereich', { userId })
      return
    }

    const indicator = await getRaidMapIndicator()
    if (!indicator || !indicator.ready || !indicator.pineId?.startsWith('PUB;')) {
      console.warn('[raidmap] Indicator noch nicht claimbar (Owner-Bereich: Slug pat-raid-map, pineId, ready) — Username wird über den Account-Bereich nachgeholt', {
        userId,
        tvUsername,
        indicatorFound: Boolean(indicator),
      })
      return
    }

    const result = await claimIndicatorForUser({
      userId,
      indicatorId: indicator.id,
      tvUsername,
    })
    const instantResult =
      result.ok && result.claimStatus !== 'granted'
        ? await processTradingViewClaimInstantly({
            userId,
            indicatorId: indicator.id,
            workerId: 'raidmap-checkout-instant',
          })
        : null

    console.log('[raidmap] Checkout-Claim verarbeitet', {
      userId,
      tvUsername,
      ok: result.ok,
      claimStatus: instantResult?.status ?? result.claimStatus,
      message: result.message,
    })
  } catch (error) {
    console.error('[raidmap] Fehler beim Checkout-Fulfillment (nicht fatal):', error)
  }
}
