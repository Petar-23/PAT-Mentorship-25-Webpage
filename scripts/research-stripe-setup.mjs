#!/usr/bin/env node
/**
 * PAT Research — idempotentes Stripe-Setup (NUR Testmodus).
 *
 * Legt an bzw. findet wieder:
 *   - drei Produkte, eines je Stufe: "PAT Research Reader|Member|Supporter"
 *       (metadata.pat_product = research, metadata.research_tier = <tier>)
 *     Grund: Das Kundenportal erlaubt pro Produkt nur EINEN Preis je Intervall
 *     (Stripe: "You can't define multiple Prices with the same product and
 *     recurring.interval values"). Drei Monatspreise an EINEM Produkt lehnt
 *     Stripe als Portal-Katalog ab.
 *   - sechs USD-Abo-Preise, tax_behavior inclusive, je Produkt Monat + Jahr:
 *       Reader 7 / Member 10 / Supporter 15 pro Monat, 70 / 100 / 150 pro Jahr
 *       lookup_key pat_research_<tier>_<interval>_v1, metadata research_tier/research_interval
 *   - drei eigene Billing-Portal-Konfigurationen (metadata.pat_portal):
 *       monthly — Stufenwechsel NUR zwischen den drei Monatspreisen, ohne Proration
 *       annual  — Stufenwechsel NUR zwischen den drei Jahrespreisen, ohne Proration
 *       basic   — kein Preiswechsel (für Abos mit unbekanntem Intervall)
 *     monthly/annual: je Stufenprodukt genau ein Preis.
 *     Alle: Kündigung zum Periodenende mit Grund, Zahlungsmethode, Rechnungen.
 *     Grund: ein Wechsel Monat <-> Jahr setzt bei Stripe den Abrechnungsanker
 *     zurück und bucht sofort ab — mit proration_behavior 'none' ohne Gutschrift.
 *     lib/research/stripe.ts wählt die Konfiguration nach dem Abo-Intervall.
 *
 * Eine aktive Alt-Konfiguration mit pat_product=research, aber ohne pat_portal
 * (früher: EINE Konfiguration für alle sechs Preise) wird gemeldet und nie
 * verändert; das Script bricht ab, bis sie deaktiviert ist.
 *
 * Altes Einzelprodukt "PAT Research" (pat_product=research OHNE research_tier,
 * aus einem früheren Lauf, dessen Portal-Schritt Stripe abgelehnt hat): seine
 * eigenen Preise (metadata pat_product=research) werden durch neue Preise am
 * Stufenprodukt ersetzt; der lookup_key wandert per transfer_lookup_key mit.
 * Das Altprodukt selbst bleibt unverändert und wird nur gemeldet.
 *
 * Usage:
 *   node --env-file=<datei mit STRIPE_SECRET_KEY=sk_test_…> scripts/research-stripe-setup.mjs \
 *     [--apply] [--terms-url https://…/terms] [--privacy-url https://…/privacy]
 *
 * - Ohne --apply: Dry-Run, es wird nichts geschrieben.
 * - Akzeptiert nur Test-Keys (sk_test_… / rk_test_…). Live-Keys werden immer
 *   abgelehnt; ein Live-Pfad (--live --i-have-petars-approval) ist bewusst noch
 *   nicht implementiert.
 * - Erneutes Ausführen findet vorhandene Objekte über Metadaten/lookup_key und
 *   legt nichts doppelt an. Fremde Produkte, Preise und Portal-Konfigurationen
 *   werden nie verändert; eigene Preise mit abweichenden Werten führen zum
 *   Abbruch (Preise sind in Stripe unveränderlich — dann neue _v2-Keys anlegen).
 * - Ausgabe: die Env-Var-Zeilen (nur IDs, nie der Key).
 */

import process from 'node:process'
import { pathToFileURL } from 'node:url'
import Stripe from 'stripe'

