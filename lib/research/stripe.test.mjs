import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

import * as accessRules from './access-rules.mjs'
import * as config from './config.mjs'
import * as subscriptionSync from './subscription-sync.mjs'
import {
  buildPortalConfigurationParams,
  checkStripeKeyMode,
  describePortalDrift,
  desiredResearchPrices,
  desiredResearchProducts,
  parseSetupArgs,
  runResearchStripeSetup,
} from '../../scripts/research-stripe-setup.mjs'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const USER = 'user_2abcDEF123'
const OTHER_USER = 'user_2otherXYZ9'
const NOW_S = Math.floor(Date.now() / 1000)
const DAY_S = 24 * 3600

const TEST_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_placeholder_for_unit_tests',
  STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY: 'price_reader_m',
  STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL: 'price_reader_y',
  STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY: 'price_member_m',
  STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL: 'price_member_y',
  STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY: 'price_supporter_m',
  STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL: 'price_supporter_y',
  STRIPE_RESEARCH_PRODUCT_ID_READER: 'prod_reader',
  STRIPE_RESEARCH_PRODUCT_ID_MEMBER: 'prod_member',
  STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER: 'prod_supporter',
  STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY: 'bpc_research_monthly',
  STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL: 'bpc_research_annual',
  STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC: 'bpc_research_basic',
  // Alte Einzel-Konfiguration (Monat + Jahr gemischt): darf nie mehr benutzt werden.
  STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID: undefined,
  RESEARCH_STRIPE_AUTOMATIC_TAX: undefined,
}

async function withEnv(overrides, fn) {
  const merged = { ...TEST_ENV, ...overrides }
  const previous = {}
  for (const [key, value] of Object.entries(merged)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function researchSubscription(overrides = {}) {
  const { metadata, priceId = 'price_member_m', ...rest } = overrides
  return {
    id: 'sub_research1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_research',
    created: NOW_S - DAY_S,
    cancel_at_period_end: false,
    cancel_at: null,
    current_period_end: NOW_S + 29 * DAY_S,
    metadata: metadata ?? { userId: USER, product: 'research', tier: 'member', interval: 'month' },
    items: { data: [{ price: { id: priceId, product: 'prod_research', metadata: {} } }] },
    ...rest,
  }
}

// In-Memory-Prisma mit den Unique-Indizes von ResearchSubscription (userId, stripeSubscriptionId).
function fakePrisma({ rows = [], consentEvents = [] } = {}) {
  const state = { rows: rows.map(row => ({ ...row })), consentEvents: [...consentEvents], upserts: [], transactions: 0, failNextUpsertWithP2002: false }
  const pick = (row, select) => (row && select ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]])) : row ? { ...row } : null)
  const researchSubscription = {
    async findUnique({ where, select }) {
      const row = state.rows.find(r => (where.userId ? r.userId === where.userId : r.stripeSubscriptionId === where.stripeSubscriptionId))
      return pick(row, select)
    },
    async upsert({ where, create, update }) {
      state.upserts.push({ where, create, update })
      if (state.failNextUpsertWithP2002) {
        state.failNextUpsertWithP2002 = false
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      }
      const index = state.rows.findIndex(r => r.userId === where.userId)
      const next = index >= 0 ? { ...state.rows[index], ...update, updatedAt: new Date() } : { ...create, updatedAt: new Date() }
      if (state.rows.some((r, i) => i !== index && r.stripeSubscriptionId === next.stripeSubscriptionId)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      }
      if (index >= 0) state.rows[index] = next
      else state.rows.push(next)
      return next
    },
  }
  const researchConsentEvent = {
    async findFirst({ where }) {
      const found = state.consentEvents.find(e => e.userId === where.userId && e.kind === where.kind && e.reference === where.reference)
      return found ? { id: found.id } : null
    },
  }
  const prisma = {
    researchSubscription,
    researchConsentEvent,
    async $transaction(fn) {
      state.transactions++
      return fn({ researchSubscription })
    },
  }
  return { prisma, state }
}

const customerIdOf = value => (typeof value === 'string' ? value : value?.id ?? null)

function fakeStripe({ customersByQuery = {}, subscriptions = {}, sessions = {}, sessionError, openSessions = [], expireErrors = {} } = {}) {
  const calls = []
  const stripe = {
    customers: {
      async search(params) {
        calls.push(['customers.search', params])
        return { data: customersByQuery[params.query] ?? [] }
      },
      async create(params, options) {
        calls.push(['customers.create', params, options])
        return { id: 'cus_created', created: NOW_S, ...params }
      },
      async update(id, params) {
        calls.push(['customers.update', id, params])
        return { id }
      },
    },
    checkout: {
      sessions: {
        async create(params) {
          calls.push(['checkout.sessions.create', params])
          return { id: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/cs_test_new' }
        },
        async retrieve(id) {
          calls.push(['checkout.sessions.retrieve', id])
          if (sessionError) throw sessionError
          const session = sessions[id]
          if (!session) throw Object.assign(new Error('No such checkout.session'), { code: 'resource_missing', statusCode: 404 })
          return session
        },
        async list(params) {
          calls.push(['checkout.sessions.list', params])
          return { data: openSessions.filter(session => session.customer === params.customer && session.status === params.status), has_more: false }
        },
        async expire(id) {
          calls.push(['checkout.sessions.expire', id])
          if (expireErrors[id]) throw expireErrors[id]
          const session = openSessions.find(candidate => candidate.id === id)
          session.status = 'expired'
          return session
        },
      },
    },
    billingPortal: {
      sessions: {
        async create(params) {
          calls.push(['billingPortal.sessions.create', params])
          return { url: 'https://billing.stripe.com/p/session/test_123' }
        },
      },
    },
    subscriptions: {
      async retrieve(id) {
        calls.push(['subscriptions.retrieve', id])
        const subscription = subscriptions[id]
        if (!subscription) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 })
        return subscription
      },
      async list(params) {
        calls.push(['subscriptions.list', params])
        const data = Object.values(subscriptions)
          .filter(subscription => customerIdOf(subscription.customer) === params.customer)
          .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
        return { data, has_more: false }
      },
    },
  }
  return { stripe, calls }
}

function scenario({ rows, consentEvents, stripe: stripeOptions, telegramError, consentError } = {}) {
  const db = fakePrisma({ rows, consentEvents })
  const { stripe, calls } = fakeStripe(stripeOptions)
  const consents = []
  const telegram = []
  const research = loadTs('./stripe.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma: db.prisma, withPrismaRetry: operation => operation() },
    '@/lib/research/access-rules.mjs': accessRules,
    '@/lib/research/config.mjs': config,
    '@/lib/research/subscription-sync.mjs': subscriptionSync,
    '@/lib/research/consent': {
      async recordResearchConsent(input) {
        if (consentError) throw consentError
        consents.push(input)
        db.state.consentEvents.push({ id: `consent_${consents.length}`, ...input })
        return { id: `consent_${consents.length}` }
      },
    },
    '@/lib/stripe': { stripe },
    '@/lib/telegram-notify': {
      async sendCortanaTelegram(text) {
        telegram.push(text)
        if (telegramError) throw telegramError
      },
    },
  })
  return { research, calls, db: db.state, consents, telegram }
}

const quietConsole = t => {
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})
}

const allCallArgs = calls => JSON.stringify(calls)

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

test('customer: the cached ResearchSubscription customer is reused without searching or creating', async () => {
  const s = scenario({ rows: [{ userId: USER, stripeCustomerId: 'cus_cached', stripeSubscriptionId: 'sub_old', status: 'canceled' }] })
  assert.equal(await s.research.findOrCreateResearchCustomer(USER, 'petar@example.com'), 'cus_cached')
  assert.deepEqual(s.calls, [['customers.update', 'cus_cached', { invoice_settings: { footer: '', custom_fields: [] } }]])
})

test('customer: Stripe search by researchUserId picks the newest live customer', async () => {
  const query = `metadata['researchUserId']:'${USER}'`
  const s = scenario({
    stripe: {
      customersByQuery: {
        [query]: [
          { id: 'cus_old', created: 100 },
          { id: 'cus_deleted', created: 300, deleted: true },
          { id: 'cus_new', created: 200 },
        ],
      },
    },
  })
  assert.equal(await s.research.findOrCreateResearchCustomer(USER, 'petar@example.com'), 'cus_new')
  assert.deepEqual(s.calls[0], ['customers.search', { query, limit: 10 }])
  assert.equal(s.calls.some(([name]) => name === 'customers.create'), false)
})

test('customer: creation uses the idempotency key and never sets metadata.userId', async () => {
  const s = scenario()
  assert.equal(await s.research.findOrCreateResearchCustomer(USER, ' petar@example.com '), 'cus_created')
  const create = s.calls.find(([name]) => name === 'customers.create')
  assert.deepEqual(create, [
    'customers.create',
    { email: 'petar@example.com', preferred_locales: ['en'], metadata: { researchUserId: USER } },
    { idempotencyKey: `research-customer-v1-${USER}` },
  ])
  assert.deepEqual(s.calls.at(-1), ['customers.update', 'cus_created', { invoice_settings: { footer: '', custom_fields: [] } }])
  for (const [, ...args] of s.calls) {
    assert.doesNotMatch(JSON.stringify(args), /"userId"/, 'no metadata.userId on the research customer')
  }
})

test('customer: ids that could break the search query are rejected before any Stripe call', async () => {
  const s = scenario()
  for (const userId of ["user_abc' OR metadata['x']:'y", 'user_', 'usr_abc', '', 'user_abc def']) {
    await assert.rejects(s.research.findOrCreateResearchCustomer(userId, 'petar@example.com'), /Invalid research user id/)
  }
  await assert.rejects(s.research.findOrCreateResearchCustomer(USER, '  '), /Missing email/)
  assert.deepEqual(s.calls, [])
})

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

