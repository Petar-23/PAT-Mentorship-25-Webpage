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
 * Optional (--webhook-url): EIN Test-Webhook-Endpoint für das Research-Preview,
 * erkannt an metadata { pat_product: research, pat_webhook: preview } UND der
 * exakten URL. Events: checkout.session.completed, customer.subscription.
 * created|updated|deleted, invoice.paid, invoice.payment_failed; API-Version
 * wie das SDK. Abweichende Events/Beschreibung werden per Update korrigiert, die
 * URL nie: eine andere URL ist ein anderer Endpoint (ein eigener Endpoint mit
 * anderer URL wird nur gemeldet). Das Signing-Secret liefert Stripe NUR beim
 * Anlegen; es wird nie ausgegeben oder geloggt. --rotate-webhook löscht NUR den
 * eigenen Endpoint dieser URL und legt ihn neu an (neues Secret).
 *
 * Optional (--vercel-branch): schreibt die 12 IDs und — nur wenn der Endpoint
 * in DIESEM Lauf angelegt/rotiert wurde — STRIPE_WEBHOOK_SECRET als Branch-
 * Override (Environment preview) per `npx -y vercel@latest env add … --force`.
 * Werte gehen NUR über stdin an die CLI, nie über argv oder ins Log. main, dev
 * und der Production-Branch des Vercel-Projekts werden abgelehnt. Vor jedem
 * Schreiben in Stripe wird der Vercel-Zugriff geprüft (env ls), damit ein neues
 * Secret nicht verloren geht.
 *
 * Usage (ein Befehl für das komplette Test-Setup des Previews):
 *   STRIPE_SECRET_KEY=sk_test_… node scripts/research-stripe-setup.mjs --apply \
 *     --webhook-url https://<preview-branch-host>/api/webhooks/stripe \
 *     --vercel-branch feat/pat-research-platform \
 *     --terms-url https://…/terms --privacy-url https://…/privacy
 *
 * - Ohne --apply: Dry-Run, es wird nichts geschrieben (Stripe und Vercel werden
 *   nur gelesen).
 * - Akzeptiert nur Test-Keys (sk_test_… / rk_test_…). Live-Keys werden immer
 *   abgelehnt; ein Live-Pfad (--live --i-have-petars-approval) ist bewusst noch
 *   nicht implementiert.
 * - Erneutes Ausführen findet vorhandene Objekte über Metadaten/lookup_key und
 *   legt nichts doppelt an. Fremde Produkte, Preise, Portal-Konfigurationen und
 *   Webhook-Endpoints werden nie verändert; eigene Preise mit abweichenden
 *   Werten führen zum Abbruch (Preise sind in Stripe unveränderlich — dann neue
 *   _v2-Keys anlegen).
 * - Ausgabe: die Env-Var-Zeilen (nur IDs, nie der Key, nie das Webhook-Secret)
 *   und je Vercel-Variable written / unchanged / skipped (ohne Werte).
 */

import { spawn as nodeSpawn } from 'node:child_process'
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

// Test-Webhook des Research-Previews (--webhook-url).
export const WEBHOOK_MARKER_KEY = 'pat_webhook'
export const WEBHOOK_MARKER_VALUE = 'preview'
export const WEBHOOK_PATH = '/api/webhooks/stripe'
export const WEBHOOK_SECRET_ENV = 'STRIPE_WEBHOOK_SECRET'
export const RESEARCH_WEBHOOK_EVENTS = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

// Vercel-Projekt (--vercel-branch). Explizit übergeben, damit das Script auch
// aus einem nicht verlinkten Worktree läuft.
export const DEFAULT_VERCEL_PROJECT = 'pat-mentorship-25-webpage'
export const DEFAULT_VERCEL_SCOPE = 'petar23s-projects'
// Diese Branches bekommen nie Research-Testwerte (zusätzlich zum Production-
// Branch des Projekts, der zur Laufzeit abgefragt wird).
const REFUSED_VERCEL_BRANCHES = Object.freeze(['main', 'dev'])

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
 * Webhook-URL des Previews: https, ohne Zugangsdaten, endet auf
 * /api/webhooks/stripe (also auch ohne Query/Fragment). Der Wert selbst taucht
 * in keiner Fehlermeldung auf.
 * @param {string} value
 */