import {
  RESEARCH_INTERVALS,
  RESEARCH_PORTAL_CONFIGURATION_ENV,
  RESEARCH_PRICE_ENV,
  RESEARCH_PRODUCT,
  RESEARCH_TIERS,
  RESEARCH_TIER_DETAILS,
  RESEARCH_TIER_PRODUCT_ENV,
  isResearchTier,
} from '../lib/research/config.mjs'

export const STRIPE_API_VERSION = '2024-10-28.acacia'
export const PRODUCT_NAME = 'PAT Research'
export const PRODUCT_DESCRIPTION =
  'Tested studies of ICT concepts on NQ futures — method, charts and numbers. Every tier unlocks the same research.'
// Stripe begrenzt die Portal-Headline auf 60 Zeichen.
export const PORTAL_HEADLINE = 'Manage your PAT Research membership'
export const MARKER_KEY = 'pat_product'
export const TIER_MARKER_KEY = 'research_tier'
export const PORTAL_MARKER_KEY = 'pat_portal'
// Stripe: höchstens 10 Produkte im Portal-Katalog.
const MAX_PORTAL_PRODUCTS = 10
const PENDING = '<created on --apply>'

// Die drei Portal-Konfigurationen in fester Reihenfolge. `interval` null = basic
// (ohne Planwechsel).
export const RESEARCH_PORTALS = Object.freeze([
  Object.freeze({ kind: 'monthly', interval: 'month', envName: RESEARCH_PORTAL_CONFIGURATION_ENV.month }),
  Object.freeze({ kind: 'annual', interval: 'year', envName: RESEARCH_PORTAL_CONFIGURATION_ENV.year }),
  Object.freeze({ kind: 'basic', interval: null, envName: RESEARCH_PORTAL_CONFIGURATION_ENV.basic }),
])

const CANCELLATION_REASONS = Object.freeze([
  'too_expensive',
  'missing_features',
  'switched_service',
  'unused',
  'customer_service',
  'too_complex',
  'low_quality',
  'other',
])

// ---------------------------------------------------------------------------
// Argumente und Key-Prüfung (rein, getestet)
// ---------------------------------------------------------------------------