const checkoutInput = {
  userId: USER,
  email: 'petar@example.com',
  tier: 'supporter',
  interval: 'year',
  consentReference: '0b8f7c1e-5a2d-4c1b-9d3e-2f6a7b8c9d0e',
  successUrl: 'https://research.example.test/welcome?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://research.example.test/pricing?checkout=cancelled',
}

test('checkout: session parameters are exact', async () => {
  await withEnv({}, async () => {
    const s = scenario()
    const result = await s.research.createResearchCheckoutSession(checkoutInput)
    assert.deepEqual(result, { url: 'https://checkout.stripe.com/c/pay/cs_test_new', sessionId: 'cs_test_new' })
    const create = s.calls.find(([name]) => name === 'checkout.sessions.create')
    const { expires_at: expiresAt, ...params } = create[1]
    const nowS = Math.floor(Date.now() / 1000)
    assert.ok(expiresAt > nowS + 30 * 60 && expiresAt <= nowS + 35 * 60, 'expires 35 minutes after creation (Stripe minimum is 30)')
    assert.deepEqual(params, {
      mode: 'subscription',
      customer: 'cus_created',
      line_items: [{ price: 'price_supporter_y', quantity: 1 }],
      locale: 'en',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true },
      client_reference_id: USER,
      subscription_data: { metadata: { userId: USER, product: 'research', tier: 'supporter', interval: 'year' } },
      metadata: {
        userId: USER,
        product: 'research',
        tier: 'supporter',
        interval: 'year',
        consentReference: checkoutInput.consentReference,
      },
      custom_text: { submit: { message: s.research.RESEARCH_CHECKOUT_SUBMIT_MESSAGE } },
      success_url: checkoutInput.successUrl,
      cancel_url: checkoutInput.cancelUrl,
    })
    assert.ok(s.research.RESEARCH_CHECKOUT_SUBMIT_MESSAGE.length <= 300)
    assert.match(s.research.RESEARCH_CHECKOUT_SUBMIT_MESSAGE, /right of withdrawal/)
    assert.equal('trial_period_days' in create[1].subscription_data, false)
    // Customer-Schritte vor der Session
    assert.deepEqual(s.calls.map(([name]) => name), [
      'customers.search',
      'customers.create',
      'customers.update',
      'checkout.sessions.list',
      'subscriptions.list',
      'checkout.sessions.create',
    ])
  })
})

const cachedCanceledRow = { userId: USER, stripeCustomerId: 'cus_cached', stripeSubscriptionId: 'sub_old', status: 'canceled' }

test('checkout: older open research sessions of the customer are expired before a new one is created', async () => {
  await withEnv({}, async () => {
    const openSessions = [
      { id: 'cs_test_tab1', customer: 'cus_cached', status: 'open', metadata: { product: 'research', userId: USER } },
      { id: 'cs_test_tab2', customer: 'cus_cached', status: 'open', metadata: { product: 'research', userId: USER } },
      { id: 'cs_test_raid', customer: 'cus_cached', status: 'open', metadata: { product: 'raidmap' } },
      { id: 'cs_test_elsewhere', customer: 'cus_someone_else', status: 'open', metadata: { product: 'research' } },
    ]
    const s = scenario({ rows: [cachedCanceledRow], stripe: { openSessions } })
    await s.research.createResearchCheckoutSession(checkoutInput)
    assert.deepEqual(s.calls.slice(0, 5), [
      ['customers.update', 'cus_cached', { invoice_settings: { footer: '', custom_fields: [] } }],
      ['checkout.sessions.list', { customer: 'cus_cached', status: 'open', limit: 100 }],
      ['checkout.sessions.expire', 'cs_test_tab1'],
      ['checkout.sessions.expire', 'cs_test_tab2'],
      ['subscriptions.list', { customer: 'cus_cached', status: 'all', limit: 100 }],
    ])
    assert.equal(s.calls.at(-1)[0], 'checkout.sessions.create')
    assert.deepEqual(openSessions.map(session => session.status), ['expired', 'expired', 'open', 'open'])
    assert.equal(s.research.RESEARCH_CHECKOUT_SESSION_TTL_SECONDS, 35 * 60)
  })
})

test('checkout: an open research subscription in Stripe blocks a second checkout (already_subscribed)', async () => {
  await withEnv({}, async () => {
    // Cache sagt "kein Zugang" (z. B. past_due nach Ablauf der 72 h), Stripe kennt das Abo aber noch.
    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']) {
      const previous = researchSubscription({ id: 'sub_prev', status, customer: 'cus_cached' })
      const s = scenario({ rows: [cachedCanceledRow], stripe: { subscriptions: { sub_prev: previous } } })
      await assert.rejects(s.research.createResearchCheckoutSession(checkoutInput), error => {
        assert.equal(s.research.isResearchStripeError(error, 'already_subscribed'), true)
        assert.equal(error.subscriptionStatus, status)
        return true
      })
      assert.equal(s.calls.some(([name]) => name === 'checkout.sessions.create'), false, status)
    }
    // Beendete Research-Abos und Abos anderer Produkte blockieren nicht.
    const s = scenario({
      rows: [cachedCanceledRow],
      stripe: {
        subscriptions: {
          sub_canceled: researchSubscription({ id: 'sub_canceled', status: 'canceled', customer: 'cus_cached' }),
          sub_expired: researchSubscription({ id: 'sub_expired', status: 'incomplete_expired', customer: 'cus_cached' }),
          sub_raid: researchSubscription({ id: 'sub_raid', customer: 'cus_cached', metadata: { userId: USER, product: 'raidmap' } }),
        },
      },
    })
    assert.deepEqual(await s.research.createResearchCheckoutSession(checkoutInput), {
      url: 'https://checkout.stripe.com/c/pay/cs_test_new',
      sessionId: 'cs_test_new',
    })
  })
})

test('checkout: a session completed while being expired is caught by the subscription check', async () => {
  await withEnv({}, async () => {
    const notOpen = Object.assign(new Error('Only open sessions can be expired'), { type: 'StripeInvalidRequestError' })
    const openSessions = [{ id: 'cs_test_paying', customer: 'cus_cached', status: 'open', metadata: { product: 'research' } }]
    const s = scenario({
      rows: [cachedCanceledRow],
      stripe: {
        openSessions,
        expireErrors: { cs_test_paying: notOpen },
        sessions: { cs_test_paying: { id: 'cs_test_paying', status: 'complete' } },
        subscriptions: { sub_paid: researchSubscription({ id: 'sub_paid', customer: 'cus_cached' }) },
      },
    })
    await assert.rejects(s.research.createResearchCheckoutSession(checkoutInput), { code: 'already_subscribed' })
    assert.equal(s.calls.some(([name]) => name === 'checkout.sessions.create'), false)

    // Ist die Session nach dem Fehler noch offen, wird nicht weitergemacht.
    const stillOpen = scenario({
      rows: [cachedCanceledRow],
      stripe: {
        openSessions: [{ id: 'cs_test_stuck', customer: 'cus_cached', status: 'open', metadata: { product: 'research' } }],
        expireErrors: { cs_test_stuck: new Error('Stripe down') },
        sessions: { cs_test_stuck: { id: 'cs_test_stuck', status: 'open' } },
      },
    })
    await assert.rejects(stillOpen.research.createResearchCheckoutSession(checkoutInput), /Stripe down/)
    assert.equal(stillOpen.calls.some(([name]) => name === 'checkout.sessions.create'), false)
  })
})

test('checkout: automatic tax can be switched off explicitly', async () => {
  await withEnv({ RESEARCH_STRIPE_AUTOMATIC_TAX: '0' }, async () => {
    const s = scenario()
    await s.research.createResearchCheckoutSession(checkoutInput)
    assert.deepEqual(s.calls.at(-1)[1].automatic_tax, { enabled: false })
  })
})

test('checkout: a missing price fails with missing_price before touching Stripe', async () => {
  await withEnv({ STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL: '  ' }, async () => {
    const s = scenario()
    await assert.rejects(s.research.createResearchCheckoutSession(checkoutInput), error => {
      assert.equal(error.code, 'missing_price')
      assert.equal(s.research.isResearchStripeError(error, 'missing_price'), true)
      assert.ok(error instanceof s.research.ResearchStripeError)
      return true
    })
    await assert.rejects(s.research.createResearchCheckoutSession({ ...checkoutInput, tier: 'gold' }), { code: 'missing_price' })
    assert.deepEqual(s.calls, [])
  })
})

test('checkout: missing Stripe key and malformed urls fail before touching Stripe', async () => {
  await withEnv({ STRIPE_SECRET_KEY: undefined }, async () => {
    const s = scenario()
    await assert.rejects(s.research.createResearchCheckoutSession(checkoutInput), { code: 'not_configured' })
    assert.deepEqual(s.calls, [])
  })
  await withEnv({}, async () => {
    const s = scenario()
    await assert.rejects(
      s.research.createResearchCheckoutSession({ ...checkoutInput, successUrl: 'https://research.example.test/welcome' }),
      /CHECKOUT_SESSION_ID/
    )
    await assert.rejects(s.research.createResearchCheckoutSession({ ...checkoutInput, cancelUrl: '/pricing' }), /cancel url/)
    await assert.rejects(s.research.createResearchCheckoutSession({ ...checkoutInput, consentReference: '' }), /consent reference/)
    assert.deepEqual(s.calls, [])
  })
})

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

test('portal: without a research customer it fails with no_customer and never creates one', async () => {
  await withEnv({}, async () => {
    const s = scenario()
    await assert.rejects(
      s.research.createResearchPortalSession({ userId: USER, returnUrl: 'https://research.example.test/account' }),
      { name: 'ResearchStripeError', code: 'no_customer' }
    )
    assert.deepEqual(s.calls.map(([name]) => name), ['customers.search'])
  })
})

const portalInput = { userId: USER, returnUrl: 'https://research.example.test/account' }
const portalRow = billingInterval => ({ userId: USER, stripeCustomerId: 'cus_cached', stripeSubscriptionId: 'sub_1', status: 'active', billingInterval })