export function parseWebhookUrl(value) {
  const flag = '--webhook-url'
  const url = new URL(parseHttpsUrl(value, flag))
  if (url.username || url.password) throw new Error(`${flag} must not contain credentials`)
  if (url.search || url.hash || !url.href.endsWith(WEBHOOK_PATH)) {
    throw new Error(`${flag} must end with ${WEBHOOK_PATH} (no trailing slash, query or fragment)`)
  }
  return url.toString()
}

/**
 * Git-Branch für die Vercel-Branch-Overrides. Nie leer, nie main/dev; nur
 * übliche Branch-Zeichen (kein führendes "-", sonst wäre es ein CLI-Flag).
 * @param {string} value
 */
export function parseVercelBranch(value) {
  const branch = typeof value === 'string' ? value.trim() : ''
  if (!branch) throw new Error('--vercel-branch must not be empty')
  if (REFUSED_VERCEL_BRANCHES.includes(branch.toLowerCase())) {
    throw new Error(`Refusing --vercel-branch ${branch}: research test values go only to a dedicated preview branch`)
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..') || branch.includes('//') || branch.endsWith('/') || branch.endsWith('.lock')) {
    throw new Error('--vercel-branch is not a valid git branch name')
  }
  return branch
}

/** @param {string} value @param {string} flag */
function parseVercelName(value, flag) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name)) throw new Error(`${flag} is not a valid Vercel name`)
  return name
}

/**
 * @typedef {{
 *   apply: boolean,
 *   live: boolean,
 *   liveApproval: boolean,
 *   help: boolean,
 *   termsUrl: string | null,
 *   privacyUrl: string | null,
 *   webhookUrl: string | null,
 *   rotateWebhook: boolean,
 *   vercelBranch: string | null,
 *   vercelProject: string,
 *   vercelScope: string,
 * }} SetupArgs
 */

/**
 * @param {readonly string[]} argv
 * @returns {SetupArgs}
 */