/** @param {string} value @param {string} flag */
function parseHttpsUrl(value, flag) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${flag} must be an absolute https URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${flag} must be an absolute https URL`)
  return url.toString()
}

/**
 * @param {readonly string[]} argv
 * @returns {{ apply: boolean, live: boolean, liveApproval: boolean, help: boolean, termsUrl: string | null, privacyUrl: string | null }}
 */
export function parseSetupArgs(argv) {
  const args = { apply: false, live: false, liveApproval: false, help: false, termsUrl: null, privacyUrl: null }

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    const [flag, inlineValue] = raw.startsWith('--') && raw.includes('=') ? [raw.slice(0, raw.indexOf('=')), raw.slice(raw.indexOf('=') + 1)] : [raw, undefined]

    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`Missing value for ${flag}`)
      i++
      return next
    }

    switch (flag) {
      case '--apply':
        args.apply = true
        break
      case '--live':
        args.live = true
        break
      case '--i-have-petars-approval':
        args.liveApproval = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      case '--terms-url':
        args.termsUrl = parseHttpsUrl(takeValue(), '--terms-url')
        break
      case '--privacy-url':
        args.privacyUrl = parseHttpsUrl(takeValue(), '--privacy-url')
        break
      default:
        throw new Error(`Unknown argument: ${raw}`)
    }
  }

  return args
}

/**
 * Nur Test-Keys sind erlaubt. Der Key selbst taucht in keiner Meldung auf.
 * @param {string | undefined} key
 * @param {{ live: boolean, liveApproval: boolean }} args
 * @returns {{ ok: true, mode: 'test' } | { ok: false, message: string }}
 */
export function checkStripeKeyMode(key, args) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return { ok: false, message: 'STRIPE_SECRET_KEY is not set.' }
  }
  const trimmed = key.trim()
  if (trimmed.startsWith('sk_live_') || trimmed.startsWith('rk_live_')) {
    return {
      ok: false,
      message:
        args.live && args.liveApproval
          ? 'Live setup is not implemented yet. Run it in test mode and ask for the live rollout separately.'
          : 'Refusing to run with a LIVE Stripe key. Live setup will require an explicit --live --i-have-petars-approval (not implemented yet).',
    }
  }
  if (!trimmed.startsWith('sk_test_') && !trimmed.startsWith('rk_test_')) {
    return { ok: false, message: 'Unrecognized STRIPE_SECRET_KEY format. Only sk_test_… or rk_test_… keys are accepted.' }
  }
  if (args.live) {
    return { ok: false, message: '--live was passed, but STRIPE_SECRET_KEY is a test key. Remove --live.' }
  }
  return { ok: true, mode: 'test' }
}

/**
 * Die sechs Soll-Preise in fester Reihenfolge (Monat, dann Jahr).
 * @returns {Array<{ tier: string, interval: 'month' | 'year', lookupKey: string, unitAmount: number, envName: string, nickname: string }>}
 */
export function desiredResearchPrices() {
  /** @type {Array<{ tier: string, interval: 'month' | 'year', lookupKey: string, unitAmount: number, envName: string, nickname: string }>} */
  const prices = []
  for (const interval of RESEARCH_INTERVALS) {
    for (const tier of RESEARCH_TIERS) {
      const details = RESEARCH_TIER_DETAILS[tier]
      const usd = interval === 'month' ? details.monthlyUsd : details.annualUsd
      prices.push({
        tier,
        interval,
        lookupKey: `pat_research_${tier}_${interval}_v1`,
        unitAmount: Math.round(usd * 100),
        envName: RESEARCH_PRICE_ENV[tier][interval],
        nickname: `${PRODUCT_NAME} ${details.label} (${interval === 'month' ? 'monthly' : 'annual'})`,
      })
    }
  }
  return prices
}

/**
 * Die drei Soll-Produkte (eines je Stufe) in fester Reihenfolge.
 * @returns {Array<{ tier: string, name: string, envName: string }>}
 */
export function desiredResearchProducts() {
  return RESEARCH_TIERS.map((tier) => ({
    tier,
    name: `${PRODUCT_NAME} ${RESEARCH_TIER_DETAILS[tier].label}`,
    envName: RESEARCH_TIER_PRODUCT_ENV[tier],
  }))
}

/**
 * Portal-Katalog einer Intervall-Konfiguration prüfen. Stripe erlaubt je
 * Produkt nur EINEN Preis pro Intervall; da monthly/annual nur ein Intervall
 * enthalten, heißt das: jedes Produkt genau einmal, mit genau einem Preis.
 * @param {Array<{ product: string | null, prices: Array<string | null> }>} products
 */
function assertSingleIntervalPortalCatalog(products) {
  if (!Array.isArray(products) || products.length === 0) throw new Error('Research portal catalog is empty')
  if (products.length > MAX_PORTAL_PRODUCTS) throw new Error(`Research portal catalog has more than ${MAX_PORTAL_PRODUCTS} products`)
  const seen = new Set()
  for (const entry of products) {
    if (typeof entry?.product !== 'string' || entry.product.length === 0) throw new Error('Research portal catalog entry without product id')
    if (seen.has(entry.product)) throw new Error(`Research portal catalog lists product ${entry.product} twice`)
    seen.add(entry.product)
    if (!Array.isArray(entry.prices) || entry.prices.length !== 1 || typeof entry.prices[0] !== 'string') {
      throw new Error(`Research portal catalog needs exactly one price for product ${entry.product} (Stripe allows one price per product and interval)`)
    }
  }
}

/**
 * Soll-Parameter einer der drei Portal-Konfigurationen. `products` ist bei
 * monthly/annual der Katalog dieses Intervalls: je Stufenprodukt genau EIN
 * Preis. basic ignoriert `products` (kein Planwechsel).
 *
 * @param {{ kind: 'monthly' | 'annual' | 'basic', products?: Array<{ product: string, prices: string[] }>, termsUrl: string | null, privacyUrl: string | null }} input
 */
export function buildPortalConfigurationParams({ kind, products = [], termsUrl, privacyUrl }) {
  if (!RESEARCH_PORTALS.some((portal) => portal.kind === kind)) throw new Error(`Unknown research portal kind: ${kind}`)
  let subscriptionUpdate
  if (kind === 'basic') {
    subscriptionUpdate = { enabled: false }
  } else {
    assertSingleIntervalPortalCatalog(products)
    subscriptionUpdate = {
      enabled: true,
      default_allowed_updates: ['price'],
      products: products.map((entry) => ({ product: entry.product, prices: [...entry.prices] })),
      proration_behavior: 'none',
    }
  }
  return {
    business_profile: {
      headline: PORTAL_HEADLINE,
      ...(privacyUrl ? { privacy_policy_url: privacyUrl } : {}),
      ...(termsUrl ? { terms_of_service_url: termsUrl } : {}),
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: { enabled: true, options: [...CANCELLATION_REASONS] },
      },
      subscription_update: subscriptionUpdate,
    },
    metadata: { [MARKER_KEY]: RESEARCH_PRODUCT, [PORTAL_MARKER_KEY]: kind },
  }
}

// ---------------------------------------------------------------------------
// Stripe-Zugriffe
// ---------------------------------------------------------------------------

/** Manuelles Paging (funktioniert mit dem echten SDK und mit Test-Fakes). */
async function listAll(listFn, params = {}) {
  const items = []
  let startingAfter
  for (let page = 0; page < 100; page++) {
    const result = await listFn({ ...params, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    const data = Array.isArray(result?.data) ? result.data : []
    items.push(...data)
    if (!result?.has_more || data.length === 0) return items
    startingAfter = data[data.length - 1].id
  }
  throw new Error('Too many pages while listing Stripe objects')
}

function productIdOf(product) {
  return typeof product === 'string' ? product : product?.id ?? null
}

/** Abweichungen eines vorhandenen Preises vom Soll (leer = passt). */
export function describePriceMismatch(price, desired, productId) {
  const problems = []
  if (productId && productIdOf(price.product) !== productId) problems.push('belongs to another product')
  if (price.currency !== 'usd') problems.push(`currency ${price.currency}`)
  if (price.unit_amount !== desired.unitAmount) problems.push(`unit_amount ${price.unit_amount} (expected ${desired.unitAmount})`)
  if (price.recurring?.interval !== desired.interval) problems.push(`interval ${price.recurring?.interval ?? 'none'}`)
  if ((price.recurring?.interval_count ?? 1) !== 1) problems.push(`interval_count ${price.recurring?.interval_count}`)
  if (price.tax_behavior !== 'inclusive') problems.push(`tax_behavior ${price.tax_behavior}`)
  if (price.active !== true) problems.push('inactive')
  return problems
}

/** Abweichungen der eigenen Portal-Konfiguration vom Soll (leer = passt). */
export function describePortalDrift(configuration, desired) {
  const drift = []
  const features = configuration.features ?? {}
  const wanted = desired.features
  const update = features.subscription_update ?? {}

  if (wanted.subscription_update.enabled !== true) {
    // basic: Planwechsel muss aus sein (Produkte/Preise sind dann egal).
    if (update.enabled !== false) drift.push('subscription_update enabled')
  } else {
    // Reihenfolge von Produkten und Preisen ist egal.
    const normalize = (entries) =>
      (entries ?? [])
        .map((entry) => ({ product: productIdOf(entry.product), prices: [...(entry.prices ?? [])].sort() }))
        .sort((a, b) => String(a.product).localeCompare(String(b.product)))
    const actualProducts = normalize(update.products)
    const expectedProducts = normalize(wanted.subscription_update.products)

    if (update.enabled !== true) drift.push('subscription_update disabled')
    if (JSON.stringify(actualProducts) !== JSON.stringify(expectedProducts)) drift.push('subscription_update products/prices')
    if (update.proration_behavior !== 'none') drift.push(`proration_behavior ${update.proration_behavior}`)
    if (JSON.stringify([...(update.default_allowed_updates ?? [])].sort()) !== JSON.stringify(['price'])) {
      drift.push('default_allowed_updates')
    }
  }
  const cancel = features.subscription_cancel ?? {}
  if (cancel.enabled !== true || cancel.mode !== 'at_period_end') drift.push('subscription_cancel')
  if (cancel.cancellation_reason?.enabled !== true) drift.push('cancellation_reason')
  if (features.payment_method_update?.enabled !== true) drift.push('payment_method_update')
  if (features.invoice_history?.enabled !== true) drift.push('invoice_history')

  // URLs nur vergleichen, wenn sie übergeben wurden (sonst bleiben sie unverändert).
  const profile = configuration.business_profile ?? {}
  const wantedProfile = desired.business_profile
  if (profile.headline !== wantedProfile.headline) drift.push('headline')
  if ('privacy_policy_url' in wantedProfile && profile.privacy_policy_url !== wantedProfile.privacy_policy_url) {
    drift.push('privacy_policy_url')
  }
  if ('terms_of_service_url' in wantedProfile && profile.terms_of_service_url !== wantedProfile.terms_of_service_url) {
    drift.push('terms_of_service_url')
  }
  return drift
}

/**
 * Führt das Setup aus (Dry-Run oder --apply). `stripe` ist ein stripe-node-Client
 * (oder ein Fake mit derselben Oberfläche).
 *
 * @param {{ stripe: any, args: ReturnType<typeof parseSetupArgs>, log?: (line: string) => void }} options
 */
export async function runResearchStripeSetup({ stripe, args, log = (line) => console.log(line) }) {
  const apply = args.apply === true
  /** @type {string[]} */
  const actions = []
  const note = (line) => {
    actions.push(line)
    log(line)
  }

  // Erst alles lesen und prüfen, dann schreiben: eine Abweichung bricht ab,
  // BEVOR irgendetwas angelegt wird (auch kein Produkt).

  // 1) Stufenprodukte suchen (noch nicht anlegen): je Stufe genau eines mit
  //    pat_product=research + research_tier=<tier>. Markierte Produkte OHNE
  //    research_tier sind das alte Einzelprodukt (siehe Kopfkommentar).
  const marked = (await listAll((params) => stripe.products.list(params))).filter(
    (product) => product?.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT
  )
  const legacyProducts = marked.filter((product) => !product.metadata?.[TIER_MARKER_KEY])
  const productProblems = []
  for (const product of marked) {
    const tier = product.metadata?.[TIER_MARKER_KEY]
    if (tier && !isResearchTier(tier)) {
      productProblems.push(`${product.id}: unknown ${TIER_MARKER_KEY}=${tier}. Fix or remove the metadata in Stripe, then re-run.`)
    }
  }
  /** @type {Record<string, any>} */
  const products = {}
  for (const tier of RESEARCH_TIERS) {
    const matches = marked.filter((product) => product.metadata?.[TIER_MARKER_KEY] === tier)
    if (matches.length > 1) {
      productProblems.push(
        `Found ${matches.length} products with metadata ${MARKER_KEY}=${RESEARCH_PRODUCT}, ${TIER_MARKER_KEY}=${tier} (${matches.map((p) => p.id).join(', ')}); resolve this in the Stripe dashboard first.`
      )
    } else if (matches[0] && matches[0].active !== true) {
      productProblems.push(`Product ${matches[0].id} (${TIER_MARKER_KEY}=${tier}) is archived. Reactivate it in the Stripe dashboard, then re-run.`)
    }
    products[tier] = matches[0] ?? null
  }
  if (productProblems.length > 0) {
    throw new Error(`Research products need attention — nothing was changed:\n  ${productProblems.join('\n  ')}`)
  }

  // 2) Vorhandene Preise (über lookup_key) prüfen; sie werden nie verändert.
  // Ohne markiertes Stufenprodukt ist JEDER vorhandene Preis mit unserem
  // lookup_key eine Abweichung (Marker entfernt oder Preise von Hand angelegt).
  // Ausnahme: eigene Preise (Marker) am alten Einzelprodukt werden ersetzt.
  const desired = desiredResearchPrices()
  const found = await listAll((params) => stripe.prices.list(params), { lookup_keys: desired.map((price) => price.lookupKey) })
  const byLookupKey = new Map(found.map((price) => [price.lookup_key, price]))
  const legacyProductIds = new Set(legacyProducts.map((product) => product.id))
  /** @param {any} price */
  const isOwnLegacyPrice = (price) => legacyProductIds.has(productIdOf(price.product)) && price.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT

  const problems = []
  for (const price of desired) {
    const existing = byLookupKey.get(price.lookupKey)
    if (!existing || isOwnLegacyPrice(existing)) continue
    const tierProduct = products[price.tier]
    const mismatch = describePriceMismatch(existing, price, tierProduct?.id ?? null)
    if (!tierProduct) {
      mismatch.unshift(`exists although no product with ${MARKER_KEY}=${RESEARCH_PRODUCT}, ${TIER_MARKER_KEY}=${price.tier} was found`)
    }
    if (mismatch.length > 0) problems.push(`${price.lookupKey} (${existing.id}): ${mismatch.join(', ')}`)
  }
  if (problems.length > 0) {
    throw new Error(`Existing research prices do not match the expected setup — nothing was changed:\n  ${problems.join('\n  ')}`)
  }

  // Eigene Portal-Konfigurationen (metadata.pat_product + pat_portal) ebenfalls vorab prüfen.
  const ownConfigurations = (await listAll((params) => stripe.billingPortal.configurations.list(params))).filter(
    (configuration) => configuration?.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT && configuration.active !== false
  )
  const portalProblems = []
  for (const configuration of ownConfigurations) {
    const kind = configuration.metadata?.[PORTAL_MARKER_KEY]
    if (!kind) {
      // Alt-Setup: EINE Konfiguration mit Monats- UND Jahrespreisen. Ein Wechsel
      // zwischen den Intervallen bucht dort sofort ohne Gutschrift ab. Nie
      // stillschweigend umbauen — Petar deaktiviert sie bewusst.
      portalProblems.push(
        `${configuration.id}: legacy research portal configuration without metadata ${PORTAL_MARKER_KEY} (lets customers switch between monthly and annual without credit). Deactivate it (POST /v1/billing_portal/configurations/${configuration.id} with active=false), then re-run.`
      )
    } else if (!RESEARCH_PORTALS.some((portal) => portal.kind === kind)) {
      portalProblems.push(`${configuration.id}: unknown ${PORTAL_MARKER_KEY}=${kind}. Deactivate or fix it in Stripe, then re-run.`)
    }
  }
  /** @type {Record<string, any>} */
  const configurations = {}
  for (const portal of RESEARCH_PORTALS) {
    const matches = ownConfigurations.filter((configuration) => configuration.metadata?.[PORTAL_MARKER_KEY] === portal.kind)
    if (matches.length > 1) {
      portalProblems.push(
        `Found ${matches.length} active research portal configurations with ${PORTAL_MARKER_KEY}=${portal.kind} (${matches.map((c) => c.id).join(', ')}); deactivate the extra ones first.`
      )
    }
    configurations[portal.kind] = matches[0] ?? null
  }
  if (portalProblems.length > 0) {
    throw new Error(`Research portal configurations need attention — nothing was changed:\n  ${portalProblems.join('\n  ')}`)
  }

  // 3) Stufenprodukte anlegen (erst nach bestandener Prüfung). Idempotency-Keys
  // v2: die v1-Keys gehörten zum alten Einzelprodukt (andere Parameter).
  /** @type {Record<string, string | null>} */
  const productIds = {}
  for (const wanted of desiredResearchProducts()) {
    let product = products[wanted.tier]
    if (product) {
      note(`= product ${wanted.tier} ${product.id} (${product.name}) exists`)
    } else if (apply) {
      product = await stripe.products.create(
        { name: wanted.name, description: PRODUCT_DESCRIPTION, metadata: { [MARKER_KEY]: RESEARCH_PRODUCT, [TIER_MARKER_KEY]: wanted.tier } },
        { idempotencyKey: `pat-research-setup-v2-product-${wanted.tier}` }
      )
      products[wanted.tier] = product
      note(`+ created product ${wanted.tier} ${product.id}`)
    } else {
      note(`+ would create product "${wanted.name}"`)
    }
    productIds[wanted.tier] = product?.id ?? null
  }
  for (const legacy of legacyProducts) {
    if (legacy.active === true) {
      log(`! legacy product ${legacy.id} (${MARKER_KEY}=${RESEARCH_PRODUCT} without ${TIER_MARKER_KEY}) is no longer used; archive it in the Stripe dashboard.`)
    }
  }

  // 4) Fehlende Preise anlegen; eigene Preise des alten Einzelprodukts durch
  // neue am Stufenprodukt ersetzen (lookup_key wandert per transfer_lookup_key).
  /** @type {Record<string, string | null>} */
  const priceIds = {}
  for (const price of desired) {
    const existing = byLookupKey.get(price.lookupKey)
    const legacy = existing && isOwnLegacyPrice(existing) ? existing : null
    if (existing && !legacy) {
      priceIds[price.envName] = existing.id
      note(`= price ${price.lookupKey} ${existing.id} exists`)
      continue
    }
    if (!apply) {
      priceIds[price.envName] = null
      note(
        legacy
          ? `~ would replace legacy price ${legacy.id} with a new ${price.lookupKey} on the ${price.tier} product (lookup_key moves over)`
          : `+ would create price ${price.lookupKey} (${price.unitAmount / 100} USD / ${price.interval}, tax inclusive)`
      )
      continue
    }
    const created = await stripe.prices.create(
      {
        product: /** @type {string} */ (productIds[price.tier]),
        currency: 'usd',
        unit_amount: price.unitAmount,
        recurring: { interval: price.interval },
        tax_behavior: 'inclusive',
        lookup_key: price.lookupKey,
        ...(legacy ? { transfer_lookup_key: true } : {}),
        nickname: price.nickname,
        metadata: { [MARKER_KEY]: RESEARCH_PRODUCT, research_tier: price.tier, research_interval: price.interval },
      },
      { idempotencyKey: `pat-research-setup-v2-price-${price.tier}-${price.interval}` }
    )
    priceIds[price.envName] = created.id
    note(legacy ? `~ replaced legacy price ${legacy.id} with ${price.lookupKey} ${created.id}` : `+ created price ${price.lookupKey} ${created.id}`)
  }

  // 5) Portal-Konfigurationen (nur die eigenen, erkannt an metadata.pat_product + pat_portal).
  // monthly/annual: je Stufenprodukt NUR der Preis ihres Intervalls; basic ohne Planwechsel.
  if (!args.termsUrl || !args.privacyUrl) {
    log('! --terms-url/--privacy-url not given: the portal will not link Terms/Privacy.')
  }

  for (const portal of RESEARCH_PORTALS) {
    let configuration = configurations[portal.kind]
    const label = `portal configuration ${portal.kind}`
    const catalog = portal.interval
      ? RESEARCH_TIERS.map((tier) => ({ product: productIds[tier], prices: [priceIds[RESEARCH_PRICE_ENV[tier][portal.interval]]] }))
      : []
    const portalReady = catalog.every((entry) => typeof entry.product === 'string' && entry.prices.every((id) => typeof id === 'string'))

    if (!portalReady) {
      note(configuration ? `= ${label} ${configuration.id} exists (update after products/prices exist)` : `+ would create ${label}`)
      continue
    }
    const params = buildPortalConfigurationParams({
      kind: /** @type {'monthly' | 'annual' | 'basic'} */ (portal.kind),
      products: /** @type {Array<{ product: string, prices: string[] }>} */ (catalog),
      termsUrl: args.termsUrl,
      privacyUrl: args.privacyUrl,
    })
    if (!configuration) {
      if (apply) {
        configuration = await stripe.billingPortal.configurations.create(params)
        configurations[portal.kind] = configuration
        note(`+ created ${label} ${configuration.id}`)
      } else {
        note(`+ would create ${label}`)
      }
    } else {
      const drift = describePortalDrift(configuration, params)
      if (drift.length === 0) {
        note(`= ${label} ${configuration.id} exists`)
      } else if (apply) {
        configuration = await stripe.billingPortal.configurations.update(configuration.id, params)
        configurations[portal.kind] = configuration
        note(`~ updated ${label} ${configuration.id} (${drift.join(', ')})`)
      } else {
        note(`~ would update ${label} ${configuration.id} (${drift.join(', ')})`)
      }
    }
  }

  /** @type {Record<string, string | null>} */
  const portalConfigurationIds = Object.fromEntries(RESEARCH_PORTALS.map((portal) => [portal.kind, configurations[portal.kind]?.id ?? null]))

  const envLines = [
    ...desiredResearchProducts().map((product) => `${product.envName}=${productIds[product.tier] ?? PENDING}`),
    ...desired.map((price) => `${price.envName}=${priceIds[price.envName] ?? PENDING}`),
    ...RESEARCH_PORTALS.map((portal) => `${portal.envName}=${portalConfigurationIds[portal.kind] ?? PENDING}`),
  ]

  return { apply, productIds, priceIds, portalConfigurationIds, envLines, actions }
}

const USAGE = `
Usage:
  node --env-file=<file with STRIPE_SECRET_KEY=sk_test_…> scripts/research-stripe-setup.mjs [--apply] [--terms-url URL] [--privacy-url URL]

  Dry run by default. --apply writes to Stripe (test mode only).
  Live keys are always refused.
`.trim()

async function main() {
  let args
  try {
    args = parseSetupArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(USAGE)
    process.exit(1)
  }
  if (args.help) {
    console.log(USAGE)
    return
  }

  const key = process.env.STRIPE_SECRET_KEY
  const mode = checkStripeKeyMode(key, args)
  if (!mode.ok) {
    console.error(mode.message)
    process.exit(1)
  }

  const stripe = new Stripe(/** @type {string} */ (key).trim(), { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2 })
  console.log(args.apply ? 'PAT Research Stripe setup (TEST mode, applying changes)' : 'PAT Research Stripe setup (TEST mode, dry run — pass --apply to write)')

  const result = await runResearchStripeSetup({ stripe, args })
  console.log('\nEnvironment variables:')
  for (const line of result.envLines) console.log(line)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Nur Meldung/Typ ausgeben; Stripe-Fehler enthalten nie den Key.
    const details = error && typeof error === 'object' ? /** @type {{ type?: string, code?: string }} */ (error) : {}
    console.error('Setup failed:', error instanceof Error ? error.message : String(error), details.type ?? '', details.code ?? '')
    process.exit(1)
  })
}
