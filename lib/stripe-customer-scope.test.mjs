import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as scope from './stripe-customer-scope.mjs'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiled, compiled.exports)
  return compiled.exports
}

const { PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS, isProductScopedCustomer, selectEmailFallbackCustomer } = scope
const USER = 'user_1'
const EMAIL = 'max@example.com'
const USER_ID_QUERY = `metadata['userId']:'${USER}'`
const EMAIL_QUERY = `email:'${EMAIL}'`
const FUTURE = Math.floor(Date.now() / 1000) + 30 * 24 * 3600

const mentorship = (id, created, metadata = { userId: USER }) => ({ id, object: 'customer', created, email: EMAIL, metadata })
const legacy = (id, created, metadata = {}) => ({ id, object: 'customer', created, email: EMAIL, metadata })
const raidmap = (id, created) => ({ id, object: 'customer', created, email: EMAIL, metadata: { raidmapUserId: USER } })
const research = (id, created) => ({ id, object: 'customer', created, email: EMAIL, metadata: { researchUserId: USER } })
const deleted = (id, created) => ({ id, object: 'customer', created, deleted: true, metadata: {} })
const activeSub = (customer, price = 'price_mentorship') => ({
  id: `sub_${customer}`, customer, status: 'active', created: 1, cancel_at_period_end: false, cancel_at: null,
  current_period_end: FUTURE, items: { data: [{ price: { id: price } }] },
})

function fakeStripe({ byUserId = [], byEmail = [], subscriptions = [] } = {}) {
  const calls = { searches: [], updates: [], subscriptionLists: [], portals: [], checkouts: [], created: [] }
  const stripe = {
    customers: {
      search: async ({ query }) => { calls.searches.push(query); return { object: 'search_result', has_more: false, data: query.startsWith('email:') ? byEmail : byUserId } },
      update: async (id, params) => { calls.updates.push({ id, params }); return { id } },
      create: async params => { calls.created.push(params); return { id: 'cus_new', created: 999, metadata: params.metadata } },
    },
    subscriptions: { list: async params => { calls.subscriptionLists.push(params); return { data: subscriptions.filter(s => s.customer === params.customer) } } },
    billingPortal: { sessions: { create: async params => { calls.portals.push(params); return { url: `https://portal.test/${params.customer}` } } } },
    checkout: { sessions: { create: async params => { calls.checkouts.push(params); return { url: 'https://checkout.test' } } } },
  }
  return { stripe, calls }
}

function loadStripeLib(stripe, { dbRow = null } = {}) {
  globalThis.stripeClient = stripe
  const dbWrites = []
  const prisma = {
    payPalSubscriber: { findUnique: async () => null },
    userSubscription: { findUnique: async () => dbRow, upsert: async args => { dbWrites.push(args); return {} } },
  }
  const lib = loadTs('./stripe.ts', {
    'server-only': {}, stripe: {},
    './prisma': { prisma, withPrismaRetry: fn => fn() },
    './pat-source': { mentorshipSourceCustomFields: () => [] },
    './raidmap-config': { RAIDMAP_CONFIG: {} },
    './stripe-customer-scope.mjs': scope,
  })
  return { lib, dbWrites }
}

