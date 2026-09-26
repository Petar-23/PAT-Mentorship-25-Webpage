import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as guest from './checkout-guest.mjs'
import * as nonce from './checkout-nonce.mjs'
import * as vertrag from './vertrag-erklaerung.mjs'

// POST /api/checkout/start mit Attrappen für Clerk und Stripe: Zustimmung wird serverseitig erzwungen,
// Mitglieder kommen nie zu Stripe, der Schalter aus führt auf den alten Weg.

const require = createRequire(import.meta.url)
const nextServer = require('next/server')

function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)((id) => (id in replacements ? replacements[id] : require(id)), compiled, compiled.exports)
  return compiled.exports
}

const legal = loadTs('./legal-texts.ts')

function loadRoute({ enabled = true, userId = null, member = false, blocking = null, stripeError = null } = {}) {
  const calls = { sessions: [], customers: [] }
  const stripe = {
    checkout: {
      sessions: {
        create: async (params) => {
          calls.sessions.push(params)
          if (stripeError && calls.sessions.length === 1) throw stripeError
          return { id: 'cs_test_new', url: 'https://checkout.stripe.test/c/pay/cs_test_new' }
        },
      },
    },
  }
  const route = loadTs('../app/api/checkout/start/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId, sessionClaims: userId ? { email: 'Max@Example.com' } : null }) },
    'next/server': nextServer,
    '@/lib/stripe': {
      stripe,
      findBlockingMentorshipSubscription: async () => blocking,
      getOrCreateMentorshipCustomer: async (id, email, context) => {
        calls.customers.push({ id, email, context })
        return { id: 'cus_existing' }
      },
    },
    '@/lib/checkout-access': {
      resolveSignedInEmail: async (claims) => claims?.email?.toLowerCase() ?? null,
      hasRunningMembership: async () => member,
    },
    '@/lib/checkout-mode': {
      isGuestCheckoutEnabled: () => enabled,
      isStripeTosConsentEnabled: () => false,
      legacyEntryPath: (signedIn) => (signedIn ? '/dashboard' : '/sign-in?redirect_url=%2Fdashboard'),
    },
    '@/lib/pat-source': { mentorshipSourceCustomFields: (options) => [{ key: 'pat_source', optional: Boolean(options?.optional) }] },
    '@/lib/legal-texts': legal,
    '@/lib/checkout-guest.mjs': guest,
    '@/lib/checkout-nonce.mjs': nonce,
    '@/lib/vertrag-erklaerung.mjs': vertrag,
    '@/lib/vertrag-request': { getClientIp: () => '203.0.113.7', isSameOriginRequest: () => true },
  })
  return { route, calls }
}

function post(fields) {
  return new Request('https://www.price-action-trader.de/api/checkout/start', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://www.price-action-trader.de' },
    body: new URLSearchParams(fields).toString(),
  })
}

const previousEnv = { STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID, CHECKOUT_SUBMIT_TYPE: process.env.CHECKOUT_SUBMIT_TYPE }
test.beforeEach((t) => {
  process.env.STRIPE_PRICE_ID = 'price_mentorship'
  delete process.env.CHECKOUT_SUBMIT_TYPE
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})
})
test.afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test('without the early-start consent no Stripe session is created (server-side check)', async () => {
  const { route, calls } = loadRoute()
  const response = await route.POST(post({ src: 'hero_cta' }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), '/checkout?fehler=zustimmung&src=hero_cta')
  assert.equal(calls.sessions.length, 0)
  assert.equal(response.headers.get('set-cookie'), null)
})

test('guest with consent: 303 to Stripe, consent and nonce hash in metadata, HttpOnly nonce cookie', async () => {
  const { route, calls } = loadRoute()
  const before = Date.now()
  const response = await route.POST(post({ consent_early_start: '1', src: 'pricing_cta' }))

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://checkout.stripe.test/c/pay/cs_test_new')
  assert.equal(calls.sessions.length, 1)
  const params = calls.sessions[0]
  assert.equal('payment_method_types' in params, false)
  assert.equal('customer' in params, false)
  assert.equal('submit_type' in params, false, 'default "pay" is not accepted in subscription mode')
  assert.equal(params.metadata.flow, 'guest')
  assert.equal(params.metadata.src, 'pricing_cta')
  assert.equal(params.metadata.consent_early_start, 'true')
  assert.equal(params.metadata.terms_version, legal.CHECKOUT_TERMS_VERSION)
  assert.ok(Date.parse(params.metadata.consent_at) >= before - 1000)
  assert.deepEqual(params.custom_fields, [{ key: 'pat_source', optional: true }])
  assert.equal(params.success_url, 'https://www.price-action-trader.de/willkommen?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(params.custom_text.submit.message, legal.checkoutSubmitMessage())

  const cookie = response.headers.get('set-cookie')
  const value = cookie.match(/^pat_co=([^;]+)/)[1]
  assert.equal(nonce.nonceMatchesHash(value, params.metadata.nonce_hash), true, 'cookie nonce matches the stored hash')
  assert.notEqual(value, params.metadata.nonce_hash)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=lax/i)
  assert.match(cookie, /Path=\/willkommen/)
  assert.match(cookie, /Max-Age=7200/)
})

