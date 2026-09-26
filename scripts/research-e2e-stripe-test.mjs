#!/usr/bin/env node
// End-to-End-Test des PAT-Research-Abo-Lebenszyklus gegen ein Vercel-Preview —
// ausschließlich im Stripe-TESTMODUS und gegen die Research-Test-DB.
//
// Ablauf (Stripe Test Clock = simulierte Zeit, keine echten Kunden/Zahlungen):
//   1. Test-Customer (metadata.researchUserId) + Abo "member/month"   → Zugang
//   2. Planwechsel auf "supporter/month" (proration none)             → Stufe im Cache
//   3. Kündigung zum Periodenende                                      → Zugang bleibt
//   4. Kündigung zurücknehmen
//   5. Verlängerung scheitert (Test-Karte "charge customer fail")      → past_due + Kulanz
//   6. Sofortige Beendigung                                            → kein Zugang
//   7. Echter Checkout- und Portal-Aufruf über lib/research/stripe.ts (Parameter-Check)
// Das Preview verarbeitet die Webhooks; geprüft wird die Cache-Zeile in der Test-DB.
// Aufräumen: Test Clock (inkl. Customer/Abo) und die Test-DB-Zeile werden gelöscht.
//
// Sicherheit: bricht ab ohne sk_test_/rk_test_-Key; die DB muss die Research-
// Test-DB sein (DATABASE_URL == RESEARCH_TEST_DATABASE_URL in der Env-Datei).
// Gibt weder Keys noch Connection-Strings aus.
//
// Aufruf: STRIPE_SECRET_KEY=sk_test_… node scripts/research-e2e-stripe-test.mjs --env-file <vercel env pull des Research-Branches>

import fs from 'node:fs'
import { createRequire } from 'node:module'
import Stripe from 'stripe'
import pg from 'pg'
import ts from 'typescript'
import { parseEnvFile, databaseIdentity } from './research-env-isolation.mjs'
import * as config from '../lib/research/config.mjs'
import * as accessRules from '../lib/research/access-rules.mjs'
import * as subscriptionSync from '../lib/research/subscription-sync.mjs'

const argValue = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const fail = (message) => {
  console.error(`ABBRUCH: ${message}`)
  process.exit(1)
}

const key = process.env.STRIPE_SECRET_KEY ?? ''
if (!/^(sk|rk)_test_/.test(key)) fail('nur Stripe-Testmodus-Keys (sk_test_/rk_test_) sind erlaubt')
const envFile = argValue('--env-file')
if (!envFile) fail('--env-file fehlt')
const env = parseEnvFile(fs.readFileSync(envFile, 'utf8'))
const dbUrl = env.DATABASE_URL
if (!dbUrl || databaseIdentity(dbUrl) !== databaseIdentity(env.RESEARCH_TEST_DATABASE_URL)) {
  fail('DATABASE_URL ist nicht die Research-Test-DB (RESEARCH_TEST_DATABASE_URL)')
}
for (const name of Object.values(config.RESEARCH_PRICE_ENV).flatMap((byInterval) => Object.values(byInterval))) {
  if (!env[name]) fail(`${name} fehlt in der Env-Datei (erst scripts/research-stripe-setup.mjs --apply)`)
}

const stripe = new Stripe(key, { apiVersion: '2024-10-28.acacia' })
const db = new pg.Client({ connectionString: dbUrl })
await db.connect()

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function readRow(userId) {
  const { rows } = await db.query(
    'SELECT "status","tier","billingInterval","priceId","cancelAtPeriodEnd","cancelAt","currentPeriodEnd","pastDueSince","updatedAt","stripeSubscriptionId" FROM "ResearchSubscription" WHERE "userId" = $1',
    [userId]
  )
  return rows[0] ?? null
}

async function waitForRow(userId, predicate, label, timeoutMs = 90_000) {
  const started = Date.now()
  let row = null
  while (Date.now() - started < timeoutMs) {
    row = await readRow(userId)
    if (row && predicate(row)) return row
    await sleep(2_000)
  }
  console.log(`   … Zeitüberschreitung bei "${label}"; letzter Stand: ${row ? `${row.status}/${row.tier}/${row.billingInterval} cancelAtPeriodEnd=${row.cancelAtPeriodEnd}` : 'keine Zeile'}`)
  return row
}