export function parseSetupArgs(argv) {
  /** @type {SetupArgs} */
  const args = {
    apply: false,
    live: false,
    liveApproval: false,
    help: false,
    termsUrl: null,
    privacyUrl: null,
    webhookUrl: null,
    rotateWebhook: false,
    vercelBranch: null,
    vercelProject: DEFAULT_VERCEL_PROJECT,
    vercelScope: DEFAULT_VERCEL_SCOPE,
  }

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
      case '--webhook-url':
        args.webhookUrl = parseWebhookUrl(takeValue())
        break
      case '--rotate-webhook':
        args.rotateWebhook = true
        break
      case '--vercel-branch':
        args.vercelBranch = parseVercelBranch(takeValue())
        break
      case '--vercel-project':
        args.vercelProject = parseVercelName(takeValue(), '--vercel-project')
        break
      case '--vercel-scope':
        args.vercelScope = parseVercelName(takeValue(), '--vercel-scope')
        break
      default:
        throw new Error(`Unknown argument: ${raw}`)
    }
  }

  if (args.rotateWebhook && !args.webhookUrl) throw new Error('--rotate-webhook needs --webhook-url')
  if (args.rotateWebhook && !args.vercelBranch) {
    throw new Error('--rotate-webhook needs --vercel-branch (the new signing secret is never printed, only written to Vercel)')
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

// ---------------------------------------------------------------------------
// Webhook-Endpoint (--webhook-url)
// ---------------------------------------------------------------------------

/** @param {unknown} value */
function normalizeUrl(value) {
  try {
    return new URL(String(value)).toString()
  } catch {
    return String(value)
  }
}

/** URL für Meldungen: nur Origin + Pfad (fremde Endpoints könnten Tokens in der Query tragen). @param {unknown} value */
function displayUrl(value) {
  try {
    const url = new URL(String(value))
    return `${url.origin}${url.pathname}`
  } catch {
    return '(invalid url)'
  }
}

/**
 * Soll-Parameter des Preview-Webhooks.
 * @param {{ url: string, label: string }} input
 */
export function buildWebhookEndpointParams({ url, label }) {
  return {
    url,
    enabled_events: [...RESEARCH_WEBHOOK_EVENTS],
    api_version: STRIPE_API_VERSION,
    description: `PAT Research preview webhook (${label})`,
    metadata: { [MARKER_KEY]: RESEARCH_PRODUCT, [WEBHOOK_MARKER_KEY]: WEBHOOK_MARKER_VALUE },
  }
}

/**
 * Teilt die Endpoints des Kontos auf: eigene mit genau dieser URL, eigene mit
 * anderer URL (nur melden) und fremde mit dieser URL (nur melden).
 * @param {any[]} endpoints
 * @param {string} url
 */
export function classifyWebhookEndpoints(endpoints, url) {
  const wanted = normalizeUrl(url)
  /** @param {any} endpoint */
  const isOwn = (endpoint) =>
    endpoint?.metadata?.[MARKER_KEY] === RESEARCH_PRODUCT && endpoint?.metadata?.[WEBHOOK_MARKER_KEY] === WEBHOOK_MARKER_VALUE
  /** @param {any} endpoint */
  const sameUrl = (endpoint) => normalizeUrl(endpoint?.url) === wanted
  return {
    matches: endpoints.filter((endpoint) => isOwn(endpoint) && sameUrl(endpoint)),
    ownElsewhere: endpoints.filter((endpoint) => isOwn(endpoint) && !sameUrl(endpoint)),
    foreignSameUrl: endpoints.filter((endpoint) => !isOwn(endpoint) && sameUrl(endpoint)),
  }
}

/**
 * Per Update korrigierbare Abweichungen des eigenen Endpoints (leer = passt).
 * Die URL ist per Definition gleich; die API-Version kann Stripe nicht ändern
 * (siehe runResearchStripeSetup: nur Hinweis auf --rotate-webhook).
 * @param {any} endpoint
 * @param {ReturnType<typeof buildWebhookEndpointParams>} desired
 */
export function describeWebhookDrift(endpoint, desired) {
  const drift = []
  const actual = [...(Array.isArray(endpoint?.enabled_events) ? endpoint.enabled_events : [])].sort()
  if (JSON.stringify(actual) !== JSON.stringify([...desired.enabled_events].sort())) drift.push('enabled_events')
  if (endpoint?.description !== desired.description) drift.push('description')
  if (endpoint?.status === 'disabled') drift.push('disabled')
  return drift
}

// ---------------------------------------------------------------------------
// Vercel-Env (--vercel-branch) über die Vercel-CLI
// ---------------------------------------------------------------------------

/**
 * @typedef {{ name: string, value: string, sensitive: boolean }} VercelEnvEntry
 * @typedef {{ value: string | undefined, sensitive: boolean }} VercelEnvState
 * @typedef {{
 *   writeEnv: (entry: VercelEnvEntry) => Promise<void>,
 *   listEnv?: (names: readonly string[]) => Promise<Map<string, VercelEnvState>>,
 *   productionBranch?: () => Promise<string | null>,
 * }} VercelEnvAdapter
 * @typedef {{ name: string, status: 'written' | 'unchanged' | 'skipped' | 'would-write' | 'failed', reason?: string }} VercelEnvResult
 */

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g')

/**
 * Letzte Zeilen einer CLI-Ausgabe für Fehlermeldungen — ohne Farbcodes, ohne
 * die übergebenen Werte und ohne whsec_-Secrets.
 * @param {string} text
 * @param {readonly string[]} [secrets]
 */
export function sanitizeCliOutput(text, secrets = []) {
  let clean = String(text ?? '').replace(ANSI_PATTERN, '')
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) clean = clean.split(secret).join('[redacted]')
  }
  clean = clean.replace(/whsec_[A-Za-z0-9]+/g, 'whsec_[redacted]')
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.slice(-3).join(' | ').slice(0, 400)
}

