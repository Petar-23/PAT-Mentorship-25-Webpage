#!/usr/bin/env node
/**
 * PAT Research — idempotentes Stripe-Setup (NUR Testmodus).
 *
 * Legt an bzw. findet wieder:
 *   - Produkt "PAT Research" (metadata.pat_product = research)
 *   - sechs USD-Abo-Preise, tax_behavior inclusive:
 *       Reader 7 / Member 10 / Supporter 15 pro Monat, 70 / 100 / 150 pro Jahr
 *       lookup_key pat_research_<tier>_<interval>_v1, metadata research_tier/research_interval
 *   - eine eigene Billing-Portal-Konfiguration (Preiswechsel ohne Proration,
 *     Kündigung zum Periodenende mit Grund, Zahlungsmethode, Rechnungen)
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
  RESEARCH_PRODUCT_ID_ENV,
  RESEARCH_TIERS,
  RESEARCH_TIER_DETAILS,
} from '../lib/research/config.mjs'

export const STRIPE_API_VERSION = '2024-10-28.acacia'
export const PRODUCT_NAME = 'PAT Research'
export const PRODUCT_DESCRIPTION =
  'Tested studies of ICT concepts on NQ futures — method, charts and numbers. Every tier unlocks the same research.'
// Stripe begrenzt die Portal-Headline auf 60 Zeichen.
export const PORTAL_HEADLINE = 'Manage your PAT Research membership'
export const MARKER_KEY = 'pat_product'
const PENDING = '<created on --apply>'

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
 * @param {{ productId: string, priceIds: string[], termsUrl: string | null, privacyUrl: string | null }} input
 */
