import 'server-only'

import type Stripe from 'stripe'
import { claimIndicatorForUser } from '@/lib/indicators/store'
import { getRaidMapIndicator } from '@/lib/raidmap-access'
import { sendCortanaTelegram } from '@/lib/telegram-notify'

// Nach erfolgreichem Raid-Map-Checkout: TradingView-Username aus dem Checkout-
// Custom-Field lesen und den Invite-Only-Claim in die bestehende Queue legen
// (der stündliche TradingView-Cron erledigt den Grant über die Session-Cookies).
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

    console.log('[raidmap] Checkout-Claim angelegt', {
      userId,
      tvUsername,
      ok: result.ok,
      claimStatus: 'claimStatus' in result ? result.claimStatus : undefined,
      message: result.message,
    })
  } catch (error) {
    console.error('[raidmap] Fehler beim Checkout-Fulfillment (nicht fatal):', error)
  }
}