/** Env der Kind-Prozesse: ohne STRIPE_SECRET_KEY, ohne Telemetrie. @param {NodeJS.ProcessEnv} env */
function vercelChildEnv(env) {
  const { STRIPE_SECRET_KEY: _omit, ...rest } = env
  void _omit
  return { ...rest, VERCEL_TELEMETRY_DISABLED: '1' }
}

/**
 * Startet `npx -y vercel@latest <args>`. `input` geht ausschließlich über stdin
 * an die CLI (nie über argv). `spawn` ist injizierbar (Tests).
 * @param {{ spawn: (command: string, args: string[], options: object) => any, args: readonly string[], input?: string, env?: NodeJS.ProcessEnv }} options
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
export function runVercelCli({ spawn, args, input = '', env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', 'vercel@latest', ...args], { stdio: ['pipe', 'pipe', 'pipe'], env: vercelChildEnv(env), shell: false })
    /** @type {Buffer[]} */
    const stdout = []
    /** @type {Buffer[]} */
    const stderr = []
    /** @param {Buffer[]} target */
    const collect = (target) => (/** @type {unknown} */ chunk) => target.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    child.stdout?.on('data', collect(stdout))
    child.stderr?.on('data', collect(stderr))
    child.on('error', reject)
    child.on('close', (/** @type {number | null} */ code) =>
      resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') })
    )
    // Beendet die CLI vorzeitig, wirft stdin EPIPE — das Ergebnis kommt über 'close'.
    child.stdin?.on('error', () => {})
    child.stdin?.end(input)
  })
}

/** @param {string} stdout */
function parseCliJson(stdout) {
  const start = stdout.indexOf('{')
  if (start === -1) throw new Error('unexpected Vercel CLI output (no JSON)')
  try {
    return JSON.parse(stdout.slice(start))
  } catch {
    throw new Error('unexpected Vercel CLI output (invalid JSON)')
  }
}

/**
 * Branch-Overrides (preview + genau dieser Branch) aus `vercel env ls --format json`,
 * nur für die gesuchten Namen. Sensitive Werte liefert Vercel nicht (value undefined).
 * @param {string} stdout
 * @param {string} branch
 * @param {readonly string[]} names
 * @returns {Map<string, VercelEnvState>}
 */
export function parseVercelEnvList(stdout, branch, names) {
  const parsed = parseCliJson(stdout)
  if (!Array.isArray(parsed?.envs)) throw new Error('unexpected Vercel CLI output (no envs)')
  /** @type {Map<string, VercelEnvState>} */
  const found = new Map()
  for (const env of parsed.envs) {
    if (!names.includes(env?.key) || env?.gitBranch !== branch) continue
    const targets = Array.isArray(env.target) ? env.target : [env.target]
    if (!targets.includes('preview')) continue
    found.set(env.key, {
      value: typeof env.value === 'string' ? env.value : undefined,
      sensitive: env.type === 'sensitive' || env.visibility === 'secret',
    })
  }
  return found
}

/**
 * Echter Vercel-Adapter: jede Operation startet `npx -y vercel@latest …` mit
 * --project/--scope (funktioniert ohne verlinkten Worktree).
 * @param {{ project: string, scope: string, branch: string, spawn?: (command: string, args: string[], options: object) => any, env?: NodeJS.ProcessEnv }} options
 * @returns {VercelEnvAdapter}
 */
