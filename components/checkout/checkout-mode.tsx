'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Schalter CHECKOUT_GUEST_ENABLED für Client-Komponenten. Der Wert kommt aus app/layout.tsx
// (lib/checkout-mode.ts liest die Umgebung auf dem Server). Ohne Provider: aus, also alter Weg.

const GuestCheckoutContext = createContext(false)

export function CheckoutModeProvider({ guestCheckout, children }: { guestCheckout: boolean; children: ReactNode }) {
  return <GuestCheckoutContext.Provider value={guestCheckout}>{children}</GuestCheckoutContext.Provider>
}

export function useGuestCheckout(): boolean {
  return useContext(GuestCheckoutContext)
}

/** Ziel der Kauf-CTAs im Gast-Checkout, mit Herkunft (z. B. hero_cta) für die Auswertung. */
export function checkoutEntryHref(source: string): string {
  return `/checkout?src=${encodeURIComponent(source)}`
}

export const LEGACY_FLOW_HINT = 'Kostenlos anmelden → Konditionen prüfen → sicher über Stripe buchen'
export const GUEST_FLOW_HINT = 'Konditionen prüfen → sicher über Stripe bezahlen → Konto wird automatisch angelegt'

/** Kurzer Ablauf-Hinweis unter den Kauf-CTAs, passend zum aktiven Kaufweg. */
export function CheckoutFlowHint({ className }: { className?: string }) {
  const guestCheckout = useGuestCheckout()
  return <p className={className}>{guestCheckout ? GUEST_FLOW_HINT : LEGACY_FLOW_HINT}</p>
}