test('portal: the configuration follows the cached billing interval (no monthly <-> annual switch)', async () => {
  await withEnv({ STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID: 'bpc_legacy_mixed' }, async () => {
    for (const [billingInterval, configuration] of [
      ['month', 'bpc_research_monthly'],
      ['year', 'bpc_research_annual'],
      [null, 'bpc_research_basic'],
      ['week', 'bpc_research_basic'],
    ]) {
      const s = scenario({ rows: [portalRow(billingInterval)] })
      assert.deepEqual(await s.research.createResearchPortalSession(portalInput), { url: 'https://billing.stripe.com/p/session/test_123' })
      assert.deepEqual(s.calls, [
        ['billingPortal.sessions.create', { customer: 'cus_cached', return_url: portalInput.returnUrl, locale: 'en', configuration }],
      ], String(billingInterval))
    }

    // Ohne Cache-Zeile (Customer nur über die Stripe-Suche gefunden) ist das Intervall unbekannt ⇒ basic.
    const s = scenario({ stripe: { customersByQuery: { [`metadata['researchUserId']:'${USER}'`]: [{ id: 'cus_searched', created: 1 }] } } })
    await s.research.createResearchPortalSession(portalInput)
    assert.deepEqual(s.calls.at(-1), [
      'billingPortal.sessions.create',
      { customer: 'cus_searched', return_url: portalInput.returnUrl, locale: 'en', configuration: 'bpc_research_basic' },
    ])
  })
})

test('portal: a missing configuration fails with not_configured and never falls back to the default (mentorship) portal', async () => {
  for (const [billingInterval, envName] of [
    ['month', 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY'],
    ['year', 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL'],
    [null, 'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC'],
  ]) {
    for (const missing of [undefined, '   ']) {
      // Die anderen beiden (und die alte Einzel-Konfiguration) sind gesetzt — trotzdem kein Ausweichen.
      await withEnv({ [envName]: missing, STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID: 'bpc_legacy_mixed' }, async () => {
        const s = scenario({ rows: [portalRow(billingInterval)] })
        await assert.rejects(s.research.createResearchPortalSession(portalInput), error => {
          assert.equal(s.research.isResearchStripeError(error, 'not_configured'), true)
          assert.match(error.message, new RegExp(envName))
          return true
        })
        assert.deepEqual(s.calls, [], `${billingInterval}: no Stripe call at all`)
      })
    }
  }
})

// ---------------------------------------------------------------------------
// Subscription-Sync
// ---------------------------------------------------------------------------

test('sync: a research subscription is fetched fresh from Stripe and upserted by userId', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const fresh = researchSubscription({ status: 'active' })
    const s = scenario({ stripe: { subscriptions: { sub_research1: fresh } } })
    // Das Event-Objekt ist veraltet (incomplete); gespeichert wird der frische Stand.
    const result = await s.research.handleResearchSubscriptionEvent({ ...fresh, status: 'incomplete' })
    assert.deepEqual(result, { action: 'upserted' })
    assert.deepEqual(s.calls, [['subscriptions.retrieve', 'sub_research1']])
    assert.equal(s.db.rows.length, 1)
    assert.equal(s.db.rows[0].userId, USER)
    assert.equal(s.db.rows[0].status, 'active')
    assert.equal(s.db.rows[0].tier, 'member')
    assert.equal(s.db.rows[0].billingInterval, 'month')
    assert.equal(s.db.transactions, 1)
    assert.deepEqual(s.db.upserts[0].where, { userId: USER })
    assert.equal(s.db.upserts[0].create.userId, USER)
    assert.equal('userId' in s.db.upserts[0].update, false)
  })
})

test('sync: non-research subscriptions and missing userId are skipped without writes', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario({
      stripe: {
        subscriptions: {
          sub_raidmap: researchSubscription({ id: 'sub_raidmap', metadata: { userId: USER, product: 'raidmap' } }),
          sub_nouser: researchSubscription({ id: 'sub_nouser', metadata: { product: 'research' } }),
        },
      },
    })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_raidmap'), { action: 'skipped', reason: 'not_research' })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_nouser'), { action: 'skipped', reason: 'missing_user_id' })
    assert.equal(s.db.upserts.length, 0)
    await assert.rejects(s.research.syncResearchSubscriptionById('sub_x"; drop'), /Invalid Stripe subscription id/)
  })
})

test('sync: a subscription already stored for a different user is skipped with a warning (no email in logs)', async t => {
  const warn = t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'log', () => {})
  await withEnv({}, async () => {
    const s = scenario({
      rows: [{ userId: OTHER_USER, stripeCustomerId: 'cus_other', stripeSubscriptionId: 'sub_research1', status: 'active' }],
      stripe: { subscriptions: { sub_research1: researchSubscription() } },
    })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_research1'), {
      action: 'skipped',
      reason: 'subscription_owned_by_other_user',
    })
    assert.equal(s.db.upserts.length, 0)
    assert.equal(warn.mock.callCount(), 1)
    assert.doesNotMatch(JSON.stringify(warn.mock.calls[0].arguments), /@/)
  })
})

test('sync: a stale event of an old subscription does not overwrite the live one', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const live = {
      userId: USER,
      stripeCustomerId: 'cus_research',
      stripeSubscriptionId: 'sub_live',
      status: 'active',
      tier: 'member',
      billingInterval: 'month',
      currentPeriodEnd: new Date((NOW_S + 20 * DAY_S) * 1000),
      stripeCreatedAt: new Date((NOW_S - DAY_S) * 1000),
      updatedAt: new Date(),
    }
    const stale = researchSubscription({ id: 'sub_old', status: 'canceled', created: NOW_S - 400 * DAY_S, current_period_end: NOW_S - DAY_S })
    const s = scenario({ rows: [live], stripe: { subscriptions: { sub_old: stale } } })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_old'), { action: 'skipped', reason: 'existing_subscription_preferred' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_live')
    assert.equal(s.db.upserts.length, 0)
  })
})

test('sync: past_due keeps its first timestamp across repeated events', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const firstFailure = new Date(Date.now() - 30 * 3600 * 1000)
    const rows = [
      {
        userId: USER,
        stripeCustomerId: 'cus_research',
        stripeSubscriptionId: 'sub_research1',
        status: 'past_due',
        tier: 'member',
        billingInterval: 'month',
        pastDueSince: firstFailure,
        updatedAt: new Date(),
      },
    ]
    const s = scenario({ rows, stripe: { subscriptions: { sub_research1: researchSubscription({ status: 'past_due' }) } } })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_research1'), { action: 'upserted' })
    assert.deepEqual(s.db.rows[0].pastDueSince, firstFailure)
  })
})

test('sync: a concurrent insert (unique violation) is retried once', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario({ stripe: { subscriptions: { sub_research1: researchSubscription() } } })
    s.db.failNextUpsertWithP2002 = true
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_research1'), { action: 'upserted' })
    assert.equal(s.db.transactions, 2)
    assert.equal(s.db.rows.length, 1)
  })
})

test('sync: two active subscriptions for one user alert Petar without failing', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const older = {
      userId: USER,
      stripeCustomerId: 'cus_research',
      stripeSubscriptionId: 'sub_older',
      status: 'active',
      tier: 'reader',
      billingInterval: 'month',
      currentPeriodEnd: new Date((NOW_S + 10 * DAY_S) * 1000),
      stripeCreatedAt: new Date((NOW_S - 20 * DAY_S) * 1000),
      updatedAt: new Date(),
    }
    const s = scenario({ rows: [older], stripe: { subscriptions: { sub_research1: researchSubscription() } }, telegramError: new Error('telegram down') })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_research1'), { action: 'upserted' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_research1')
    assert.equal(s.telegram.length, 1)
    assert.match(s.telegram[0], /zwei aktive Abos/)
    assert.match(s.telegram[0], /sub_older und sub_research1/)
    assert.match(s.telegram[0], /Im Cache \(gibt Zugang\): sub_research1/)
  })
})

test('sync: cancelling the cached subscription of a double subscription falls back to the remaining active one', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const a = researchSubscription({
      id: 'sub_a',
      created: NOW_S - 200 * DAY_S,
      current_period_end: NOW_S + 165 * DAY_S,
      priceId: 'price_reader_y',
      metadata: { userId: USER, product: 'research', tier: 'reader', interval: 'year' },
    })
    const b = researchSubscription({ id: 'sub_b', created: NOW_S - 60 })
    const s = scenario({ stripe: { subscriptions: { sub_a: a, sub_b: b } } })

    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_a'), { action: 'upserted' })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_b'), { action: 'upserted' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_b')
    assert.equal(s.telegram.length, 1)
    assert.match(s.telegram[0], /sub_a und sub_b/)
    assert.match(s.telegram[0], /Im Cache \(gibt Zugang\): sub_b/)

    // Petar storniert B (das gecachte) sofort mit Erstattung → der Cache wechselt auf A.
    b.status = 'canceled'
    assert.deepEqual(await s.research.handleResearchSubscriptionEvent(b), { action: 'upserted', reason: 'fallback_subscription' })
    assert.ok(s.calls.some(([name, params]) => name === 'subscriptions.list' && params.customer === 'cus_research' && params.status === 'all'))
    assert.equal(s.db.rows.length, 1)
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_a')
    assert.equal(s.db.rows[0].status, 'active')
    assert.equal(s.db.rows[0].tier, 'reader')
    assert.equal(s.db.rows[0].billingInterval, 'year')
    assert.equal(accessRules.computeResearchAccess(s.db.rows[0], Date.now()).hasAccess, true)

    // Späte Wiederholung des B-Events: A bleibt (wird nur aufgefrischt).
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_b'), { action: 'upserted', reason: 'existing_subscription_preferred' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_a')

    // Endet auch A, gibt es keinen Ersatz mehr: A wird als beendet gespeichert.
    a.status = 'canceled'
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_a'), { action: 'upserted' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_a')
    assert.equal(s.db.rows[0].status, 'canceled')
    assert.equal(s.telegram.length, 1)
  })
})