export function buildPortalConfigurationParams({ productId, priceIds, termsUrl, privacyUrl }) {
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
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        products: [{ product: productId, prices: [...priceIds] }],
        proration_behavior: 'none',
      },
    },
    metadata: { [MARKER_KEY]: RESEARCH_PRODUCT },
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
  const wantedProducts = wanted.subscription_update.products
  const actualProducts = (update.products ?? []).map((entry) => ({ product: entry.product, prices: [...(entry.prices ?? [])].sort() }))
  const expectedProducts = wantedProducts.map((entry) => ({ product: entry.product, prices: [...entry.prices].sort() }))

  if (update.enabled !== true) drift.push('subscription_update disabled')
  if (JSON.stringify(actualProducts) !== JSON.stringify(expectedProducts)) drift.push('subscription_update products/prices')
  if (update.proration_behavior !== 'none') drift.push(`proration_behavior ${update.proration_behavior}`)
  if (JSON.stringify([...(update.default_allowed_updates ?? [])].sort()) !== JSON.stringify(['price'])) {
    drift.push('default_allowed_updates')
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

  // 1) Produkt suchen (noch nicht anlegen)
  const products = (await listAll((params) => stripe.products.list(params))).filter(
    (product) => product?.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT
  )
  if (products.length > 1) {
    throw new Error(`Found ${products.length} products with metadata ${MARKER_KEY}=${RESEARCH_PRODUCT}; resolve this in the Stripe dashboard first.`)
  }
  let product = products[0] ?? null
  if (product && product.active !== true) {
    throw new Error(`Product ${product.id} (${MARKER_KEY}=${RESEARCH_PRODUCT}) is archived. Reactivate it in the Stripe dashboard, then re-run.`)
  }

  // 2) Vorhandene Preise (über lookup_key) prüfen; sie werden nie verändert.
  // Ohne markiertes Produkt ist JEDER vorhandene Preis mit unserem lookup_key
  // eine Abweichung (Marker entfernt oder Preise von Hand angelegt).
  const desired = desiredResearchPrices()
  const found = await listAll((params) => stripe.prices.list(params), { lookup_keys: desired.map((price) => price.lookupKey) })
  const byLookupKey = new Map(found.map((price) => [price.lookup_key, price]))

  const problems = []
  for (const price of desired) {
    const existing = byLookupKey.get(price.lookupKey)
    if (!existing) continue
    const mismatch = describePriceMismatch(existing, price, product?.id ?? null)
    if (!product) mismatch.unshift(`exists although no product with ${MARKER_KEY}=${RESEARCH_PRODUCT} was found`)
    if (mismatch.length > 0) problems.push(`${price.lookupKey} (${existing.id}): ${mismatch.join(', ')}`)
  }
  if (problems.length > 0) {
    throw new Error(`Existing research prices do not match the expected setup — nothing was changed:\n  ${problems.join('\n  ')}`)
  }

  // Eigene Portal-Konfiguration (erkannt an metadata.pat_product) ebenfalls vorab prüfen.
  const ownConfigurations = (await listAll((params) => stripe.billingPortal.configurations.list(params))).filter(
    (configuration) => configuration?.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT && configuration.active !== false
  )
  if (ownConfigurations.length > 1) {
    throw new Error(`Found ${ownConfigurations.length} active research portal configurations; deactivate the extra ones first.`)
  }
  let configuration = ownConfigurations[0] ?? null

  // 3) Produkt anlegen (erst nach bestandener Prüfung)
  if (product) {
    note(`= product ${product.id} (${product.name}) exists`)
  } else if (apply) {
    product = await stripe.products.create(
      { name: PRODUCT_NAME, description: PRODUCT_DESCRIPTION, metadata: { [MARKER_KEY]: RESEARCH_PRODUCT } },
      { idempotencyKey: 'pat-research-setup-v1-product' }
    )
    note(`+ created product ${product.id}`)
  } else {
    note(`+ would create product "${PRODUCT_NAME}"`)
  }
  const productId = product?.id ?? null

  // 4) Fehlende Preise anlegen
  /** @type {Record<string, string | null>} */
  const priceIds = {}
  for (const price of desired) {
    const existing = byLookupKey.get(price.lookupKey)
    if (existing) {
      priceIds[price.envName] = existing.id
      note(`= price ${price.lookupKey} ${existing.id} exists`)
      continue
    }
    if (!apply) {
      priceIds[price.envName] = null
      note(`+ would create price ${price.lookupKey} (${price.unitAmount / 100} USD / ${price.interval}, tax inclusive)`)
      continue
    }
    const created = await stripe.prices.create(
      {
        product: /** @type {string} */ (productId),
        currency: 'usd',
        unit_amount: price.unitAmount,
        recurring: { interval: price.interval },
        tax_behavior: 'inclusive',
        lookup_key: price.lookupKey,
        nickname: price.nickname,
        metadata: { [MARKER_KEY]: RESEARCH_PRODUCT, research_tier: price.tier, research_interval: price.interval },
      },
      { idempotencyKey: `pat-research-setup-v1-price-${price.tier}-${price.interval}` }
    )
    priceIds[price.envName] = created.id
    note(`+ created price ${price.lookupKey} ${created.id}`)
  }

  // 5) Portal-Konfiguration (nur die eigene, erkannt an metadata.pat_product)
  const allPriceIds = desired.map((price) => priceIds[price.envName])
  const portalReady = productId !== null && allPriceIds.every((id) => typeof id === 'string')

  if (!args.termsUrl || !args.privacyUrl) {
    log('! --terms-url/--privacy-url not given: the portal will not link Terms/Privacy.')
  }

  if (!portalReady) {
    note(configuration ? `= portal configuration ${configuration.id} exists (update after product/prices exist)` : '+ would create portal configuration')
  } else {
    const params = buildPortalConfigurationParams({
      productId,
      priceIds: /** @type {string[]} */ (allPriceIds),
      termsUrl: args.termsUrl,
      privacyUrl: args.privacyUrl,
    })
    if (!configuration) {
      if (apply) {
        configuration = await stripe.billingPortal.configurations.create(params)
        note(`+ created portal configuration ${configuration.id}`)
      } else {
        note('+ would create portal configuration')
      }
    } else {
      const drift = describePortalDrift(configuration, params)
      if (drift.length === 0) {
        note(`= portal configuration ${configuration.id} exists`)
      } else if (apply) {
        configuration = await stripe.billingPortal.configurations.update(configuration.id, params)
        note(`~ updated portal configuration ${configuration.id} (${drift.join(', ')})`)
      } else {
        note(`~ would update portal configuration ${configuration.id} (${drift.join(', ')})`)
      }
    }
  }

  const envLines = [
    `${RESEARCH_PRODUCT_ID_ENV}=${productId ?? PENDING}`,
    ...desired.map((price) => `${price.envName}=${priceIds[price.envName] ?? PENDING}`),
    `${RESEARCH_PORTAL_CONFIGURATION_ENV}=${configuration?.id ?? PENDING}`,
  ]

  return { apply, productId, priceIds, portalConfigurationId: configuration?.id ?? null, envLines, actions }
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
