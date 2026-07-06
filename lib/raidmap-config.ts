// Zentrale Konfiguration für PAT Raid Map (TradingView-Indikator, Einzelprodukt)
// Preise/Fakten hier ändern — wirkt auf Sales-Page (EN+DE), Docs und Checkout.
// Stripe-Price-IDs kommen NIE in den Code: nur Env-Vars (siehe docs/RAIDMAP_STRIPE_SETUP.md).

export const RAIDMAP_CONFIG = {
  productName: 'PAT Raid Map',
  betaTag: 'BETA',
  currency: 'USD',

  // Pricing (international, USD)
  monthlyPrice: 45,
  monthlyPriceFormatted: '$45',
  annualMonthlyPrice: 29,
  annualMonthlyPriceFormatted: '$29',
  annualTotal: 348,
  annualTotalFormatted: '$348',
  annualSavingsPct: 36,

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
} as const

export type RaidMapConfig = typeof RAIDMAP_CONFIG
export type RaidMapLang = 'en' | 'de'
export type RaidMapTier = 'monthly' | 'annual'