test('sync: a fallback candidate stored for another user is never used', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const rows = [
      { userId: USER, stripeCustomerId: 'cus_research', stripeSubscriptionId: 'sub_b', status: 'active', tier: 'member', billingInterval: 'month', currentPeriodEnd: new Date((NOW_S + 20 * DAY_S) * 1000), stripeCreatedAt: new Date((NOW_S - DAY_S) * 1000), updatedAt: new Date() },
      { userId: OTHER_USER, stripeCustomerId: 'cus_research', stripeSubscriptionId: 'sub_a', status: 'active', tier: 'member', billingInterval: 'month', currentPeriodEnd: new Date((NOW_S + 20 * DAY_S) * 1000), updatedAt: new Date() },
    ]
    const s = scenario({
      rows,
      stripe: { subscriptions: { sub_a: researchSubscription({ id: 'sub_a' }), sub_b: researchSubscription({ id: 'sub_b', status: 'canceled' }) } },
    })
    assert.deepEqual(await s.research.syncResearchSubscriptionById('sub_b'), { action: 'upserted' })
    assert.equal(s.db.rows[0].stripeSubscriptionId, 'sub_b')
    assert.equal(s.db.rows[0].status, 'canceled')
    assert.equal(s.db.rows[1].userId, OTHER_USER)
  })
})

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

function completedSession(overrides = {}) {
  return {
    id: 'cs_test_done',
    object: 'checkout.session',
    status: 'complete',
    subscription: 'sub_research1',
    amount_total: 1000,
    currency: 'usd',
    customer_details: { email: 'Jane.Doe@Example.COM' },
    metadata: { userId: USER, product: 'research', tier: 'member', interval: 'month', consentReference: 'ref-123' },
    ...overrides,
  }
}

test('checkout completed: syncs, records the consent once and notifies with the email domain only', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario({ stripe: { subscriptions: { sub_research1: researchSubscription() } } })
    await s.research.handleResearchCheckoutCompleted(completedSession())
    assert.equal(s.db.rows[0].status, 'active')
    assert.deepEqual(s.consents, [
      { userId: USER, kind: 'checkout_completed', reference: 'ref-123', metadata: { sessionId: 'cs_test_done', subscriptionId: 'sub_research1' } },
    ])
    assert.equal(s.telegram.length, 1)
    assert.match(s.telegram[0], /PAT Research/)
    assert.match(s.telegram[0], /Member · monatlich · 10\.00 USD/)
    assert.match(s.telegram[0], /example\.com/)
    assert.doesNotMatch(s.telegram[0], /jane|doe|@/i)

    // Doppelte Zustellung desselben Events: kein zweiter Eintrag, keine zweite Nachricht.
    await s.research.handleResearchCheckoutCompleted(completedSession())
    assert.equal(s.consents.length, 1)
    assert.equal(s.telegram.length, 1)
  })
})

test('checkout completed: notification failures are not fatal, sync failures are', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario({ stripe: { subscriptions: { sub_research1: researchSubscription() } }, telegramError: new Error('telegram down') })
    await s.research.handleResearchCheckoutCompleted(completedSession())
    assert.equal(s.consents.length, 1)

    const broken = scenario({ stripe: { subscriptions: {} } })
    await assert.rejects(broken.research.handleResearchCheckoutCompleted(completedSession()), /No such subscription/)
    assert.equal(broken.consents.length, 0)
    assert.equal(broken.telegram.length, 0)
  })
})

test('checkout completed: falls back to the session id as reference and rejects non-research sessions', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario({ stripe: { subscriptions: { sub_research1: researchSubscription() } } })
    await s.research.handleResearchCheckoutCompleted(
      completedSession({ metadata: { userId: USER, product: 'research', tier: 'member', interval: 'month' } })
    )
    assert.equal(s.consents[0].reference, 'cs_test_done')

    await assert.rejects(s.research.handleResearchCheckoutCompleted(completedSession({ metadata: { product: 'raidmap' } })), {
      code: 'not_research',
    })
  })
})

test('invoice paid: the Cortana message shows amount, plan and reason but no email address', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario()
    await s.research.notifyResearchInvoicePaid(
      { amount_paid: 10000, currency: 'usd', billing_reason: 'subscription_cycle', customer_email: 'someone@proton.me' },
      researchSubscription({ priceId: 'price_member_y', metadata: { userId: USER, product: 'research', tier: 'member', interval: 'year' } })
    )
    assert.equal(s.telegram.length, 1)
    assert.match(s.telegram[0], /100\.00 USD · Member · jährlich · Verlängerung/)
    assert.match(s.telegram[0], /proton\.me/)
    assert.doesNotMatch(s.telegram[0], /someone/)
  })
})

test('invoice paid: the plan comes from the current price, not the checkout metadata (portal plan change)', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const s = scenario()
    const checkoutMetadata = { userId: USER, product: 'research', tier: 'reader', interval: 'month' }
    await s.research.notifyResearchInvoicePaid(
      { amount_paid: 15000, currency: 'usd', billing_reason: 'subscription_update', customer_email: 'a@b.example' },
      researchSubscription({ priceId: 'price_supporter_y', metadata: checkoutMetadata })
    )
    assert.match(s.telegram[0], /150\.00 USD · Supporter · jährlich · Planwechsel/)

    // Unbekannter Preis: dann eben die Checkout-Metadaten.
    await s.research.notifyResearchInvoicePaid(
      { amount_paid: 700, currency: 'usd', billing_reason: 'subscription_cycle', customer_email: 'a@b.example' },
      { ...researchSubscription({ metadata: checkoutMetadata }), items: { data: [{ price: { id: 'price_legacy', product: 'prod_other', metadata: {} } }] } }
    )
    assert.match(s.telegram[1], /7\.00 USD · Reader · monatlich · Verlängerung/)
  })
})

// ---------------------------------------------------------------------------
// /welcome
// ---------------------------------------------------------------------------

test('welcome sync: sessions of other users, other products or unknown ids are foreign_session', async () => {
  await withEnv({}, async () => {
    const s = scenario({
      stripe: {
        sessions: {
          cs_test_other: completedSession({ id: 'cs_test_other', metadata: { userId: OTHER_USER, product: 'research' } }),
          cs_test_raid: completedSession({ id: 'cs_test_raid', metadata: { userId: USER, product: 'raidmap' } }),
        },
      },
    })
    for (const sessionId of ['cs_test_other', 'cs_test_raid', 'cs_test_missing', 'not-a-session', '']) {
      await assert.rejects(s.research.syncResearchCheckoutSessionForUser({ sessionId, userId: USER }), { code: 'foreign_session' })
    }
    assert.equal(s.calls.some(([name]) => name === 'subscriptions.retrieve'), false)
  })
})

test('welcome sync: other Stripe errors propagate', async () => {
  await withEnv({}, async () => {
    const s = scenario({ stripe: { sessionError: Object.assign(new Error('Stripe down'), { statusCode: 500 }) } })
    await assert.rejects(s.research.syncResearchCheckoutSessionForUser({ sessionId: 'cs_test_x', userId: USER }), /Stripe down/)
  })
})

test('welcome sync: active, pending and failed', async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const cases = [
      [researchSubscription({ status: 'active' }), completedSession(), 'active'],
      [researchSubscription({ status: 'incomplete' }), completedSession(), 'pending'],
      [researchSubscription({ status: 'incomplete_expired' }), completedSession(), 'failed'],
      [null, completedSession({ subscription: null, status: 'open' }), 'pending'],
      [null, completedSession({ subscription: null, status: 'expired' }), 'failed'],
    ]
    for (const [subscription, session, expected] of cases) {
      const s = scenario({
        stripe: { sessions: { cs_test_done: session }, subscriptions: subscription ? { sub_research1: subscription } : {} },
      })
      assert.deepEqual(await s.research.syncResearchCheckoutSessionForUser({ sessionId: 'cs_test_done', userId: USER }), { status: expected })
    }
  })
})

test('errors are logged without email addresses', () => {
  const s = scenario()
  const details = s.research.describeResearchErrorForLog(
    Object.assign(new Error('Invalid email: jane.doe+x@example.com for customer'), { code: 'email_invalid', type: 'StripeInvalidRequestError' })
  )
  assert.equal(details.code, 'email_invalid')
  assert.equal(details.type, 'StripeInvalidRequestError')
  assert.doesNotMatch(details.message, /jane|example\.com/)
  assert.match(details.message, /\[email\]/)
})

// ---------------------------------------------------------------------------
// scripts/research-stripe-setup.mjs
// ---------------------------------------------------------------------------

test('setup script: only test keys are accepted; live keys are always refused and never echoed', () => {
  const noFlags = { live: false, liveApproval: false }
  assert.deepEqual(checkStripeKeyMode('sk_test_abc', noFlags), { ok: true, mode: 'test' })
  assert.deepEqual(checkStripeKeyMode('rk_test_abc', noFlags), { ok: true, mode: 'test' })
  for (const [key, flags] of [
    ['sk_live_secretvalue', noFlags],
    ['rk_live_secretvalue', noFlags],
    ['sk_live_secretvalue', { live: true, liveApproval: true }],
    ['pk_test_secretvalue', noFlags],
    ['', noFlags],
    [undefined, noFlags],
    ['sk_test_secretvalue', { live: true, liveApproval: false }],
  ]) {
    const result = checkStripeKeyMode(key, flags)
    assert.equal(result.ok, false)
    assert.doesNotMatch(result.message, /secretvalue/)
  }
})

test('setup script: argument parsing', () => {
  assert.deepEqual(parseSetupArgs([]), { apply: false, live: false, liveApproval: false, help: false, termsUrl: null, privacyUrl: null })
  assert.deepEqual(parseSetupArgs(['--apply', '--terms-url', 'https://r.example/terms', '--privacy-url=https://r.example/privacy']), {
    apply: true,
    live: false,
    liveApproval: false,
    help: false,
    termsUrl: 'https://r.example/terms',
    privacyUrl: 'https://r.example/privacy',
  })
  assert.throws(() => parseSetupArgs(['--terms-url', 'http://insecure.example/terms']), /https/)
  assert.throws(() => parseSetupArgs(['--terms-url']), /Missing value/)
  assert.throws(() => parseSetupArgs(['--force']), /Unknown argument/)
})

