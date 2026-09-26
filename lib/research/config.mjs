// Zentrale Konfiguration für PAT Research (research.price-action-trader.de).
// Reines ESM ohne Server-Abhängigkeiten: wird von Middleware, Server, Client
// und den node:test-Tests gleichermaßen importiert.
// Stripe-Price-IDs kommen NIE in den Code, nur über Env-Vars (siehe
// RESEARCH_PRICE_ENV unten und docs/research/PAT_RESEARCH_BUILD_PLAN.md).

export const RESEARCH_PRODUCT = 'research'

/** @typedef {'reader' | 'member' | 'supporter'} ResearchTier */
/** @typedef {'month' | 'year'} ResearchInterval */

/** @type {readonly ResearchTier[]} */
export const RESEARCH_TIERS = Object.freeze(['reader', 'member', 'supporter'])
/** @type {readonly ResearchInterval[]} */
export const RESEARCH_INTERVALS = Object.freeze(['month', 'year'])

// Alle drei Stufen haben denselben Zugang ("pay what you can"). Nur Supporter
// kann sich freiwillig im Video-Abspann nennen lassen (Opt-in, standardmäßig aus).
export const RESEARCH_TIER_DETAILS = Object.freeze({
  reader: Object.freeze({ label: 'Reader', monthlyUsd: 7, annualUsd: 70, recommended: false, supporterCredit: false }),
  member: Object.freeze({ label: 'Member', monthlyUsd: 10, annualUsd: 100, recommended: true, supporterCredit: false }),
  supporter: Object.freeze({ label: 'Supporter', monthlyUsd: 15, annualUsd: 150, recommended: false, supporterCredit: true }),
})

export const RESEARCH_DEFAULT_TIER = 'member'
export const RESEARCH_DEFAULT_INTERVAL = 'month'

