import 'server-only'

import { parseEnvFlag } from '@/lib/checkout-guest.mjs'

// Schalter für den Gast-Checkout (lib/checkout-guest.mjs). Standard: aus.
// - CHECKOUT_GUEST_ENABLED=true: Kauf-CTAs führen auf /checkout, Konto entsteht nach der Zahlung.
// - sonst: alter Weg (Anmelden, Dashboard, /api/create-checkout) bleibt vollständig erhalten.
// Der Wert wird auf dem Server gelesen und über CheckoutModeProvider (app/layout.tsx) an die
// Client-Komponenten gegeben. Auf Vercel wirkt eine Änderung wie jede Env-Änderung erst nach Redeploy.

export function isGuestCheckoutEnabled(): boolean {
  return parseEnvFlag(process.env.CHECKOUT_GUEST_ENABLED)
}

/** AGB-Checkbox in Stripe (consent_collection). Braucht die AGB-URL im Stripe-Dashboard (Public details). */
export function isStripeTosConsentEnabled(): boolean {
  return parseEnvFlag(process.env.CHECKOUT_TOS_CONSENT)
}

/** Einstieg des alten Kaufwegs, wenn der Schalter aus ist. */
export function legacyEntryPath(signedIn: boolean): string {
  return signedIn ? '/dashboard' : '/sign-in?redirect_url=%2Fdashboard'
}