export function createVercelCliEnv({ project, scope, branch, spawn = nodeSpawn, env = process.env }) {
  const common = ['--project', project, '--scope', scope, '--non-interactive', '--no-color']
  return {
    async productionBranch() {
      const result = await runVercelCli({
        spawn,
        env,
        args: ['api', `/v9/projects/${encodeURIComponent(project)}`, '--raw', '--scope', scope, '--non-interactive', '--no-color'],
      })
      if (result.code !== 0) throw new Error(`vercel api failed (exit ${result.code}): ${sanitizeCliOutput(result.stderr)}`)
      const productionBranch = parseCliJson(result.stdout)?.link?.productionBranch
      return typeof productionBranch === 'string' && productionBranch.length > 0 ? productionBranch : null
    },
    async listEnv(names) {
      const result = await runVercelCli({ spawn, env, args: ['env', 'ls', 'preview', branch, '--format', 'json', ...common] })
      if (result.code !== 0) throw new Error(`vercel env ls failed (exit ${result.code}): ${sanitizeCliOutput(result.stderr)}`)
      return parseVercelEnvList(result.stdout, branch, names)
    },
    async writeEnv({ name, value, sensitive }) {
      if (typeof value !== 'string' || value.length === 0) throw new Error(`refusing to write an empty ${name}`)
      const argv = ['env', 'add', name, 'preview', '--git-branch', branch, '--yes', '--force', sensitive ? '--sensitive' : '--no-sensitive', ...common]
      if (argv.some((arg) => arg.includes(value))) throw new Error(`refusing to pass the value of ${name} as an argument`)
      const result = await runVercelCli({ spawn, env, args: argv, input: value })
      if (result.code !== 0) {
        throw new Error(`vercel env add ${name} failed (exit ${result.code}): ${sanitizeCliOutput(`${result.stderr}\n${result.stdout}`, [value])}`)
      }
    },
  }
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Führt das Setup aus (Dry-Run oder --apply). `stripe` ist ein stripe-node-Client
 * (oder ein Fake mit derselben Oberfläche). `vercel` ist nur mit --vercel-branch
 * nötig (echt: createVercelCliEnv, in Tests ein Fake).
 *
 * @param {{ stripe: any, args: SetupArgs, log?: (line: string) => void, vercel?: VercelEnvAdapter | null }} options
 */
export async function runResearchStripeSetup({ stripe, args, log = (line) => console.log(line), vercel = null }) {
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

  // Webhook-Endpoint (nur mit --webhook-url) ebenfalls vorab lesen und prüfen.
  const webhookUrl = args.webhookUrl ?? null
  const vercelBranch = args.vercelBranch ?? null
  const webhookParams = webhookUrl ? buildWebhookEndpointParams({ url: webhookUrl, label: vercelBranch ?? new URL(webhookUrl).host }) : null
  /** @type {any} */
  let webhookEndpoint = null
  if (webhookUrl) {
    const endpoints = await listAll((params) => stripe.webhookEndpoints.list(params))
    const { matches, ownElsewhere, foreignSameUrl } = classifyWebhookEndpoints(endpoints, webhookUrl)
    if (matches.length > 1) {
      throw new Error(
        `Found ${matches.length} research preview webhook endpoints for ${displayUrl(webhookUrl)} (${matches.map((e) => e.id).join(', ')}); delete the extra ones in the Stripe dashboard first — nothing was changed.`
      )
    }
    webhookEndpoint = matches[0] ?? null
    for (const other of ownElsewhere) {
      log(`! research preview webhook endpoint ${other.id} points at another URL (${displayUrl(other.url)}); left untouched.`)
    }
    for (const foreign of foreignSameUrl) {
      log(
        `! webhook endpoint ${foreign.id} (not managed by this script) also points at ${displayUrl(webhookUrl)}; left untouched. Its deliveries will fail the signature check — disable it in the Stripe dashboard.`
      )
    }
  }

  // Vercel (nur mit --vercel-branch): Production-Branch ablehnen und Zugriff
  // prüfen, BEVOR in Stripe geschrieben wird — sonst ginge ein neues Webhook-
  // Secret verloren, falls Vercel danach nicht erreichbar ist.
  const vercelNames = [
    WEBHOOK_SECRET_ENV,
    ...desiredResearchProducts().map((product) => product.envName),
    ...desired.map((price) => price.envName),
    ...RESEARCH_PORTALS.map((portal) => portal.envName),
  ]
  /** @type {Map<string, VercelEnvState> | null} */
  let vercelExisting = null
  if (vercelBranch) {
    if (!vercel || typeof vercel.writeEnv !== 'function') throw new Error('--vercel-branch needs a Vercel env adapter')
    if (typeof vercel.productionBranch === 'function') {
      /** @type {string | null} */
      let productionBranch = null
      try {
        productionBranch = await vercel.productionBranch()
      } catch (error) {
        log(`! could not read the production branch of the Vercel project (${messageOf(error)}); only main/dev are refused.`)
      }
      if (productionBranch && productionBranch.toLowerCase() === vercelBranch.toLowerCase()) {
        throw new Error(`Refusing --vercel-branch ${vercelBranch}: it is the production branch of the Vercel project — nothing was changed.`)
      }
    }
    if (typeof vercel.listEnv === 'function') {
      try {
        vercelExisting = await vercel.listEnv(vercelNames)
      } catch (error) {
        if (apply) {
          throw new Error(
            `Could not read the Vercel env of branch ${vercelBranch} (${messageOf(error)}) — nothing was changed. Check \`npx vercel@latest login\` and --vercel-project/--vercel-scope.`
          )
        }
        log(`! could not read the Vercel env of branch ${vercelBranch} (${messageOf(error)}); the dry run continues.`)
      }
    }
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

  // 6) Webhook-Endpoint (nur mit --webhook-url). Das Signing-Secret liefert
  // Stripe nur beim Anlegen; es bleibt in dieser Variable und geht nur an Vercel.
  /** @type {string | null} */
  let webhookSecret = null
  /** @type {{ id: string | null, url: string, action: string, secretObtained: boolean } | null} */
  let webhook = null
  if (webhookUrl && webhookParams) {
    const label = `webhook endpoint for ${displayUrl(webhookUrl)}`
    /** @param {any} created */
    const takeSecret = (created) => {
      webhookSecret = typeof created?.secret === 'string' && created.secret.startsWith('whsec_') ? created.secret : null
      if (!webhookSecret) log(`! Stripe returned no signing secret for ${created?.id}; STRIPE_WEBHOOK_SECRET cannot be written.`)
    }
    let action
    if (webhookEndpoint && args.rotateWebhook) {
      if (apply) {
        const oldId = webhookEndpoint.id
        await stripe.webhookEndpoints.del(oldId)
        note(`- deleted ${label} ${oldId} (--rotate-webhook)`)
        const created = await stripe.webhookEndpoints.create(webhookParams)
        takeSecret(created)
        webhookEndpoint = { id: created.id }
        note(`+ created ${label} ${created.id} (new signing secret, not shown)`)
        action = 'rotated'
      } else {
        note(`~ would rotate ${label} ${webhookEndpoint.id} (delete it and create a new one for a new signing secret)`)
        action = 'would-rotate'
      }
    } else if (!webhookEndpoint) {
      if (args.rotateWebhook) log(`! --rotate-webhook: no managed ${label} exists yet; a new one is created instead.`)
      if (apply) {
        const created = await stripe.webhookEndpoints.create(webhookParams)
        takeSecret(created)
        webhookEndpoint = { id: created.id }
        note(`+ created ${label} ${created.id} (signing secret not shown)`)
        action = 'created'
      } else {
        note(`+ would create ${label} (${RESEARCH_WEBHOOK_EVENTS.length} events, API version ${STRIPE_API_VERSION})`)
        action = 'would-create'
      }
    } else {
      if (webhookEndpoint.api_version !== STRIPE_API_VERSION) {
        log(
          `! ${label} ${webhookEndpoint.id} uses API version ${webhookEndpoint.api_version ?? '(account default)'} instead of ${STRIPE_API_VERSION}; Stripe cannot change that in place — re-run with --rotate-webhook to recreate it.`
        )
      }
      const drift = describeWebhookDrift(webhookEndpoint, webhookParams)
      if (drift.length === 0) {
        note(`= ${label} ${webhookEndpoint.id} exists`)
        action = 'exists'
      } else if (apply) {
        // Nie die URL ändern: eine andere URL ist ein anderer Endpoint.
        await stripe.webhookEndpoints.update(webhookEndpoint.id, {
          enabled_events: [...webhookParams.enabled_events],
          description: webhookParams.description,
          ...(drift.includes('disabled') ? { disabled: false } : {}),
        })
        note(`~ updated ${label} ${webhookEndpoint.id} (${drift.join(', ')})`)
        action = 'updated'
      } else {
        note(`~ would update ${label} ${webhookEndpoint.id} (${drift.join(', ')})`)
        action = 'would-update'
      }
    }
    webhook = { id: webhookEndpoint?.id ?? null, url: webhookUrl, action, secretObtained: webhookSecret !== null }
    if (webhookSecret && !vercelBranch) {
      log('! The signing secret is never printed. Reveal it in the Stripe dashboard (Webhooks → endpoint → Signing secret) or re-run with --vercel-branch <branch> --rotate-webhook.')
    }
  }

  /** @type {Array<{ name: string, value: string | null }>} */
  const idValues = [
    ...desiredResearchProducts().map((product) => ({ name: product.envName, value: productIds[product.tier] ?? null })),
    ...desired.map((price) => ({ name: price.envName, value: priceIds[price.envName] ?? null })),
    ...RESEARCH_PORTALS.map((portal) => ({ name: portal.envName, value: portalConfigurationIds[portal.kind] ?? null })),
  ]
  const envLines = idValues.map(({ name, value }) => `${name}=${value ?? PENDING}`)

  // 7) Vercel-Branch-Overrides (nur mit --vercel-branch). Das Secret zuerst:
  // es ist das einzige, das sich nicht erneut aus Stripe lesen lässt.
  /** @type {VercelEnvResult[]} */
  const vercelEnv = []
  if (vercelBranch && vercel) {
    note(`Vercel env (preview, branch ${vercelBranch}):`)
    let failed = false
    /** @param {VercelEnvResult} entry @param {string} line */
    const report = (entry, line) => {
      vercelEnv.push(entry)
      note(`  ${line}`)
    }
    /** @param {string} name @param {string} value @param {boolean} sensitive */
    const write = async (name, value, sensitive) => {
      if (failed) return report({ name, status: 'skipped', reason: 'an earlier write failed' }, `- ${name} skipped (an earlier write failed)`)
      try {
        await vercel.writeEnv({ name, value, sensitive })
        report({ name, status: 'written' }, `+ ${name} written${sensitive ? ' (sensitive)' : ''}`)
      } catch (error) {
        failed = true
        report({ name, status: 'failed', reason: messageOf(error) }, `! ${name} failed: ${messageOf(error)}`)
      }
    }

    const secretOnVercel = vercelExisting ? vercelExisting.has(WEBHOOK_SECRET_ENV) : null
    if (!webhookUrl) {
      report({ name: WEBHOOK_SECRET_ENV, status: 'skipped', reason: 'no --webhook-url' }, `- ${WEBHOOK_SECRET_ENV} skipped (no --webhook-url given)`)
    } else if (webhookSecret) {
      await write(WEBHOOK_SECRET_ENV, webhookSecret, true)
      if (failed) {
        log(`! The new signing secret was NOT stored. Re-run with --rotate-webhook, or reveal it in the Stripe dashboard and set ${WEBHOOK_SECRET_ENV} yourself.`)
      }
    } else if (!apply && webhook && ['would-create', 'would-rotate'].includes(webhook.action)) {
      report({ name: WEBHOOK_SECRET_ENV, status: 'would-write' }, `+ would write ${WEBHOOK_SECRET_ENV} (sensitive; secret of the new endpoint)`)
    } else if (webhook && ['created', 'rotated'].includes(webhook.action)) {
      report({ name: WEBHOOK_SECRET_ENV, status: 'skipped', reason: 'Stripe returned no signing secret' }, `- ${WEBHOOK_SECRET_ENV} skipped (Stripe returned no signing secret)`)
    } else {
      const where = secretOnVercel === null ? 'unknown whether it is set on Vercel' : secretOnVercel ? 'it is set on Vercel' : 'it is NOT set on Vercel'
      const reason = `the signing secret of existing endpoint ${webhook?.id ?? '(unknown)'} is unknown (Stripe returns it only on create; ${where})`
      report({ name: WEBHOOK_SECRET_ENV, status: 'skipped', reason }, `- ${WEBHOOK_SECRET_ENV} skipped: ${reason}`)
      note(
        `  ! If ${WEBHOOK_SECRET_ENV} of branch ${vercelBranch} is missing or does not belong to ${webhook?.id ?? 'this endpoint'}, re-run with --rotate-webhook: it deletes and recreates only that endpoint and writes the new secret.`
      )
    }

    for (const { name, value } of idValues) {
      const existing = vercelExisting?.get(name)
      if (value === null) {
        report({ name, status: apply ? 'skipped' : 'would-write', reason: 'no value yet' }, apply ? `- ${name} skipped (no value)` : `+ would write ${name} (after --apply creates it)`)
      } else if (existing && !existing.sensitive && existing.value === value) {
        report({ name, status: 'unchanged' }, `= ${name} unchanged`)
      } else if (!apply) {
        report({ name, status: 'would-write' }, `+ would write ${name}`)
      } else {
        await write(name, value, false)
      }
    }
  }
  webhookSecret = null

  return { apply, productIds, priceIds, portalConfigurationIds, envLines, actions, webhook, vercelEnv }
}

const USAGE = `
Usage:
  STRIPE_SECRET_KEY=sk_test_… node scripts/research-stripe-setup.mjs [--apply]
      [--terms-url URL] [--privacy-url URL]
      [--webhook-url https://<preview-host>${WEBHOOK_PATH} [--rotate-webhook]]
      [--vercel-branch <git branch> [--vercel-project NAME] [--vercel-scope SCOPE]]

  Dry run by default (Stripe and Vercel are only read). --apply writes to
  Stripe (test mode only) and, with --vercel-branch, to Vercel. Live keys are
  always refused.

  --webhook-url URL      Manage ONE Stripe test webhook endpoint for this URL
                         (https, ends with ${WEBHOOK_PATH}, no credentials).
                         Created if missing; events/description fixed if they
                         drifted; the URL is never changed.
  --rotate-webhook       Delete and recreate only that endpoint to get a new
                         signing secret (needs --webhook-url and --vercel-branch).
  --vercel-branch NAME   Write the 12 ID variables (Config) and, when the
                         endpoint was created/rotated in this run,
                         ${WEBHOOK_SECRET_ENV} (Sensitive) as Preview overrides for
                         this git branch via \`npx -y vercel@latest env add\`.
                         Values go via stdin only. main, dev and the production
                         branch are refused.
  --vercel-project NAME  Vercel project (default ${DEFAULT_VERCEL_PROJECT})
  --vercel-scope SCOPE   Vercel team scope (default ${DEFAULT_VERCEL_SCOPE})

  The signing secret is never printed.
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

  // Der echte Adapter startet die Vercel-CLI (ohne STRIPE_SECRET_KEY im Env).
  const vercel = args.vercelBranch
    ? createVercelCliEnv({ project: args.vercelProject, scope: args.vercelScope, branch: args.vercelBranch })
    : null
  if (vercel) console.log(`Vercel: project ${args.vercelProject}, scope ${args.vercelScope}, preview branch ${args.vercelBranch}`)

  const result = await runResearchStripeSetup({ stripe, args, vercel })
  console.log('\nEnvironment variables:')
  for (const line of result.envLines) console.log(line)

  if (result.vercelEnv.some((entry) => entry.status === 'failed')) {
    console.error('\nSome Vercel variables could not be written (see above). Fix the cause and re-run; Stripe objects are found again.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Nur Meldung/Typ ausgeben; Stripe-Fehler enthalten nie den Key.
    const details = error && typeof error === 'object' ? /** @type {{ type?: string, code?: string }} */ (error) : {}
    console.error('Setup failed:', error instanceof Error ? error.message : String(error), details.type ?? '', details.code ?? '')
    process.exit(1)
  })
}
