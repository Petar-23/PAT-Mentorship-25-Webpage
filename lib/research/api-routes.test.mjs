// POST /api/research/checkout und /api/research/portal: jeder Statuscode-Pfad
// und die Reihenfolge der Prüfungen (Origin → Login → Body → Rate-Limit → …).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

import * as config from './config.mjs'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiledModule, compiledModule.exports)
  return compiledModule.exports
}

// Echte Guards (Agent A) — die Routen sollen genau damit funktionieren.
const requestGuards = loadTs('./request-guards.ts')
const clerkClaims = loadTs('../clerk-claims.ts', { 'server-only': {} })
// Echte Fehlerklasse/Helfer aus lib/research/stripe.ts (Abhängigkeiten sind hier egal).
const researchStripe = loadTs('./stripe.ts', {
  'server-only': {},
  '@/lib/prisma': { prisma: {}, withPrismaRetry: fn => fn() },
  '@/lib/research/access-rules.mjs': {},
  '@/lib/research/config.mjs': config,
  '@/lib/research/consent': {},
  '@/lib/research/subscription-sync.mjs': {},
  '@/lib/stripe': { stripe: {} },
  '@/lib/telegram-notify': {},
})

const USER = 'user_2abcDEF123'
const HOST = 'research.example.test'
const ORIGIN = `https://${HOST}`
const VALID_BODY = { tier: 'member', interval: 'year', acceptTerms: true, waiveWithdrawal: true }

function setup(options = {}) {
  const {
    userId = USER,
    sessionClaims = { email: 'petar@example.com' },
    currentUser = null,
    authError = null,
    limited = false,
    hasAccess = false,
    testMode = false,
    basePath = '',
    checkoutError = null,
    portalError = null,
    consentsError = null,
    sessionCreatedError = null,
  } = options
  const calls = []
  const record = (name, ...args) => calls.push([name, ...args])

  const replacements = {
    '@clerk/nextjs/server': {
      async auth() {
        record('auth')
        if (authError) throw authError
        return { userId, sessionClaims }
      },
      async currentUser() {
        record('currentUser')
        return currentUser
      },
    },
    '@/lib/clerk-claims': clerkClaims,
    '@/lib/research/config.mjs': config,
    '@/lib/research/request-guards': requestGuards,
    '@/lib/research/access': {
      async getResearchAccessState(id) {
        record('getResearchAccessState', id)
        return { hasAccess, reason: hasAccess ? 'active' : 'none', source: 'subscription' }
      },
    },
    '@/lib/research/consent': {
      async recordCheckoutConsents(input) {
        record('recordCheckoutConsents', input)
        if (consentsError) throw consentsError
        return { termsId: 't1', withdrawalWaiverId: 'w1' }
      },
      async recordResearchConsent(input) {
        record('recordResearchConsent', input)
        if (sessionCreatedError) throw sessionCreatedError
        return { id: 'c1' }
      },
    },
    '@/lib/research/rate-limit': {
      async consumeResearchRateLimit(input) {
        record('consumeResearchRateLimit', input)
        return limited ? { limited: true, count: 11, retryAfterSeconds: 1234 } : { limited: false, count: 1, retryAfterSeconds: 3600 }
      },
    },
    '@/lib/research/request-context': {
      researchOriginFromRequest(request) {
        record('researchOriginFromRequest')
        return `https://${request.headers.get('host')}`
      },
      researchBasePathFromRequest() {
        record('researchBasePathFromRequest')
        return basePath
      },
    },
    '@/lib/research/stripe': {
      ...researchStripe,
      async createResearchCheckoutSession(input) {
        record('createResearchCheckoutSession', input)
        if (checkoutError) throw checkoutError
        return { url: 'https://checkout.stripe.com/c/pay/cs_test_1', sessionId: 'cs_test_1' }
      },
      async createResearchPortalSession(input) {
        record('createResearchPortalSession', input)
        if (portalError) throw portalError
        return { url: 'https://billing.stripe.com/p/session/test_1' }
      },
    },
    '@/lib/research/test-mode': {
      isResearchTestMode() {
        return testMode
      },
    },
  }

  const checkout = loadTs('../../app/api/research/checkout/route.ts', replacements)
  const portal = loadTs('../../app/api/research/portal/route.ts', replacements)
  return { checkout, portal, calls, names: () => calls.map(([name]) => name) }
}