test('setup script: six USD prices with lookup keys and env names', () => {
  assert.deepEqual(
    desiredResearchPrices().map(p => [p.lookupKey, p.unitAmount, p.interval, p.envName]),
    [
      ['pat_research_reader_month_v1', 700, 'month', 'STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY'],
      ['pat_research_member_month_v1', 1000, 'month', 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY'],
      ['pat_research_supporter_month_v1', 1500, 'month', 'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY'],
      ['pat_research_reader_year_v1', 7000, 'year', 'STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL'],
      ['pat_research_member_year_v1', 10000, 'year', 'STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL'],
      ['pat_research_supporter_year_v1', 15000, 'year', 'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL'],
    ]
  )
})

class FakeStripeInvalidRequestError extends Error {
  type = 'StripeInvalidRequestError'
}

// Regeln, die Stripe beim Portal-Katalog durchsetzt (docs.stripe.com/customer-management,
// "Technical limitations"): je Produkt höchstens EIN Preis pro Intervall und
// Währung, jedes Produkt nur einmal, höchstens 10 Produkte, Preise gehören zum Produkt.
function assertStripePortalCatalog(params, prices) {
  const products = params.features?.subscription_update?.products
  if (!Array.isArray(products)) return
  if (products.length > 10) throw new FakeStripeInvalidRequestError('You can specify at most 10 products.')
  const seenProducts = new Set()
  for (const entry of products) {
    if (seenProducts.has(entry.product)) throw new FakeStripeInvalidRequestError(`Product ${entry.product} is listed twice.`)
    seenProducts.add(entry.product)
    const slots = new Set()
    for (const priceId of entry.prices) {
      const price = prices.find(p => p.id === priceId)
      if (!price) throw new FakeStripeInvalidRequestError(`No such price: '${priceId}'`)
      if (customerIdOf(price.product) !== entry.product) throw new FakeStripeInvalidRequestError(`Price ${priceId} does not belong to product ${entry.product}.`)
      const slot = `${price.recurring?.interval}/${price.currency}`
      if (slots.has(slot)) {
        throw new FakeStripeInvalidRequestError(`Product ${entry.product} has multiple prices with the same recurring.interval and currency (${slot}).`)
      }
      slots.add(slot)
    }
  }
}

function fakeSetupStripe({ products = [], prices = [], configurations = [] } = {}) {
  const calls = []
  let counter = 0
  const page = list => async params => {
    calls.push(['list', params])
    if (params.lookup_keys) return { data: list.filter(item => params.lookup_keys.includes(item.lookup_key)), has_more: false }
    return { data: list, has_more: false }
  }
  const stripe = {
    products: {
      list: page(products),
      async create(params, options) {
        calls.push(['products.create', params, options])
        const product = { id: `prod_new${++counter}`, active: true, ...params }
        products.push(product)
        return product
      },
    },
    prices: {
      list: page(prices),
      async create(params, options) {
        calls.push(['prices.create', params, options])
        // Wie Stripe: ein vergebener lookup_key wandert nur mit transfer_lookup_key.
        const holder = params.lookup_key ? prices.find(p => p.lookup_key === params.lookup_key) : null
        if (holder && params.transfer_lookup_key !== true) {
          throw new FakeStripeInvalidRequestError(`A price (${holder.id}) already uses that lookup key.`)
        }
        if (holder) holder.lookup_key = null
        const price = {
          id: `price_new${++counter}`,
          active: true,
          currency: params.currency,
          unit_amount: params.unit_amount,
          recurring: { interval: params.recurring.interval, interval_count: 1 },
          tax_behavior: params.tax_behavior,
          lookup_key: params.lookup_key,
          product: params.product,
          metadata: params.metadata,
        }
        prices.push(price)
        return price
      },
    },
    billingPortal: {
      configurations: {
        list: page(configurations),
        async create(params) {
          calls.push(['configurations.create', params])
          assertStripePortalCatalog(params, prices)
          const configuration = { id: `bpc_new${++counter}`, active: true, ...params }
          configurations.push(configuration)
          return configuration
        },
        async update(id, params) {
          calls.push(['configurations.update', id, params])
          assertStripePortalCatalog(params, prices)
          const index = configurations.findIndex(c => c.id === id)
          configurations[index] = { ...configurations[index], ...params }
          return configurations[index]
        },
      },
    },
  }
  return { stripe, calls, products, prices, configurations }
}

const writes = calls => calls.filter(([name]) => name !== 'list')
const setupArgs = extra => ({ ...parseSetupArgs(['--terms-url', 'https://r.example/terms', '--privacy-url', 'https://r.example/privacy']), ...extra })

test('setup script: dry run writes nothing and prints placeholders', async () => {
  const fake = fakeSetupStripe({ products: [{ id: 'prod_mentorship', active: true, metadata: {} }] })
  const result = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: false }), log: () => {} })
  assert.deepEqual(writes(fake.calls), [])
  assert.equal(result.envLines.length, 12)
  assert.ok(result.envLines.every(line => line.endsWith('=<created on --apply>')))
  assert.deepEqual(result.envLines.slice(0, 3).map(line => line.split('=')[0]), [
    'STRIPE_RESEARCH_PRODUCT_ID_READER',
    'STRIPE_RESEARCH_PRODUCT_ID_MEMBER',
    'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER',
  ])
  assert.deepEqual(result.envLines.slice(-3).map(line => line.split('=')[0]), [
    'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY',
    'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL',
    'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC',
  ])
  assert.equal(result.envLines.some(line => line.startsWith('STRIPE_RESEARCH_PRODUCT_ID=')), false)
  assert.ok(result.actions.includes('+ would create product "PAT Research Member"'))
  assert.ok(result.actions.includes('+ would create portal configuration monthly'))
  assert.ok(result.actions.includes('+ would create portal configuration annual'))
  assert.ok(result.actions.includes('+ would create portal configuration basic'))
})

test('setup script: --apply creates one product per tier, prices and three interval-scoped portals once; a re-run changes nothing', async () => {
  const fake = fakeSetupStripe({
    products: [{ id: 'prod_mentorship', active: true, metadata: {} }],
    configurations: [{ id: 'bpc_default', active: true, is_default: true, metadata: {} }],
  })
  const lines = []
  // Der Fake lehnt (wie Stripe) Portal-Kataloge mit zwei Preisen gleichen Produkts und Intervalls ab.
  const first = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: line => lines.push(line) })

  const created = writes(fake.calls)
  assert.deepEqual(created.map(([name]) => name), [
    ...Array(3).fill('products.create'),
    ...Array(6).fill('prices.create'),
    ...Array(3).fill('configurations.create'),
  ])
  assert.deepEqual(created.slice(0, 3).map(([, params, options]) => [params.name, params.metadata, options.idempotencyKey]), [
    ['PAT Research Reader', { pat_product: 'research', research_tier: 'reader' }, 'pat-research-setup-v2-product-reader'],
    ['PAT Research Member', { pat_product: 'research', research_tier: 'member' }, 'pat-research-setup-v2-product-member'],
    ['PAT Research Supporter', { pat_product: 'research', research_tier: 'supporter' }, 'pat-research-setup-v2-product-supporter'],
  ])
  const productIds = first.productIds
  assert.equal(new Set(Object.values(productIds)).size, 3)
  for (const [, params, options] of created.slice(3, 9)) {
    assert.equal(params.currency, 'usd')
    assert.equal(params.tax_behavior, 'inclusive')
    assert.match(params.lookup_key, /^pat_research_(reader|member|supporter)_(month|year)_v1$/)
    assert.deepEqual(Object.keys(params.metadata).sort(), ['pat_product', 'research_interval', 'research_tier'])
    // Jeder Preis hängt am Produkt SEINER Stufe (Monat + Jahr je Produkt).
    assert.equal(params.product, productIds[params.metadata.research_tier])
    assert.equal(params.transfer_lookup_key, undefined)
    assert.equal(options.idempotencyKey, `pat-research-setup-v2-price-${params.metadata.research_tier}-${params.metadata.research_interval}`)
  }

  const catalogFor = interval =>
    desiredResearchPrices()
      .filter(p => p.interval === interval)
      .map(p => ({ product: productIds[p.tier], prices: [first.priceIds[p.envName]] }))
  const [monthly, annual, basic] = created.slice(9).map(([, params]) => params)
  assert.deepEqual([monthly, annual, basic].map(params => params.metadata), [
    { pat_product: 'research', pat_portal: 'monthly' },
    { pat_product: 'research', pat_portal: 'annual' },
    { pat_product: 'research', pat_portal: 'basic' },
  ])
  // Stufenwechsel nur innerhalb eines Intervalls, und je Produkt genau EIN Preis
  // (Stripe: keine zwei Preise mit gleichem product + recurring.interval).
  for (const [params, interval] of [[monthly, 'month'], [annual, 'year']]) {
    assert.deepEqual(params.features.subscription_update, {
      enabled: true,
      default_allowed_updates: ['price'],
      products: catalogFor(interval),
      proration_behavior: 'none',
    })
  }
  const monthlyIds = catalogFor('month').flatMap(entry => entry.prices)
  const annualIds = catalogFor('year').flatMap(entry => entry.prices)
  assert.equal(new Set(monthlyIds).size, 3)
  assert.equal(monthlyIds.some(id => annualIds.includes(id)), false)
  assert.deepEqual(basic.features.subscription_update, { enabled: false })
  for (const portal of [monthly, annual, basic]) {
    assert.equal(portal.features.subscription_cancel.enabled, true)
    assert.equal(portal.features.subscription_cancel.mode, 'at_period_end')
    assert.equal(portal.features.subscription_cancel.cancellation_reason.enabled, true)
    assert.deepEqual(portal.features.payment_method_update, { enabled: true })
    assert.deepEqual(portal.features.invoice_history, { enabled: true })
    assert.equal(portal.business_profile.terms_of_service_url, 'https://r.example/terms')
    assert.equal(portal.business_profile.privacy_policy_url, 'https://r.example/privacy')
    assert.ok(portal.business_profile.headline.length <= 60)
  }

  const ids = first.portalConfigurationIds
  assert.equal(new Set([ids.monthly, ids.annual, ids.basic]).size, 3)
  assert.deepEqual(first.envLines, [
    `STRIPE_RESEARCH_PRODUCT_ID_READER=${productIds.reader}`,
    `STRIPE_RESEARCH_PRODUCT_ID_MEMBER=${productIds.member}`,
    `STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER=${productIds.supporter}`,
    ...desiredResearchPrices().map(p => `${p.envName}=${first.priceIds[p.envName]}`),
    `STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY=${ids.monthly}`,
    `STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL=${ids.annual}`,
    `STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC=${ids.basic}`,
  ])
  assert.doesNotMatch(lines.join('\n') + first.envLines.join('\n'), /sk_(test|live)_/)

  // Zweiter Lauf: alles gefunden, nichts geschrieben, gleiche IDs.
  const before = fake.calls.length
  const second = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  assert.deepEqual(writes(fake.calls.slice(before)), [])
  assert.deepEqual(second.envLines, first.envLines)
  // Fremde Objekte unverändert
  assert.deepEqual(fake.configurations[0], { id: 'bpc_default', active: true, is_default: true, metadata: {} })
})