async function advanceClock(clockId, toUnix) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix })
  for (let i = 0; i < 90; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (clock.status === 'ready') return
    if (clock.status === 'internal_failure') throw new Error('test clock internal failure')
    await sleep(2_000)
  }
  throw new Error('test clock did not become ready')
}

const nowUnix = Math.floor(Date.now() / 1000)
const userId = `user_e2eresearch${nowUnix.toString(36)}`
const price = (tier, interval) => config.getResearchPriceId(tier, interval, env)
let clock = null

try {
  console.log(`Test-User ${userId} (nur Stripe-Testmodus, Research-Test-DB ${databaseIdentity(dbUrl)})`)
  clock = await stripe.testHelpers.testClocks.create({ frozen_time: nowUnix, name: `PAT Research E2E ${userId}` })
  const customer = await stripe.customers.create({
    email: `e2e+${userId}@example.com`,
    test_clock: clock.id,
    metadata: { [config.RESEARCH_CUSTOMER_METADATA_KEY]: userId, pat_e2e: 'research' },
  })
  const goodCard = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: goodCard.id } })

  // 1) Abo anlegen
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price('member', 'month') }],
    metadata: { userId, product: config.RESEARCH_PRODUCT, tier: 'member', interval: 'month' },
  })
  let row = await waitForRow(userId, (r) => r.status === 'active', 'Abo aktiv')
  let access = row ? accessRules.computeResearchAccess(row, nowUnix * 1000) : null
  check('1. Neues Abo landet per Webhook im Cache', row?.status === 'active' && row?.tier === 'member' && row?.billingInterval === 'month', row ? `${row.status}/${row.tier}/${row.billingInterval}` : 'keine Zeile')
  check('1. Zugang aktiv', access?.hasAccess === true, access?.reason ?? '—')

  // 2) Planwechsel
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: subscription.items.data[0].id, price: price('supporter', 'month') }],
    proration_behavior: 'none',
  })
  row = await waitForRow(userId, (r) => r.tier === 'supporter', 'Planwechsel')
  check('2. Planwechsel Member → Supporter im Cache', row?.tier === 'supporter' && row?.billingInterval === 'month', row ? `${row.tier}/${row.billingInterval}` : 'keine Zeile')

  // 3) Kündigung zum Periodenende
  await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true })
  row = await waitForRow(userId, (r) => r.cancelAtPeriodEnd === true, 'Kündigung vorgemerkt')
  access = row ? accessRules.computeResearchAccess(row, nowUnix * 1000) : null
  check('3. Kündigung zum Periodenende vorgemerkt, Zugang bleibt', row?.cancelAtPeriodEnd === true && access?.hasAccess === true, access?.reason ?? '—')

  // 4) Kündigung zurücknehmen
  await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
  row = await waitForRow(userId, (r) => r.cancelAtPeriodEnd === false, 'Kündigung zurückgenommen')
  check('4. Kündigung zurückgenommen', row?.cancelAtPeriodEnd === false)

  // 5) Verlängerung scheitert → past_due
  const badCard = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: badCard.id } })
  await stripe.subscriptions.update(subscription.id, { default_payment_method: badCard.id })
  const current = await stripe.subscriptions.retrieve(subscription.id)
  const periodEnd = current.current_period_end ?? current.items.data[0]?.current_period_end
  await advanceClock(clock.id, periodEnd + 2 * 60 * 60)
  row = await waitForRow(userId, (r) => r.status === 'past_due', 'past_due', 150_000)
  const clockNow = (await stripe.testHelpers.testClocks.retrieve(clock.id)).frozen_time
  access = row ? accessRules.computeResearchAccess(row, Date.now()) : null
  check('5. Gescheiterte Verlängerung → past_due im Cache', row?.status === 'past_due' && row?.pastDueSince !== null, row ? `${row.status}, pastDueSince ${row.pastDueSince ? 'gesetzt' : 'fehlt'}` : 'keine Zeile')
  check('5. past_due-Kulanz gibt vorerst Zugang (72 h)', access?.hasAccess === true && access?.reason === 'past_due_grace', access?.reason ?? '—')
  void clockNow

  // 6) Sofortige Beendigung
  await stripe.subscriptions.cancel(subscription.id)
  row = await waitForRow(userId, (r) => r.status === 'canceled', 'beendet')
  access = row ? accessRules.computeResearchAccess(row, Date.now()) : null
  check('6. Beendetes Abo → kein Zugang', row?.status === 'canceled' && access?.hasAccess === false, access?.reason ?? '—')

  // 7) Echter Checkout- und Portal-Aufruf über lib/research/stripe.ts
  const research = loadResearchStripeModule({ stripe, customerId: customer.id })
  const checkout = await research.createResearchCheckoutSession({
    userId,
    email: customer.email,
    tier: 'member',
    interval: 'year',
    consentReference: `e2e-${userId}`,
    successUrl: 'https://example.com/research/welcome?session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: 'https://example.com/research/pricing?checkout=cancelled',
  })
  check('7. Checkout-Session mit den echten Parametern (inkl. automatic_tax)', typeof checkout.url === 'string' && checkout.url.startsWith('https://checkout.stripe.com/'))
  if (checkout.sessionId) await stripe.checkout.sessions.expire(checkout.sessionId).catch(() => {})
  const portal = await research.createResearchPortalSession({ userId, returnUrl: 'https://example.com/research/account' })
  check('7. Kundenportal mit Research-Konfiguration (monatlich)', typeof portal.url === 'string' && portal.url.startsWith('https://billing.stripe.com/'))
} catch (error) {
  check('Unerwarteter Fehler', false, error instanceof Error ? error.message.replace(/sk_(test|live)_\w+/g, 'sk_***') : String(error))
} finally {
  if (clock) await stripe.testHelpers.testClocks.del(clock.id).catch(() => {})
  await db.query('DELETE FROM "ResearchSubscription" WHERE "userId" = $1', [userId]).catch(() => {})
  await db.query('DELETE FROM "ResearchConsentEvent" WHERE "userId" = $1', [userId]).catch(() => {})
  await db.end()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} bestanden. Aufgeräumt: Test Clock (inkl. Customer/Abo) und Test-DB-Zeilen.`)
process.exit(failed === 0 ? 0 : 1)

// Lädt lib/research/stripe.ts mit dem echten (Test-)Stripe-Client und einem
// Minimal-Prisma, das nur die Research-Cache-Zeile dieses Tests kennt.
function loadResearchStripeModule({ stripe: client, customerId }) {
  const require = createRequire(import.meta.url)
  const source = fs.readFileSync(new URL('../lib/research/stripe.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  const fakePrisma = {
    researchSubscription: {
      findUnique: async () => ({ stripeCustomerId: customerId, billingInterval: 'month' }),
    },
  }
  const replacements = {
    'server-only': {},
    '@/lib/stripe': { stripe: client },
    '@/lib/prisma': { prisma: fakePrisma, withPrismaRetry: (operation) => operation() },
    '@/lib/research/config.mjs': config,
    '@/lib/research/access-rules.mjs': accessRules,
    '@/lib/research/subscription-sync.mjs': subscriptionSync,
    '@/lib/research/consent': { recordResearchConsent: async () => ({ id: 'e2e' }) },
    '@/lib/telegram-notify': { sendCortanaTelegram: async () => {} },
  }
  const compiled = { exports: {} }
  const previousEnv = { ...process.env }
  Object.assign(process.env, Object.fromEntries(Object.entries(env).filter(([name]) => name.startsWith('STRIPE_RESEARCH_') || name.startsWith('STRIPE_PRICE_ID_RESEARCH_'))))
  void previousEnv
  new Function('require', 'module', 'exports', outputText)((id) => (id in replacements ? replacements[id] : require(id)), compiled, compiled.exports)
  return compiled.exports
}
