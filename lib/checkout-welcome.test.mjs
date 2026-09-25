import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as guest from './checkout-guest.mjs'
import * as nonce from './checkout-nonce.mjs'

// /willkommen (lib/checkout-welcome.ts): wann wird ein Konto automatisch angemeldet, wann nicht.
// Stripe und die Freischaltung sind Attrappen.

const require = createRequire(import.meta.url)
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
const SESSION_ID = 'cs_test_welcome123456'
const COOKIE = nonce.createCheckoutNonce()

function session(overrides = {}) {
  return {
    id: SESSION_ID,
    mode: 'subscription',
    status: 'complete',
    created: Math.floor(Date.now() / 1000) - 120,
    amount_total: 15000,
    currency: 'eur',
    customer_details: { email: 'max@example.com' },
    metadata: { product: 'mentorship', flow: 'guest', nonce_hash: nonce.hashCheckoutNonce(COOKIE) },
    ...overrides,
  }
}

function load({ stripeSession = session(), record = {}, fulfillStatus = 'fulfilled', ticket = 'ticket_abc', purchaseClaim = true } = {}) {
  const calls = { fulfill: 0, tickets: 0, purchaseClaims: 0 }
  const fullRecord = { userId: 'user_new', createdNewUser: true, nonceHash: stripeSession.metadata?.nonce_hash ?? null, ticketIssuedAt: null, ...record }
  const welcome = loadTs('./checkout-welcome.ts', {
    'server-only': {},
    '@/lib/stripe': { stripe: { checkout: { sessions: { retrieve: async (id) => {
      assert.equal(id, SESSION_ID)
      return stripeSession
    } } } } },
    '@/lib/checkout-fulfillment': {
      fulfillCheckoutSession: async (id, options) => {
        calls.fulfill += 1
        assert.equal(options.session, stripeSession, 'reuses the fresh session')
        assert.equal(typeof options.defer, 'function')
        return fulfillStatus === 'fulfilled' ? { status: 'fulfilled', record: fullRecord } : { status: fulfillStatus }
      },
      issueSignInTicket: async () => {
        calls.tickets += 1
        return ticket
      },
      claimPurchaseTracking: async () => {
        calls.purchaseClaims += 1
        return purchaseClaim
      },
    },
    '@/lib/legal-texts': legal,
    '@/lib/checkout-guest.mjs': guest,
    '@/lib/checkout-nonce.mjs': nonce,
  })
  return { welcome, calls }
}

const run = (welcome, overrides = {}) =>
  welcome.resolveWelcome({ sessionId: SESSION_ID, cookieNonce: COOKIE, signedInUserId: null, defer: () => {}, ...overrides })

test('new account in the same browser right after paying: one-time ticket plus purchase event', async () => {
  const { welcome, calls } = load()
  const state = await run(welcome)
  assert.deepEqual(state, {
    kind: 'ticket',
    ticket: 'ticket_abc',
    purchase: { transactionId: SESSION_ID, value: 150, currency: 'EUR' },
    paymentPending: false,
  })
  assert.equal(calls.fulfill, 1)
  assert.equal(calls.tickets, 1)
})

test('no ticket without the nonce cookie (other browser, in-app browser, forwarded link)', async () => {
  for (const cookieNonce of [undefined, nonce.createCheckoutNonce()]) {
    const { welcome, calls } = load()
    const state = await run(welcome, { cookieNonce })
    assert.equal(state.kind, 'mail')
    assert.equal(state.reason, 'new-account')
    assert.equal(state.emailMasked, 'm••@example.com')
    assert.equal(calls.tickets, 0)
  }
})

test('existing accounts are never signed in automatically', async () => {
  const { welcome, calls } = load({ record: { userId: 'user_existing', createdNewUser: false } })
  const state = await run(welcome)
  assert.equal(state.kind, 'mail')
  assert.equal(state.reason, 'existing-account')
  assert.equal(calls.tickets, 0)
})

test('ticket only once: a reload after the ticket was issued shows the mail fallback', async () => {
  const { welcome, calls } = load({ record: { ticketIssuedAt: new Date() } })
  const state = await run(welcome)
  assert.equal(state.kind, 'mail')
  assert.equal(calls.tickets, 0)

  const raced = load({ ticket: null })
  const racedState = await run(raced.welcome)
  assert.equal(racedState.kind, 'mail', 'lost the race for the ticket')
})

test('sessions older than 60 minutes neither fulfil nor sign in', async () => {
  const { welcome, calls } = load({ stripeSession: session({ created: Math.floor(Date.now() / 1000) - 61 * 60 }) })
  const state = await run(welcome)
  assert.deepEqual(state, { kind: 'mail', reason: 'too-old', emailMasked: 'm••@example.com', purchase: null, paymentPending: false })
  assert.equal(calls.fulfill, 0)
})

test('the buyer is already signed in: redirect; someone else is signed in: no takeover', async () => {
  const same = load()
  assert.equal((await run(same.welcome, { signedInUserId: 'user_new' })).kind, 'redirect')
  assert.equal(same.calls.tickets, 0)

  const other = load()
  const state = await run(other.welcome, { signedInUserId: 'user_someone_else' })
  assert.equal(state.kind, 'mail')
  assert.equal(state.reason, 'other-account-signed-in')
  assert.equal(other.calls.tickets, 0)
})

test('purchase event only for the first view of the purchase', async () => {
  const { welcome } = load({ purchaseClaim: false })
  const state = await run(welcome)
  assert.equal(state.purchase, null)
})

test('invalid, foreign, unfinished and pending sessions', async () => {
  const invalid = load()
  assert.deepEqual(await run(invalid.welcome, { sessionId: 'nope' }), { kind: 'invalid' })

  const raidmap = load({ stripeSession: session({ metadata: { product: 'raidmap' } }) })
  assert.deepEqual(await run(raidmap.welcome), { kind: 'invalid' })

  const open = load({ stripeSession: session({ status: 'open' }) })
  assert.deepEqual(await run(open.welcome), { kind: 'not-complete' })
  assert.equal(open.calls.fulfill, 0)

  const pending = load({ fulfillStatus: 'pending' })
  assert.deepEqual(await run(pending.welcome), { kind: 'pending' })
})

test('SEPA and other delayed payments: the page does not claim the payment was received', async () => {
  const sepa = load({ stripeSession: session({ payment_status: 'unpaid' }) })
  const state = await run(sepa.welcome)
  assert.equal(state.kind, 'ticket')
  assert.equal(state.paymentPending, true)

  const card = load({ stripeSession: session({ payment_status: 'paid' }) })
  assert.equal((await run(card.welcome)).paymentPending, false)
})