test('setup script: the fake rejects portal catalogs like Stripe (one price per product and interval)', async () => {
  const product = 'prod_one'
  const prices = ['reader', 'member', 'supporter'].map(tier => ({ id: `price_${tier}_m`, product, currency: 'usd', recurring: { interval: 'month' } }))
  const fake = fakeSetupStripe({ prices: [...prices, { id: 'price_member_y', product, currency: 'usd', recurring: { interval: 'year' } }] })
  const catalog = products => ({ features: { subscription_update: { enabled: true, products } } })

  // Früheres Setup: EIN Produkt mit drei Monatspreisen — so hat Stripe es abgelehnt.
  await assert.rejects(
    fake.stripe.billingPortal.configurations.create(catalog([{ product, prices: prices.map(p => p.id) }])),
    /multiple prices with the same recurring\.interval and currency/
  )
  await assert.rejects(fake.stripe.billingPortal.configurations.create(catalog([{ product: 'prod_other', prices: ['price_member_m'] }])), /does not belong/)
  // Monat + Jahr desselben Produkts ist erlaubt.
  await fake.stripe.billingPortal.configurations.create(catalog([{ product, prices: ['price_member_m', 'price_member_y'] }]))

  // Auch das Script selbst baut nie mehr als einen Preis je Produkt in einen Intervall-Katalog.
  assert.throws(
    () => buildPortalConfigurationParams({ kind: 'monthly', products: [{ product, prices: prices.map(p => p.id) }], termsUrl: null, privacyUrl: null }),
    /exactly one price for product prod_one/
  )
  assert.throws(
    () =>
      buildPortalConfigurationParams({
        kind: 'annual',
        products: [{ product, prices: ['a'] }, { product, prices: ['b'] }],
        termsUrl: null,
        privacyUrl: null,
      }),
    /lists product prod_one twice/
  )
  assert.throws(() => buildPortalConfigurationParams({ kind: 'monthly', products: [], termsUrl: null, privacyUrl: null }), /catalog is empty/)
})

test('setup script: own prices of the legacy single product are replaced on the tier products (lookup_key transferred), the legacy product stays untouched', async () => {
  // Stand nach einem früheren --apply: Produkt "PAT Research" (ohne research_tier)
  // mit allen sechs Preisen; der Portal-Schritt ist damals an Stripe gescheitert.
  const legacyProduct = { id: 'prod_legacy', name: 'PAT Research', active: true, metadata: { pat_product: 'research' } }
  const legacyPrices = desiredResearchPrices().map(price => ({
    id: `price_legacy_${price.tier}_${price.interval}`,
    active: true,
    currency: 'usd',
    unit_amount: price.unitAmount,
    recurring: { interval: price.interval, interval_count: 1 },
    tax_behavior: 'inclusive',
    lookup_key: price.lookupKey,
    product: 'prod_legacy',
    metadata: { pat_product: 'research', research_tier: price.tier, research_interval: price.interval },
  }))
  const legacySnapshot = structuredClone(legacyProduct)
  const fake = fakeSetupStripe({ products: [legacyProduct], prices: legacyPrices })

  const dryLines = []
  const dry = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: false }), log: line => dryLines.push(line) })
  assert.deepEqual(writes(fake.calls), [])
  assert.ok(dry.actions.includes('~ would replace legacy price price_legacy_member_month with a new pat_research_member_month_v1 on the member product (lookup_key moves over)'), dry.actions.join('\n'))
  assert.ok(dryLines.some(line => line.startsWith('! legacy product prod_legacy')))

  const result = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  const created = writes(fake.calls)
  assert.deepEqual(created.map(([name]) => name), [
    ...Array(3).fill('products.create'),
    ...Array(6).fill('prices.create'),
    ...Array(3).fill('configurations.create'),
  ])
  for (const [, params] of created.filter(([name]) => name === 'prices.create')) {
    assert.equal(params.transfer_lookup_key, true)
    assert.equal(params.product, result.productIds[params.metadata.research_tier])
  }
  // Neue IDs, lookup_keys sind umgezogen, Altpreise und Altprodukt sonst unverändert.
  assert.equal(Object.values(result.priceIds).some(id => id.startsWith('price_legacy_')), false)
  const oldPrices = fake.prices.filter(price => price.id.startsWith('price_legacy_'))
  assert.equal(oldPrices.length, 6)
  assert.ok(oldPrices.every(price => price.lookup_key === null && price.active === true && price.product === 'prod_legacy'))
  assert.deepEqual(fake.products[0], legacySnapshot)
  assert.equal(result.envLines.some(line => line.includes('prod_legacy')), false)

  // Zweiter Lauf: nichts mehr zu tun.
  const before = fake.calls.length
  const again = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  assert.deepEqual(writes(fake.calls.slice(before)), [])
  assert.deepEqual(again.envLines, result.envLines)
})

test('setup script: a lookup-key price on the legacy product WITHOUT the research marker is never taken over', async () => {
  const legacyProduct = { id: 'prod_legacy', active: true, metadata: { pat_product: 'research' } }
  const foreign = {
    id: 'price_hand_made',
    active: true,
    currency: 'usd',
    unit_amount: 1000,
    recurring: { interval: 'month', interval_count: 1 },
    tax_behavior: 'inclusive',
    lookup_key: 'pat_research_member_month_v1',
    product: 'prod_legacy',
    metadata: {},
  }
  const fake = fakeSetupStripe({ products: [legacyProduct], prices: [foreign] })
  await assert.rejects(
    runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} }),
    /nothing was changed.*pat_research_member_month_v1 \(price_hand_made\): exists although no product with pat_product=research, research_tier=member was found/s
  )
  assert.deepEqual(writes(fake.calls), [])
  assert.equal(foreign.lookup_key, 'pat_research_member_month_v1')
})

test('setup script: existing prices that differ abort without any write', async () => {
  const product = { id: 'prod_member', active: true, metadata: { pat_product: 'research', research_tier: 'member' } }
  const wrong = {
    id: 'price_wrong',
    active: true,
    currency: 'usd',
    unit_amount: 900,
    recurring: { interval: 'month', interval_count: 1 },
    tax_behavior: 'exclusive',
    lookup_key: 'pat_research_member_month_v1',
    product: 'prod_member',
  }
  const fake = fakeSetupStripe({ products: [product], prices: [wrong] })
  await assert.rejects(runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} }), /unit_amount 900.*tax_behavior exclusive/s)
  assert.deepEqual(writes(fake.calls), [])

  // Preis am Produkt einer ANDEREN Stufe: ebenfalls Abbruch.
  const reader = { id: 'prod_reader', active: true, metadata: { pat_product: 'research', research_tier: 'reader' } }
  const misplaced = { ...wrong, id: 'price_misplaced', unit_amount: 1000, tax_behavior: 'inclusive', product: 'prod_reader' }
  const other = fakeSetupStripe({ products: [reader, product], prices: [misplaced] })
  await assert.rejects(
    runResearchStripeSetup({ stripe: other.stripe, args: setupArgs({ apply: true }), log: () => {} }),
    /pat_research_member_month_v1 \(price_misplaced\): belongs to another product/
  )
  assert.deepEqual(writes(other.calls), [])
})

test('setup script: lookup-key prices without the marked product abort before the product is created', async () => {
  const strays = desiredResearchPrices().map((price, index) => ({
    id: `price_stray${index}`,
    active: true,
    currency: 'usd',
    unit_amount: price.unitAmount,
    recurring: { interval: price.interval, interval_count: 1 },
    tax_behavior: 'inclusive',
    lookup_key: price.lookupKey,
    product: 'prod_manual',
  }))
  const fake = fakeSetupStripe({ products: [{ id: 'prod_manual', active: true, metadata: {} }], prices: strays })
  await assert.rejects(
    runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} }),
    /nothing was changed.*no product with pat_product=research, research_tier=reader was found/s
  )
  assert.deepEqual(writes(fake.calls), [])
  assert.equal(fake.products.length, 1)

  // Auch eine doppelte eigene Portal-Konfiguration (gleiches pat_portal) bricht vor jedem Schreiben ab.
  const marker = { pat_product: 'research', pat_portal: 'monthly' }
  const twoPortals = fakeSetupStripe({
    configurations: [
      { id: 'bpc_a', active: true, metadata: marker },
      { id: 'bpc_b', active: true, metadata: marker },
      { id: 'bpc_old', active: false, metadata: marker },
    ],
  })
  await assert.rejects(
    runResearchStripeSetup({ stripe: twoPortals.stripe, args: setupArgs({ apply: true }), log: () => {} }),
    /nothing was changed.*2 active research portal configurations with pat_portal=monthly \(bpc_a, bpc_b\)/s
  )
  assert.deepEqual(writes(twoPortals.calls), [])

  // Unbekannter pat_portal-Wert: ebenfalls Abbruch statt Raten.
  const unknownPortal = fakeSetupStripe({ configurations: [{ id: 'bpc_weekly', active: true, metadata: { pat_product: 'research', pat_portal: 'weekly' } }] })
  await assert.rejects(runResearchStripeSetup({ stripe: unknownPortal.stripe, args: setupArgs({ apply: true }), log: () => {} }), /bpc_weekly: unknown pat_portal=weekly/)
  assert.deepEqual(writes(unknownPortal.calls), [])
})