function post(path, { body = VALID_BODY, headers = {}, rawBody } = {}) {
  return new Request(`http://internal.invalid${path}`, {
    method: 'POST',
    headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: rawBody ?? JSON.stringify(body),
  })
}

async function expectError(response, status, code) {
  assert.equal(response.status, status)
  const json = await response.json()
  assert.equal(json.code, code)
  assert.equal(typeof json.message, 'string')
  assert.ok(json.message.length > 0)
  return json
}

const quiet = t => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'log', () => {})
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

test('checkout route config: nodejs runtime, always dynamic', () => {
  const { checkout, portal } = setup()
  assert.equal(checkout.runtime, 'nodejs')
  assert.equal(checkout.dynamic, 'force-dynamic')
  assert.equal(portal.runtime, 'nodejs')
  assert.equal(portal.dynamic, 'force-dynamic')
})

test('checkout: cross-origin requests are rejected before auth (403 bad_origin)', async () => {
  for (const headers of [
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { origin: 'https://research.example.test.evil.example' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    const s = setup()
    await expectError(await s.checkout.POST(post('/api/research/checkout', { headers })), 403, 'bad_origin')
    assert.deepEqual(s.calls, [])
  }
  // Ohne Origin und Referer
  const s = setup()
  const request = new Request('http://internal.invalid/api/research/checkout', { method: 'POST', headers: { host: HOST }, body: '{}' })
  await expectError(await s.checkout.POST(request), 403, 'bad_origin')
  assert.deepEqual(s.calls, [])
})

test('checkout: signed-out users get 401 signed_out before the body is read', async () => {
  const s = setup({ userId: null })
  await expectError(await s.checkout.POST(post('/api/research/checkout', { rawBody: 'not json' })), 401, 'signed_out')
  assert.deepEqual(s.names(), ['auth'])
})

test('checkout: malformed bodies are 400 invalid_request', async () => {
  const bodies = [
    { rawBody: 'not json' },
    { rawBody: '' },
    { rawBody: JSON.stringify({ ...VALID_BODY, pad: 'x'.repeat(5000) }) },
    { body: null },
    { body: [] },
    { body: {} },
    { body: { ...VALID_BODY, tier: 'gold' } },
    { body: { ...VALID_BODY, interval: 'week' } },
    { body: { ...VALID_BODY, tier: undefined } },
    { body: { ...VALID_BODY, tier: 'gold', acceptTerms: false } },
  ]
  for (const options of bodies) {
    const s = setup()
    await expectError(await s.checkout.POST(post('/api/research/checkout', options)), 400, 'invalid_request')
    assert.deepEqual(s.names(), ['auth'], JSON.stringify(options).slice(0, 80))
  }
})

test('checkout: consents that are not literally true are 400 consent_required', async () => {
  for (const patch of [
    { acceptTerms: false },
    { waiveWithdrawal: false },
    { acceptTerms: 'true' },
    { waiveWithdrawal: 1 },
    { acceptTerms: undefined },
    { acceptTerms: undefined, waiveWithdrawal: undefined },
  ]) {
    const s = setup()
    await expectError(await s.checkout.POST(post('/api/research/checkout', { body: { ...VALID_BODY, ...patch } })), 400, 'consent_required')
    assert.deepEqual(s.names(), ['auth'], JSON.stringify(patch))
  }
})

test('checkout: rate limit is per user (10/h) and returns 429 with Retry-After', async () => {
  const s = setup({ limited: true })
  const response = await s.checkout.POST(post('/api/research/checkout'))
  await expectError(response, 429, 'rate_limited')
  assert.equal(response.headers.get('retry-after'), '1234')
  assert.deepEqual(s.calls[1], ['consumeResearchRateLimit', { key: `checkout:${USER}`, windowMs: 3_600_000, maxAttempts: 10 }])
  assert.deepEqual(s.names(), ['auth', 'consumeResearchRateLimit'])
})

test('checkout: accounts without email are 400 no_email', async () => {
  const s = setup({ sessionClaims: {}, currentUser: { primaryEmailAddress: null, emailAddresses: [], primaryEmailAddressId: null } })
  await expectError(await s.checkout.POST(post('/api/research/checkout')), 400, 'no_email')
  assert.equal(s.names().includes('recordCheckoutConsents'), false)
  assert.equal(s.names().includes('createResearchCheckoutSession'), false)

  const signedOutMidway = setup({ sessionClaims: {}, currentUser: null })
  await expectError(await signedOutMidway.checkout.POST(post('/api/research/checkout')), 400, 'no_email')
})

test('checkout: members are 409 already_subscribed and nothing is recorded', async () => {
  const s = setup({ hasAccess: true })
  await expectError(await s.checkout.POST(post('/api/research/checkout')), 409, 'already_subscribed')
  assert.deepEqual(s.names(), ['auth', 'consumeResearchRateLimit', 'researchBasePathFromRequest', 'getResearchAccessState'])
})

test('checkout: happy path records consents, creates the session and links it', async () => {
  const s = setup()
  const response = await s.checkout.POST(post('/api/research/checkout'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' })

  assert.deepEqual(s.names(), [
    'auth',
    'consumeResearchRateLimit',
    'researchBasePathFromRequest',
    'getResearchAccessState',
    'recordCheckoutConsents',
    'researchOriginFromRequest',
    'createResearchCheckoutSession',
    'recordResearchConsent',
  ])
  const consents = s.calls.find(([name]) => name === 'recordCheckoutConsents')[1]
  const session = s.calls.find(([name]) => name === 'createResearchCheckoutSession')[1]
  const created = s.calls.find(([name]) => name === 'recordResearchConsent')[1]
  assert.match(consents.reference, /^[0-9a-f-]{36}$/)
  assert.deepEqual(consents, { userId: USER, reference: consents.reference, tier: 'member', interval: 'year' })
  assert.deepEqual(session, {
    userId: USER,
    email: 'petar@example.com',
    tier: 'member',
    interval: 'year',
    consentReference: consents.reference,
    successUrl: `${ORIGIN}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${ORIGIN}/pricing?checkout=cancelled`,
  })
  assert.deepEqual(created, {
    userId: USER,
    kind: 'checkout_session_created',
    reference: consents.reference,
    metadata: { sessionId: 'cs_test_1', tier: 'member', interval: 'year' },
  })

  // Jede Anfrage bekommt eine eigene Referenz.
  const again = setup()
  await again.checkout.POST(post('/api/research/checkout'))
  assert.notEqual(again.calls.find(([name]) => name === 'recordCheckoutConsents')[1].reference, consents.reference)
})

test('checkout: path mode prefixes the return urls; email falls back to currentUser', async () => {
  const s = setup({
    basePath: '/research',
    sessionClaims: {},
    currentUser: { primaryEmailAddress: { emailAddress: 'fallback@example.com' }, emailAddresses: [], primaryEmailAddressId: null },
  })
  assert.equal((await s.checkout.POST(post('/api/research/checkout'))).status, 200)
  const session = s.calls.find(([name]) => name === 'createResearchCheckoutSession')[1]
  assert.equal(session.email, 'fallback@example.com')
  assert.equal(session.successUrl, `${ORIGIN}/research/welcome?session_id={CHECKOUT_SESSION_ID}`)
  assert.equal(session.cancelUrl, `${ORIGIN}/research/pricing?checkout=cancelled`)
})

test('checkout: failures are 500 checkout_failed and logged without the email address', async t => {
  const errorLog = t.mock.method(console, 'error', () => {})
  for (const options of [
    { checkoutError: new Error('Stripe exploded for petar@example.com') },
    { checkoutError: new researchStripe.ResearchStripeError('missing_price') },
    { consentsError: new Error('db down') },
    { authError: new Error('clerk down') },
  ]) {
    const s = setup(options)
    await expectError(await s.checkout.POST(post('/api/research/checkout')), 500, 'checkout_failed')
    if (options.consentsError) assert.equal(s.names().includes('createResearchCheckoutSession'), false)
  }
  assert.doesNotMatch(JSON.stringify(errorLog.mock.calls.map(call => call.arguments)), /petar@example\.com/)
})

test('checkout: an open subscription found in Stripe (not yet in the cache) is 409 already_subscribed, not a failure', async t => {
  const errorLog = t.mock.method(console, 'error', () => {})
  const cases = [
    ['active', /already have an active/],
    ['past_due', /update your payment method/],
    ['unpaid', /update your payment method/],
    ['incomplete', /update your payment method/],
  ]
  for (const [subscriptionStatus, message] of cases) {
    const s = setup({
      checkoutError: new researchStripe.ResearchStripeError('already_subscribed', 'open subscription', { subscriptionStatus }),
    })
    const json = await expectError(await s.checkout.POST(post('/api/research/checkout')), 409, 'already_subscribed')
    assert.match(json.message, message, subscriptionStatus)
    assert.equal(s.names().includes('recordResearchConsent'), false)
  }
  assert.equal(errorLog.mock.callCount(), 0)
})

test('checkout: a failed session link record does not block the purchase', async t => {
  quiet(t)
  const s = setup({ sessionCreatedError: new Error('db hiccup') })
  const response = await s.checkout.POST(post('/api/research/checkout'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
})

test('checkout test mode: same validation, no Stripe, no consent records', async () => {
  const s = setup({ testMode: true, basePath: '/research' })
  const response = await s.checkout.POST(post('/api/research/checkout'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { url: '/research/welcome?test=1' })
  assert.deepEqual(s.names(), ['auth', 'consumeResearchRateLimit', 'researchBasePathFromRequest', 'getResearchAccessState'])

  const member = setup({ testMode: true, hasAccess: true })
  await expectError(await member.checkout.POST(post('/api/research/checkout')), 409, 'already_subscribed')

  const noConsent = setup({ testMode: true })
  await expectError(await noConsent.checkout.POST(post('/api/research/checkout', { body: { ...VALID_BODY, acceptTerms: false } })), 400, 'consent_required')

  const foreign = setup({ testMode: true })
  await expectError(await foreign.checkout.POST(post('/api/research/checkout', { headers: { origin: 'https://evil.example' } })), 403, 'bad_origin')
})

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

test('portal: cross-origin 403, signed-out 401', async () => {
  const foreign = setup()
  await expectError(await foreign.portal.POST(post('/api/research/portal', { headers: { origin: 'https://evil.example' } })), 403, 'bad_origin')
  assert.deepEqual(foreign.calls, [])

  const signedOut = setup({ userId: null })
  await expectError(await signedOut.portal.POST(post('/api/research/portal')), 401, 'signed_out')
  assert.deepEqual(signedOut.names(), ['auth'])
})

test('portal: rate limit is per user (20/h) with Retry-After', async () => {
  const s = setup({ limited: true })
  const response = await s.portal.POST(post('/api/research/portal'))
  await expectError(response, 429, 'rate_limited')
  assert.equal(response.headers.get('retry-after'), '1234')
  assert.deepEqual(s.calls[1], ['consumeResearchRateLimit', { key: `portal:${USER}`, windowMs: 3_600_000, maxAttempts: 20 }])
  assert.equal(s.names().includes('createResearchPortalSession'), false)
})

test('portal: happy path returns the Stripe url with the account return url', async () => {
  for (const basePath of ['', '/research']) {
    const s = setup({ basePath })
    const response = await s.portal.POST(post('/api/research/portal', { rawBody: '' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { url: 'https://billing.stripe.com/p/session/test_1' })
    assert.deepEqual(s.calls.find(([name]) => name === 'createResearchPortalSession')[1], {
      userId: USER,
      returnUrl: `${ORIGIN}${basePath}/account`,
    })
  }
})

test('portal: no_customer is 404, everything else 500 portal_failed', async t => {
  quiet(t)
  const none = setup({ portalError: new researchStripe.ResearchStripeError('no_customer') })
  await expectError(await none.portal.POST(post('/api/research/portal')), 404, 'no_customer')

  for (const portalError of [new Error('Stripe down'), new researchStripe.ResearchStripeError('not_configured')]) {
    const s = setup({ portalError })
    await expectError(await s.portal.POST(post('/api/research/portal')), 500, 'portal_failed')
  }
  const clerkDown = setup({ authError: new Error('clerk down') })
  await expectError(await clerkDown.portal.POST(post('/api/research/portal')), 500, 'portal_failed')
})
