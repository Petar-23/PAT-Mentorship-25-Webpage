// Zentrale Konfiguration für PAT Raid Map (TradingView-Indikator, Einzelprodukt)
// Preise/Fakten hier ändern — wirkt auf Sales-Page (EN+DE), Docs und Checkout.
// Stripe-Price-IDs kommen NIE in den Code: nur Env-Vars (siehe docs/RAIDMAP_STRIPE_SETUP.md).

export const RAIDMAP_CONFIG = {
  productName: 'PAT Raid Map',
  currency: 'USD',

  // Pricing (international, USD) — Launch-Offer: erste 300 Mitglieder, danach +20%.
  // Streichpreise sind die ECHTEN Preise nach der Erhöhung (kein Fantasie-Anker).
  monthlyPrice: 45,
  monthlyPriceFormatted: '$45',
  monthlyPriceAfterFormatted: '$54',
  annualMonthlyPrice: 29,
  annualMonthlyPriceFormatted: '$29',
  annualMonthlyAfterFormatted: '$35',
  annualTotal: 348,
  annualTotalFormatted: '$348',
  annualSavingsPct: 36,
  launchSpots: 300,
  priceIncreasePct: 20,
  trialDays: 7,

  // Delivery
  platform: 'TradingView (invite-only)',
  markets: 'Built and validated on NQ futures',

  // Evidence (aus docs/PAT_RAIDMAP_CLAIMS_INVENTORY_20260706.md im trading-bot-workspace)
  yearsOfData: 10,
  trainingDays: 2327,
  sessionEvents: 13136,
  pivotsAnalyzed: 575439,
  validatedRules: 86,

  // Links
  salesPathEn: '/raid-map',
  salesPathDe: '/raid-map/de',
  docsPathEn: '/raid-map/docs',
  docsPathDe: '/raid-map/docs/de',
  accountPath: '/raid-map/account',

  // Fulfillment: Indicator-Datensatz (Owner-Bereich) MUSS diesen Slug tragen,
  // damit Checkout-Claims und Account-Bereich ihn finden.
  indicatorSlug: 'pat-raid-map',
  guideImagePath: '/images/raidmap/find-invite-only.png',
} as const

export type RaidMapConfig = typeof RAIDMAP_CONFIG
export type RaidMapLang = 'en' | 'de'
export type RaidMapTier = 'monthly' | 'annual'