test('setup script: a legacy single research portal (monthly + annual mixed) is reported, never modified, and blocks the setup until deactivated', async () => {
  const legacy = {
    id: 'bpc_legacy',
    active: true,
    metadata: { pat_product: 'research' },
    features: { subscription_update: { enabled: true, proration_behavior: 'none', products: [{ product: 'prod_research', prices: ['p_m', 'p_y'] }] } },
  }
  const snapshot = structuredClone(legacy)
  const fake = fakeSetupStripe({ products: [{ id: 'prod_mentorship', active: true, metadata: {} }], configurations: [legacy] })

  for (const apply of [false, true]) {
    await assert.rejects(runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply }), log: () => {} }), error => {
      assert.match(error.message, /nothing was changed/)
      assert.match(error.message, /bpc_legacy: legacy research portal configuration without metadata pat_portal/)
      assert.match(error.message, /active=false/)
      return true
    })
  }
  assert.deepEqual(writes(fake.calls), [])
  assert.deepEqual(fake.configurations, [snapshot])
  assert.equal(fake.products.length, 1, 'no product created while the legacy portal is active')

  // Nach dem Deaktivieren läuft das Setup durch und legt die drei neuen Konfigurationen an; die alte bleibt unangetastet.
  legacy.active = false
  const result = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  assert.deepEqual(writes(fake.calls).filter(([name]) => name.startsWith('configurations.')).map(([name, params]) => [name, params.metadata.pat_portal]), [
    ['configurations.create', 'monthly'],
    ['configurations.create', 'annual'],
    ['configurations.create', 'basic'],
  ])
  assert.deepEqual(fake.configurations[0], { ...snapshot, active: false })
  assert.equal(Object.values(result.portalConfigurationIds).includes('bpc_legacy'), false)
})

test('setup script: ambiguous, archived or unknown-tier research products abort', async () => {
  const marker = { pat_product: 'research', research_tier: 'member' }
  const twice = fakeSetupStripe({ products: [{ id: 'prod_a', active: true, metadata: marker }, { id: 'prod_b', active: true, metadata: marker }] })
  await assert.rejects(
    runResearchStripeSetup({ stripe: twice.stripe, args: setupArgs({ apply: true }), log: () => {} }),
    /nothing was changed.*Found 2 products with metadata pat_product=research, research_tier=member \(prod_a, prod_b\)/s
  )
  const archived = fakeSetupStripe({ products: [{ id: 'prod_a', active: false, metadata: marker }] })
  await assert.rejects(runResearchStripeSetup({ stripe: archived.stripe, args: setupArgs({ apply: true }), log: () => {} }), /prod_a \(research_tier=member\) is archived/)
  const unknownTier = fakeSetupStripe({ products: [{ id: 'prod_gold', active: true, metadata: { pat_product: 'research', research_tier: 'gold' } }] })
  await assert.rejects(runResearchStripeSetup({ stripe: unknownTier.stripe, args: setupArgs({ apply: true }), log: () => {} }), /prod_gold: unknown research_tier=gold/)
  assert.deepEqual([...writes(twice.calls), ...writes(archived.calls), ...writes(unknownTier.calls)], [])

  // Ein archiviertes altes Einzelprodukt (ohne research_tier) stört nicht und wird nicht gemeldet.
  const archivedLegacy = fakeSetupStripe({ products: [{ id: 'prod_legacy', active: false, metadata: { pat_product: 'research' } }] })
  const lines = []
  await runResearchStripeSetup({ stripe: archivedLegacy.stripe, args: setupArgs({ apply: true }), log: line => lines.push(line) })
  assert.equal(lines.some(line => line.includes('prod_legacy')), false)
  assert.deepEqual(archivedLegacy.products[0], { id: 'prod_legacy', active: false, metadata: { pat_product: 'research' } })
})

test('setup script: drift in the own portal configurations is reported and fixed only with --apply', async () => {
  const fake = fakeSetupStripe({ products: [{ id: 'prod_mentorship', active: true, metadata: {} }] })
  const first = await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  const ids = first.portalConfigurationIds
  const annualPriceId = first.priceIds.STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL
  const monthly = fake.configurations.find(c => c.id === ids.monthly)
  const annual = fake.configurations.find(c => c.id === ids.annual)
  const basic = fake.configurations.find(c => c.id === ids.basic)
  // monthly: Proration verstellt UND beim Member-Produkt ein Jahrespreis dazugekommen
  // (= Intervallwechsel wieder möglich); dazu Produkte in anderer Reihenfolge (keine Abweichung).
  const monthlyUpdate = monthly.features.subscription_update
  monthly.features = {
    ...monthly.features,
    subscription_update: {
      ...monthlyUpdate,
      proration_behavior: 'always_invoice',
      products: [...monthlyUpdate.products]
        .reverse()
        .map(entry => (entry.product === first.productIds.member ? { ...entry, prices: [...entry.prices, annualPriceId] } : entry)),
    },
  }
  // basic: Planwechsel eingeschaltet
  basic.features = { ...basic.features, subscription_update: { enabled: true, default_allowed_updates: ['price'], products: [] } }

  const dryLines = []
  const before = fake.calls.length
  await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: false }), log: line => dryLines.push(line) })
  assert.deepEqual(writes(fake.calls.slice(before)), [])
  assert.ok(dryLines.includes(`~ would update portal configuration monthly ${ids.monthly} (subscription_update products/prices, proration_behavior always_invoice)`), dryLines.join('\n'))
  assert.ok(dryLines.includes(`~ would update portal configuration basic ${ids.basic} (subscription_update enabled)`), dryLines.join('\n'))
  assert.ok(dryLines.includes(`= portal configuration annual ${annual.id} exists`), dryLines.join('\n'))

  const beforeApply = fake.calls.length
  await runResearchStripeSetup({ stripe: fake.stripe, args: setupArgs({ apply: true }), log: () => {} })
  const updates = writes(fake.calls.slice(beforeApply))
  assert.deepEqual(updates.map(([name, id]) => [name, id]), [['configurations.update', ids.monthly], ['configurations.update', ids.basic]])
  assert.equal(updates[0][2].features.subscription_update.proration_behavior, 'none')
  assert.equal(updates[0][2].features.subscription_update.products.some(entry => entry.prices.includes(annualPriceId)), false)
  assert.ok(updates[0][2].features.subscription_update.products.every(entry => entry.prices.length === 1))
  assert.deepEqual(updates[1][2].features.subscription_update, { enabled: false })
})

test('setup script: portal drift detection', () => {
  const products = [{ product: 'prod_r', prices: ['p1'] }, { product: 'prod_m', prices: ['p2'] }]
  const desired = buildPortalConfigurationParams({ kind: 'monthly', products, termsUrl: null, privacyUrl: null })
  assert.deepEqual(desired.features.subscription_update.products, products)
  // Reihenfolge der Produkte (wie Stripe sie zurückgibt) ist keine Abweichung.
  const matching = { ...desired, features: { ...desired.features, subscription_update: { ...desired.features.subscription_update, products: [...products].reverse() } } }
  assert.deepEqual(describePortalDrift(matching, desired), [])
  const swapped = { ...matching, features: { ...matching.features, subscription_update: { ...matching.features.subscription_update, products: [{ product: 'prod_r', prices: ['p2'] }, { product: 'prod_m', prices: ['p1'] }] } } }
  assert.deepEqual(describePortalDrift(swapped, desired), ['subscription_update products/prices'])
  // Ohne übergebene URLs werden vorhandene URLs nicht als Abweichung gewertet.
  assert.deepEqual(describePortalDrift({ ...matching, business_profile: { ...desired.business_profile, privacy_policy_url: 'https://x' } }, desired), [])
  const drifted = { ...matching, features: { ...matching.features, subscription_update: { ...matching.features.subscription_update, proration_behavior: 'create_prorations' } } }
  assert.deepEqual(describePortalDrift(drifted, desired), ['proration_behavior create_prorations'])

  // basic: nur "Planwechsel aus" zählt; Produkte/Preise einer deaktivierten Funktion sind egal.
  const basic = buildPortalConfigurationParams({ kind: 'basic', termsUrl: null, privacyUrl: null })
  assert.deepEqual(basic.features.subscription_update, { enabled: false })
  assert.deepEqual(basic.metadata, { pat_product: 'research', pat_portal: 'basic' })
  assert.deepEqual(describePortalDrift({ ...basic, features: { ...basic.features, subscription_update: { enabled: false, products: [{ product: 'x', prices: ['y'] }] } } }, basic), [])
  assert.deepEqual(describePortalDrift({ ...basic, features: { ...basic.features, subscription_update: { enabled: true } } }, basic), ['subscription_update enabled'])
  assert.deepEqual(describePortalDrift({ ...basic, features: { ...basic.features, subscription_update: undefined } }, basic), ['subscription_update enabled'])
  assert.throws(() => buildPortalConfigurationParams({ kind: 'mixed', products, termsUrl: null, privacyUrl: null }), /Unknown research portal kind/)
})