// Env-Var-Namen der sechs Stripe-Preise (USD; je Stufe ein Produkt, siehe
// RESEARCH_TIER_PRODUCT_ENV).
export const RESEARCH_PRICE_ENV = Object.freeze({
  reader: Object.freeze({ month: 'STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY', year: 'STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL' }),
  member: Object.freeze({ month: 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', year: 'STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL' }),
  supporter: Object.freeze({ month: 'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY', year: 'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL' }),
})

// Drei eigene Billing-Portal-Konfigurationen (scripts/research-stripe-setup.mjs):
// Planwechsel nur innerhalb desselben Intervalls. Ein Wechsel Monat <-> Jahr
// setzt bei Stripe den Abrechnungsanker zurück und bucht sofort ab — mit
// proration_behavior 'none' ohne Gutschrift für die Restlaufzeit. 'basic'
// (ohne Planwechsel) gilt, wenn das Intervall des Abos unbekannt ist.
export const RESEARCH_PORTAL_CONFIGURATION_ENV = Object.freeze({
  month: 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY',
  year: 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL',
  basic: 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC',
})

// Stripe-Produkte: EIN Produkt je Stufe ("PAT Research Reader|Member|Supporter"),
// jeweils mit einem Monats- und einem Jahrespreis. Das Kundenportal erlaubt pro
// Produkt nur EINEN Preis je Intervall ("You can't define multiple Prices with
// the same product and recurring.interval values") — mit einem gemeinsamen
// Produkt ließe sich der Stufenwechsel im Portal nicht konfigurieren.
// Die IDs dienen außerdem als Fallback beim Zuordnen rotierter Preise
// (price.metadata.research_tier muss zum Produkt dieser Stufe passen).
export const RESEARCH_TIER_PRODUCT_ENV = Object.freeze({
  reader: 'STRIPE_RESEARCH_PRODUCT_ID_READER',
  member: 'STRIPE_RESEARCH_PRODUCT_ID_MEMBER',
  supporter: 'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER',
})


// Öffentliche Domain der Research-Plattform. Ist sie in Production nicht
// gesetzt, bleibt Research dort komplett aus (Kill-Switch, siehe routing.mjs).
export const RESEARCH_HOST_ENV = 'RESEARCH_PUBLIC_HOST'
export const RESEARCH_DEFAULT_HOST = 'research.price-action-trader.de'

// Interner Routen-Präfix (app/research/**). Auf der Subdomain unsichtbar,
// in Previews und lokal der sichtbare Pfad ("Pfad-Modus").
export const RESEARCH_PATH_PREFIX = '/research'

// Stripe-Customer-Metadata-Schlüssel. Bewusst NICHT "userId", damit die
// Mentorship-Suchen (metadata['userId']) diesen USD-Customer nie aufgreifen.
// Vor den Mentorship-Email-Fallbacks schützt das allein NICHT: dafür muss der
// Schlüssel in PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS (lib/stripe-customer-scope.mjs)
// stehen — abgesichert durch lib/research/customer-scope.test.mjs.
export const RESEARCH_CUSTOMER_METADATA_KEY = 'researchUserId'

// past_due: kurze Kulanz statt eines ganzen neuen Abrechnungszeitraums.
export const RESEARCH_PAST_DUE_GRACE_MS = 72 * 60 * 60 * 1000

// Textversionen der Einwilligungen. Bei jeder inhaltlichen Textänderung
// hochzählen, damit das Nachweis-Log den exakten Wortlaut referenziert.
export const RESEARCH_CONSENT_VERSIONS = Object.freeze({
  terms: 'terms-2026-09-25-draft',
  withdrawalWaiver: 'withdrawal-waiver-2026-09-25-draft',
})

export const RESEARCH_CONSENT_TEXT = Object.freeze({
  terms:
    'I have read and agree to the PAT Research Terms of Service, including that all content is for personal, educational use only and is not financial advice.',
  withdrawalWaiver:
    'I request immediate access to PAT Research. I acknowledge that my right of withdrawal expires once access to the digital content begins.',
})

/** @param {unknown} value @returns {value is ResearchTier} */
export function isResearchTier(value) {
  return typeof value === 'string' && RESEARCH_TIERS.includes(/** @type {ResearchTier} */ (value))
}

/** @param {unknown} value @returns {value is ResearchInterval} */
export function isResearchInterval(value) {
  return typeof value === 'string' && RESEARCH_INTERVALS.includes(/** @type {ResearchInterval} */ (value))
}

/**
 * Env-Var-Name für Stufe und Intervall.
 * @param {ResearchTier} tier
 * @param {ResearchInterval} interval
 */
export function researchPriceEnvName(tier, interval) {
  return RESEARCH_PRICE_ENV[tier][interval]
}

/**
 * Liest die Price-ID aus einer Env-Map (in Produktion process.env).
 * @param {ResearchTier} tier
 * @param {ResearchInterval} interval
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function getResearchPriceId(tier, interval, env) {
  const value = env[researchPriceEnvName(tier, interval)]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Stripe-Produkt-ID der Stufe aus einer Env-Map (in Produktion process.env).
 * @param {ResearchTier} tier
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function getResearchTierProductId(tier, env) {
  if (!isResearchTier(tier)) return null
  const value = env[RESEARCH_TIER_PRODUCT_ENV[tier]]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Ordnet eine Stripe-Price-ID wieder Stufe und Intervall zu (nur konfigurierte
 * Research-Preise). Unbekannte Preise liefern null — sie geben keinen Zugang.
 * @param {string | null | undefined} priceId
 * @param {Record<string, string | undefined>} env
 * @returns {{ tier: ResearchTier, interval: ResearchInterval } | null}
 */
export function resolveResearchPrice(priceId, env) {
  if (!priceId) return null
  for (const tier of RESEARCH_TIERS) {
    for (const interval of RESEARCH_INTERVALS) {
      if (getResearchPriceId(tier, interval, env) === priceId) return { tier, interval }
    }
  }
  return null
}

/** @param {number} usd */
export function formatUsd(usd) {
  return `$${Number.isInteger(usd) ? usd : usd.toFixed(2)}`
}