test('switch off: the old account path stays in place', async () => {
  const guestCall = loadRoute({ enabled: false })
  const response = await guestCall.route.POST(post({ consent_early_start: '1' }))
  assert.equal(response.headers.get('location'), '/sign-in?redirect_url=%2Fdashboard')
  assert.equal(guestCall.calls.sessions.length, 0)

  const member = loadRoute({ enabled: false, userId: 'user_1' })
  const memberResponse = await member.route.POST(post({ consent_early_start: '1' }))
  assert.equal(memberResponse.headers.get('location'), '/dashboard')
})

test('signed-in members and open subscriptions go to the dashboard, never to Stripe', async () => {
  for (const options of [{ member: true }, { blocking: { id: 'sub_1', status: 'past_due' } }]) {
    const { route, calls } = loadRoute({ userId: 'user_1', ...options })
    const response = await route.POST(post({ consent_early_start: '1' }))
    assert.equal(response.headers.get('location'), '/dashboard')
    assert.equal(calls.sessions.length, 0)
  }
})

test('signed-in buyer without subscription: account flow with the existing customer', async () => {
  const { route, calls } = loadRoute({ userId: 'user_1' })
  await route.POST(post({ consent_early_start: '1' }))
  assert.deepEqual(calls.customers, [{ id: 'user_1', email: 'max@example.com', context: 'checkoutStart' }])
  const params = calls.sessions[0]
  assert.equal(params.customer, 'cus_existing')
  assert.equal(params.metadata.flow, 'account')
  assert.equal(params.metadata.userId, 'user_1')
})

test('configured submit_type is sent; if Stripe rejects it, the session is created without it', async () => {
  process.env.CHECKOUT_SUBMIT_TYPE = 'subscribe'
  const ok = loadRoute()
  await ok.route.POST(post({ consent_early_start: '1' }))
  assert.equal(ok.calls.sessions[0].submit_type, 'subscribe')

  const rejecting = loadRoute({ stripeError: new Error("You can not pass `submit_type: 'subscribe'` in `subscription` mode.") })
  const response = await rejecting.route.POST(post({ consent_early_start: '1' }))
  assert.equal(rejecting.calls.sessions.length, 2)
  assert.equal('submit_type' in rejecting.calls.sessions[1], false)
  assert.equal(response.headers.get('location'), 'https://checkout.stripe.test/c/pay/cs_test_new')
})

test('Stripe errors lead back to /checkout with a message, GET never creates a session', async () => {
  const { route, calls } = loadRoute({ stripeError: new Error('Stripe down') })
  const response = await route.POST(post({ consent_early_start: '1', src: 'hero_cta' }))
  assert.equal(response.headers.get('location'), '/checkout?fehler=stripe&src=hero_cta')
  assert.equal(calls.sessions.length, 1)

  const get = await route.GET()
  assert.equal(get.status, 303)
  assert.equal(get.headers.get('location'), '/checkout')
})

test('success and cancel URLs use the host the browser used (forwarded host behind a proxy)', async () => {
  const { route, calls } = loadRoute()
  const request = new Request('http://internal:3000/api/checkout/start', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-host': 'www.price-action-trader.de',
      'x-forwarded-proto': 'https',
    },
    body: new URLSearchParams({ consent_early_start: '1' }).toString(),
  })
  const response = await route.POST(request)
  assert.equal(calls.sessions[0].success_url, 'https://www.price-action-trader.de/willkommen?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(calls.sessions[0].cancel_url, 'https://www.price-action-trader.de/checkout?abgebrochen=1')
  assert.match(response.headers.get('set-cookie'), /Secure/i)

  const spoofed = loadRoute()
  await spoofed.route.POST(new Request('https://www.price-action-trader.de/api/checkout/start', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-host': 'evil.example/path?x=' },
    body: new URLSearchParams({ consent_early_start: '1' }).toString(),
  }))
  assert.match(spoofed.calls.sessions[0].success_url, /^https:\/\/www\.price-action-trader\.de\/willkommen/)
})