test('config: one Stripe product per tier; the product id env is read per tier', () => {
  assert.deepEqual(config.RESEARCH_TIER_PRODUCT_ENV, {
    reader: 'STRIPE_RESEARCH_PRODUCT_ID_READER',
    member: 'STRIPE_RESEARCH_PRODUCT_ID_MEMBER',
    supporter: 'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER',
  })
  const env = { STRIPE_RESEARCH_PRODUCT_ID_MEMBER: ' prod_member ', STRIPE_RESEARCH_PRODUCT_ID_READER: '', STRIPE_RESEARCH_PRODUCT_ID: 'prod_single' }
  assert.equal(config.getResearchTierProductId('member', env), 'prod_member')
  assert.equal(config.getResearchTierProductId('reader', env), null)
  assert.equal(config.getResearchTierProductId('supporter', env), null)
  assert.equal(config.getResearchTierProductId('gold', env), null)
  assert.deepEqual(
    desiredResearchProducts().map(p => [p.tier, p.name, p.envName]),
    [
      ['reader', 'PAT Research Reader', 'STRIPE_RESEARCH_PRODUCT_ID_READER'],
      ['member', 'PAT Research Member', 'STRIPE_RESEARCH_PRODUCT_ID_MEMBER'],
      ['supporter', 'PAT Research Supporter', 'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER'],
    ]
  )
})

// ---------------------------------------------------------------------------
// Integration gegen die lokale Wegwerf-Postgres (nie Production):
//   RESEARCH_TEST_DATABASE_URL=postgresql://research@127.0.0.1:55433/research_test \
//     node --test lib/research/stripe.test.mjs
// Echte Prisma-Transaktionen und Unique-Indizes, Stripe bleibt ein Fake.
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.RESEARCH_TEST_DATABASE_URL
const skipDb = DATABASE_URL ? false : 'RESEARCH_TEST_DATABASE_URL is not set'
const RUN = randomUUID().replace(/-/g, '')
const dbUser = label => `user_it${label}${RUN}`
let db = null

async function realDb() {
  if (db) return db
  const { Pool } = require('pg')
  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 })
  db = { pool, prisma: new PrismaClient({ adapter: new PrismaPg(pool) }) }
  return db
}

after(async () => {
  if (!db) return
  try {
    await db.prisma.researchSubscription.deleteMany({ where: { userId: { endsWith: RUN } } })
    await db.prisma.researchConsentEvent.deleteMany({ where: { userId: { endsWith: RUN } } })
  } finally {
    await db.prisma.$disconnect()
    await db.pool.end()
  }
})

async function dbScenario(subscriptions) {
  const { prisma } = await realDb()
  const { stripe } = fakeStripe({ subscriptions })
  const telegram = []
  const consent = loadTs('./consent.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma, withPrismaRetry: operation => operation() },
    '@/lib/research/config.mjs': config,
  })
  const research = loadTs('./stripe.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma, withPrismaRetry: operation => operation() },
    '@/lib/research/access-rules.mjs': accessRules,
    '@/lib/research/config.mjs': config,
    '@/lib/research/subscription-sync.mjs': subscriptionSync,
    '@/lib/research/consent': consent,
    '@/lib/stripe': { stripe },
    '@/lib/telegram-notify': { async sendCortanaTelegram(text) { telegram.push(text) } },
  })
  return { research, prisma, telegram }
}

test('db: sync creates, updates and keeps the first past_due timestamp', { skip: skipDb }, async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const userId = dbUser('a')
    const sub = researchSubscription({ id: `sub_ita${RUN}`, metadata: { userId, product: 'research', tier: 'member', interval: 'month' } })
    const { research, prisma } = await dbScenario({ [sub.id]: sub })

    assert.deepEqual(await research.syncResearchSubscriptionById(sub.id), { action: 'upserted' })
    let row = await prisma.researchSubscription.findUnique({ where: { userId } })
    assert.equal(row.status, 'active')
    assert.equal(row.tier, 'member')
    assert.equal(row.billingInterval, 'month')
    assert.equal(row.stripeCustomerId, 'cus_research')
    assert.equal(row.pastDueSince, null)

    sub.status = 'past_due'
    await research.syncResearchSubscriptionById(sub.id)
    const firstPastDue = (await prisma.researchSubscription.findUnique({ where: { userId } })).pastDueSince
    assert.ok(firstPastDue instanceof Date)
    await new Promise(resolve => setTimeout(resolve, 5))
    await research.syncResearchSubscriptionById(sub.id)
    row = await prisma.researchSubscription.findUnique({ where: { userId } })
    assert.equal(row.pastDueSince.getTime(), firstPastDue.getTime())

    sub.status = 'active'
    await research.syncResearchSubscriptionById(sub.id)
    assert.equal((await prisma.researchSubscription.findUnique({ where: { userId } })).pastDueSince, null)
  })
})

test('db: stale old subscriptions and foreign subscription ids never overwrite a row', { skip: skipDb }, async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const userId = dbUser('b')
    const otherUser = dbUser('c')
    const live = researchSubscription({ id: `sub_itlive${RUN}`, metadata: { userId, product: 'research', tier: 'reader', interval: 'year' }, priceId: 'price_reader_y' })
    const stale = researchSubscription({
      id: `sub_itold${RUN}`,
      status: 'canceled',
      created: NOW_S - 400 * DAY_S,
      current_period_end: NOW_S - DAY_S,
      metadata: { userId, product: 'research', tier: 'reader', interval: 'year' },
    })
    // Dieselbe Subscription-ID, aber (manipuliert) einem anderen User zugeordnet.
    const hijack = { ...live, metadata: { userId: otherUser, product: 'research', tier: 'reader', interval: 'year' } }
    const { research, prisma } = await dbScenario({ [live.id]: live, [stale.id]: stale })

    await research.syncResearchSubscriptionById(live.id)
    // Das Event der alten Subscription frischt nur die gecachte (live) aus Stripe auf.
    assert.deepEqual(await research.syncResearchSubscriptionById(stale.id), { action: 'upserted', reason: 'existing_subscription_preferred' })

    const hijacker = await dbScenario({ [live.id]: hijack })
    assert.deepEqual(await hijacker.research.syncResearchSubscriptionById(live.id), { action: 'skipped', reason: 'subscription_owned_by_other_user' })

    const row = await prisma.researchSubscription.findUnique({ where: { userId } })
    assert.equal(row.stripeSubscriptionId, live.id)
    assert.equal(row.tier, 'reader')
    assert.equal(await prisma.researchSubscription.findUnique({ where: { userId: otherUser } }), null)
  })
})

test('db: parallel webhook deliveries for a new subscription produce exactly one row', { skip: skipDb }, async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const userId = dbUser('d')
    const sub = researchSubscription({ id: `sub_itpar${RUN}`, metadata: { userId, product: 'research', tier: 'supporter', interval: 'month' }, priceId: 'price_supporter_m' })
    const { research, prisma } = await dbScenario({ [sub.id]: sub })
    const results = await Promise.all(Array.from({ length: 6 }, () => research.syncResearchSubscriptionById(sub.id)))
    assert.ok(results.every(result => result.action === 'upserted'))
    assert.equal(await prisma.researchSubscription.count({ where: { userId } }), 1)
  })
})

test('db: after a double subscription, cancelling the cached one restores the remaining active one', { skip: skipDb }, async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const userId = dbUser('f')
    const metadata = { userId, product: 'research', tier: 'reader', interval: 'year' }
    const a = researchSubscription({ id: `sub_itfa${RUN}`, customer: `cus_itf${RUN}`, created: NOW_S - 200 * DAY_S, current_period_end: NOW_S + 165 * DAY_S, priceId: 'price_reader_y', metadata })
    const b = researchSubscription({ id: `sub_itfb${RUN}`, customer: `cus_itf${RUN}`, created: NOW_S - 60, metadata: { ...metadata, tier: 'member', interval: 'month' } })
    const { research, prisma, telegram } = await dbScenario({ [a.id]: a, [b.id]: b })

    await research.syncResearchSubscriptionById(a.id)
    await research.syncResearchSubscriptionById(b.id)
    assert.equal((await prisma.researchSubscription.findUnique({ where: { userId } })).stripeSubscriptionId, b.id)
    assert.equal(telegram.length, 1)

    b.status = 'canceled'
    assert.deepEqual(await research.syncResearchSubscriptionById(b.id), { action: 'upserted', reason: 'fallback_subscription' })
    const row = await prisma.researchSubscription.findUnique({ where: { userId } })
    assert.equal(row.stripeSubscriptionId, a.id)
    assert.equal(row.status, 'active')
    assert.equal(row.tier, 'reader')
    assert.equal(accessRules.computeResearchAccess(row, Date.now()).hasAccess, true)
    assert.equal(await prisma.researchSubscription.count({ where: { userId } }), 1)
  })
})

test('db: checkout completion records exactly one consent event, even when delivered twice', { skip: skipDb }, async t => {
  quietConsole(t)
  await withEnv({}, async () => {
    const userId = dbUser('e')
    const sub = researchSubscription({ id: `sub_itco${RUN}`, metadata: { userId, product: 'research', tier: 'member', interval: 'month' } })
    const { research, prisma, telegram } = await dbScenario({ [sub.id]: sub })
    const session = completedSession({
      subscription: sub.id,
      metadata: { userId, product: 'research', tier: 'member', interval: 'month', consentReference: `ref-${RUN}` },
    })
    await research.handleResearchCheckoutCompleted(session)
    await research.handleResearchCheckoutCompleted(session)

    const events = await prisma.researchConsentEvent.findMany({ where: { userId } })
    assert.equal(events.length, 1)
    assert.equal(events[0].kind, 'checkout_completed')
    assert.equal(events[0].reference, `ref-${RUN}`)
    assert.deepEqual(events[0].metadata, { sessionId: 'cs_test_done', subscriptionId: sub.id })
    assert.equal(telegram.length, 1)
    assert.equal((await prisma.researchSubscription.findUnique({ where: { userId } })).status, 'active')
  })
})