const previousEnv = { STRIPE_ACCESS_PRICE_IDS: process.env.STRIPE_ACCESS_PRICE_IDS, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL, STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID }
test.beforeEach(t => {
  process.env.STRIPE_ACCESS_PRICE_IDS = 'price_mentorship'
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
  process.env.STRIPE_PRICE_ID = 'price_mentorship'
  t.mock.method(console, 'error', () => {})
})
test.afterEach(() => {
  delete globalThis.stripeClient
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

// --- Pure Helper -------------------------------------------------------------------------------

test('product-scoped keys cover Raid Map and Research, and only non-empty strings count', () => {
  assert.deepEqual([...PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS], ['raidmapUserId', 'researchUserId'])
  assert.equal(isProductScopedCustomer(raidmap('cus_r', 1)), true)
  assert.equal(isProductScopedCustomer(research('cus_s', 1)), true)
  assert.equal(isProductScopedCustomer(mentorship('cus_m', 1)), false)
  assert.equal(isProductScopedCustomer(legacy('cus_l', 1, { raidmapUserId: '' })), false)
  assert.equal(isProductScopedCustomer({ metadata: null }), false)
  assert.equal(isProductScopedCustomer(null), false)
})

test('email fallback selection skips deleted, Raid Map and Research customers and otherwise picks the newest', () => {
  assert.equal(selectEmailFallbackCustomer([]), null)
  assert.equal(selectEmailFallbackCustomer([raidmap('cus_r', 3), research('cus_s', 2), deleted('cus_d', 4)]), null)
  assert.equal(selectEmailFallbackCustomer([legacy('cus_old', 1), raidmap('cus_r', 9), research('cus_s', 8), deleted('cus_d', 10)]).id, 'cus_old')
  const input = [legacy('cus_a', 1), legacy('cus_b', 3), legacy('cus_c', 2)]
  assert.equal(selectEmailFallbackCustomer(input).id, 'cus_b')
  assert.deepEqual(input.map(c => c.id), ['cus_a', 'cus_b', 'cus_c'], 'input order is not mutated')
})

test('for lists without product-scoped customers the pick is identical to the previous inline logic (incl. ties)', () => {
  const previousPick = customers => customers.filter(c => !('deleted' in c && c.deleted)).sort((a, b) => b.created - a.created)[0] ?? null
  const lists = [
    [legacy('cus_a', 5), legacy('cus_b', 5), legacy('cus_c', 1)],
    [deleted('cus_d', 9), mentorship('cus_m', 2), legacy('cus_l', 7)],
    [legacy('cus_x', 1)],
    [deleted('cus_only', 1)],
  ]
  for (const list of lists) assert.equal(selectEmailFallbackCustomer(list), previousPick(list))
})

// --- getSubscriptionSnapshot ------------------------------------------------------------------

test('snapshot: an existing mentorship customer found via metadata.userId is used unchanged', async () => {
  const { stripe, calls } = fakeStripe({ byUserId: [mentorship('cus_m', 5)], byEmail: [raidmap('cus_r', 9)], subscriptions: [activeSub('cus_m')] })
  const { lib, dbWrites } = loadStripeLib(stripe)
  const snapshot = await lib.getSubscriptionSnapshot(USER, { email: EMAIL })
  assert.equal(snapshot.hasActiveSubscription, true)
  assert.deepEqual(calls.searches, [USER_ID_QUERY])
  assert.deepEqual(calls.updates, [])
  assert.equal(calls.subscriptionLists[0].customer, 'cus_m')
  assert.equal(dbWrites[0].create.stripeCustomerId, 'cus_m')
})

test('snapshot: a Raid Map customer with the same email is never linked and yields no subscription', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [raidmap('cus_r', 9)], subscriptions: [activeSub('cus_r', 'price_raidmap')] })
  const { lib, dbWrites } = loadStripeLib(stripe)
  const snapshot = await lib.getSubscriptionSnapshot(USER, { email: EMAIL })
  assert.deepEqual(snapshot, { hasActiveSubscription: false, subscriptionDetails: null })
  assert.deepEqual(calls.searches, [USER_ID_QUERY, EMAIL_QUERY])
  assert.deepEqual(calls.updates, [])
  assert.deepEqual(calls.subscriptionLists, [])
  assert.equal(dbWrites[0].create.stripeCustomerId, null)
  assert.equal(dbWrites[0].create.status, 'none')
})

test('snapshot: a legacy mentorship customer wins over a newer Raid Map or Research customer with the same email', async () => {
  const { stripe, calls } = fakeStripe({
    byEmail: [raidmap('cus_r', 30), legacy('cus_legacy', 10, { discordUserId: 'd1' }), research('cus_s', 20), deleted('cus_d', 40)],
    subscriptions: [activeSub('cus_legacy'), activeSub('cus_r', 'price_raidmap')],
  })
  const { lib, dbWrites } = loadStripeLib(stripe)
  const snapshot = await lib.getSubscriptionSnapshot(USER, { email: EMAIL })
  assert.equal(snapshot.hasActiveSubscription, true)
  assert.deepEqual(calls.updates, [{ id: 'cus_legacy', params: { metadata: { discordUserId: 'd1', userId: USER } } }])
  assert.equal(calls.subscriptionLists[0].customer, 'cus_legacy')
  assert.equal(dbWrites[0].create.stripeCustomerId, 'cus_legacy')
})

test('snapshot: with several eligible email customers the newest still wins (unchanged)', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [legacy('cus_old', 1), legacy('cus_new', 5), legacy('cus_mid', 3)], subscriptions: [activeSub('cus_new')] })
  const { lib } = loadStripeLib(stripe)
  await lib.getSubscriptionSnapshot(USER, { email: EMAIL })
  assert.deepEqual(calls.updates.map(u => u.id), ['cus_new'])
  assert.equal(calls.subscriptionLists[0].customer, 'cus_new')
})

test('snapshot: a product-scoped customer returned by metadata.userId only warns (id, no email) and is still used', async t => {
  const warn = t.mock.method(console, 'warn', () => {})
  const misassigned = { ...raidmap('cus_bad', 5), metadata: { raidmapUserId: USER, userId: USER } }
  const { stripe, calls } = fakeStripe({ byUserId: [misassigned], subscriptions: [activeSub('cus_bad', 'price_raidmap')] })
  const { lib, dbWrites } = loadStripeLib(stripe)
  await lib.getSubscriptionSnapshot(USER, { email: EMAIL })
  assert.equal(warn.mock.callCount(), 1)
  const message = warn.mock.calls[0].arguments.join(' ')
  assert.match(message, /cus_bad/)
  assert.doesNotMatch(message, /@/)
  assert.deepEqual(calls.updates, [])
  assert.equal(calls.subscriptionLists[0].customer, 'cus_bad')
  assert.equal(dbWrites[0].create.stripeCustomerId, 'cus_bad')
})

// --- createCustomerPortalSession --------------------------------------------------------------

test('portal: the DB mapping and metadata.userId paths are unchanged and never search by email', async () => {
  const fromDb = fakeStripe({ byEmail: [raidmap('cus_r', 9)] })
  const db = loadStripeLib(fromDb.stripe, { dbRow: { stripeCustomerId: 'cus_db' } })
  assert.deepEqual(await db.lib.createCustomerPortalSession(USER, EMAIL), { url: 'https://portal.test/cus_db' })
  assert.deepEqual(fromDb.calls.searches, [])

  const byMeta = fakeStripe({ byUserId: [mentorship('cus_m1', 1), mentorship('cus_m2', 2)], byEmail: [raidmap('cus_r', 9)] })
  const meta = loadStripeLib(byMeta.stripe)
  assert.deepEqual(await meta.lib.createCustomerPortalSession(USER, EMAIL), { url: 'https://portal.test/cus_m2' })
  assert.deepEqual(byMeta.calls.searches, [USER_ID_QUERY])
  assert.deepEqual(byMeta.calls.updates, [])
})

test('portal: only a Raid Map customer with the same email still throws "No customer found" and is not linked', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [raidmap('cus_r', 9), research('cus_s', 8)] })
  const { lib } = loadStripeLib(stripe)
  await assert.rejects(lib.createCustomerPortalSession(USER, EMAIL), /No customer found/)
  assert.deepEqual(calls.updates, [])
  assert.deepEqual(calls.portals, [])
})

test('portal: a legacy mentorship customer is opened and linked even if a Raid Map customer is newer', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [raidmap('cus_r', 9), deleted('cus_d', 10), legacy('cus_legacy', 2)] })
  const { lib } = loadStripeLib(stripe)
  assert.deepEqual(await lib.createCustomerPortalSession(USER, EMAIL), { url: 'https://portal.test/cus_legacy' })
  assert.deepEqual(calls.updates, [{ id: 'cus_legacy', params: { metadata: { userId: USER } } }])
})

// --- createCheckoutSession --------------------------------------------------------------------

test('checkout: metadata.userId selection is unchanged; a product-scoped hit only warns', async t => {
  const warn = t.mock.method(console, 'warn', () => {})
  const misassigned = { ...raidmap('cus_bad', 9), metadata: { raidmapUserId: USER, userId: USER } }
  const { stripe, calls } = fakeStripe({ byUserId: [mentorship('cus_m', 1), misassigned] })
  const { lib } = loadStripeLib(stripe)
  await lib.createCheckoutSession(USER, EMAIL)
  assert.equal(calls.checkouts[0].customer, 'cus_bad')
  assert.deepEqual(calls.created, [])
  assert.equal(warn.mock.callCount(), 1)
  assert.match(warn.mock.calls[0].arguments.join(' '), /cus_bad/)
})

// --- Discord OAuth callback -------------------------------------------------------------------

function discordCallback(stripe) {
  const route = loadTs('../app/api/discord/oauth/callback/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: USER, sessionClaims: {} }), clerkClient: async () => ({ users: { getUser: async () => ({ emailAddresses: [] }) } }) },
    'next/headers': { cookies: async () => ({ get: name => ({ discord_oauth_state: { value: 'state-1' }, discord_oauth_uid: { value: USER } })[name] }) },
    'next/server': { NextResponse: { redirect: url => ({ location: new URL(url), cookies: { delete() {} } }) } },
    '@/lib/stripe': { stripe, hasActiveSubscription: async () => false },
    '@/lib/prisma': { prisma: { userSubscription: { findUnique: async () => null }, payPalSubscriber: { findUnique: async () => null } } },
    '@/lib/clerk-claims': { getEmailFromSessionClaims: () => EMAIL },
    '@/lib/discord': {
      exchangeDiscordCodeForToken: async () => ({ access_token: 'token' }), fetchDiscordUser: async () => ({ id: 'discord_1' }),
      addDiscordMemberToGuild: async () => {}, addRoleToGuildMember: async () => {},
    },
    '@/lib/stripe-customer-scope.mjs': scope,
  })
  return route.GET(new Request('http://localhost/api/discord/oauth/callback?code=c&state=state-1'))
}

test('discord callback: a Raid Map customer with the same email is neither linked nor tagged with discordUserId', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [raidmap('cus_r', 9)] })
  const response = await discordCallback(stripe)
  assert.equal(response.location.searchParams.get('reason'), 'no_stripe_customer')
  assert.deepEqual(calls.searches, [USER_ID_QUERY, EMAIL_QUERY])
  assert.deepEqual(calls.updates, [])
})

test('discord callback: a legacy mentorship customer is linked by email even if a Raid Map customer is newer', async () => {
  const { stripe, calls } = fakeStripe({ byEmail: [raidmap('cus_r', 9), legacy('cus_legacy', 2)] })
  const response = await discordCallback(stripe)
  assert.equal(response.location.searchParams.get('note'), 'subscription_required')
  assert.deepEqual(calls.updates, [
    { id: 'cus_legacy', params: { metadata: { userId: USER } } },
    { id: 'cus_legacy', params: { metadata: { discordUserId: 'discord_1' } } },
  ])
})
