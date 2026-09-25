import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import {
  AUTO_SIGN_IN_WINDOW_MS,
  CHECKOUT_NONCE_COOKIE,
  CHECKOUT_NONCE_MAX_AGE_SECONDS,
  SUBSCRIPTION_MODE_SUBMIT_TYPES,
  buildCheckoutSessionParams,
  checkFulfillable,
  decideAccount,
  decideAutoSignIn,
  findDuplicateSubscription,
  isCheckoutSessionId,
  isWithinWindow,
  maskEmail,
  parseEnvFlag,
  parseStartForm,
  readCheckoutMetadata,
  resolveSubmitType,
  sanitizeSource,
} from './checkout-guest.mjs'
import { createCheckoutNonce, hashCheckoutNonce, nonceMatchesHash } from './checkout-nonce.mjs'

// Gast-Checkout (lib/checkout-guest.mjs, lib/checkout-nonce.mjs): reine Regeln, keine Netzaufrufe.

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const legalSource = ts.transpileModule(await read('./legal-texts.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const legal = await import(`data:text/javascript;base64,${Buffer.from(legalSource).toString('base64')}`)

const DASHES = /[–—]/
const NOW = Date.parse('2026-09-25T12:00:00Z')

function baseParams(overrides = {}) {
  return {
    origin: 'https://www.price-action-trader.de',
    priceId: 'price_mentorship',
    flow: 'guest',
    src: 'hero_cta',
    consentAt: '2026-09-25T12:00:00.000Z',
    termsVersion: legal.CHECKOUT_TERMS_VERSION,
    nonceHash: 'a'.repeat(64),
    submitMessage: legal.checkoutSubmitMessage(),
    ...overrides,
  }
}

// --- Schalter und Formular ------------------------------------------------------------------------

test('the switch is off unless explicitly enabled', () => {
  for (const value of [undefined, null, '', 'false', '0', 'no', 'off', 'aus', ' TRUE? ']) {
    assert.equal(parseEnvFlag(value), false, String(value))
  }
  for (const value of ['true', 'TRUE', ' 1 ', 'yes', 'on', 'ja']) assert.equal(parseEnvFlag(value), true, value)
})

test('the click source is a short harmless id, otherwise "direct"', () => {
  assert.equal(sanitizeSource('hero_cta'), 'hero_cta')
  assert.equal(sanitizeSource(' Pricing_CTA '), 'pricing_cta')
  assert.equal(sanitizeSource('lp-v1'), 'lp-v1')
  for (const value of [undefined, '', '<script>', 'a b', 'x'.repeat(41), 42, '_start']) {
    assert.equal(sanitizeSource(value), 'direct', String(value))
  }
})

test('the start form is rejected without the early-start consent (enforced on the server)', () => {
  assert.deepEqual(parseStartForm({ src: 'hero_cta' }), { ok: false, error: 'consent_required', src: 'hero_cta' })
  assert.deepEqual(parseStartForm({ consent_early_start: '', src: 'x' }), { ok: false, error: 'consent_required', src: 'x' })
  assert.deepEqual(parseStartForm({ consent_early_start: 'nein' }), { ok: false, error: 'consent_required', src: 'direct' })
  assert.deepEqual(parseStartForm(null), { ok: false, error: 'consent_required', src: 'direct' })
  assert.deepEqual(parseStartForm({ consent_early_start: '1', src: 'final_cta' }), { ok: true, src: 'final_cta' })
  assert.deepEqual(parseStartForm({ consent_early_start: 'on' }), { ok: true, src: 'direct' })
})

// --- Stripe-Session ---------------------------------------------------------------------------------

test('submit_type defaults to "pay", which the pinned API rejects in subscription mode, so it is left out', () => {
  assert.deepEqual([...SUBSCRIPTION_MODE_SUBMIT_TYPES], ['auto', 'subscribe'])
  assert.deepEqual(resolveSubmitType(undefined), { submitType: null, requested: 'pay', reason: 'unsupported_in_subscription_mode' })
  assert.deepEqual(resolveSubmitType('pay'), { submitType: null, requested: 'pay', reason: 'unsupported_in_subscription_mode' })
  assert.deepEqual(resolveSubmitType(' Subscribe '), { submitType: 'subscribe', requested: 'subscribe', reason: 'ok' })
  assert.deepEqual(resolveSubmitType('auto'), { submitType: 'auto', requested: 'auto', reason: 'ok' })
  assert.deepEqual(resolveSubmitType('none'), { submitType: null, requested: 'none', reason: 'disabled' })
  assert.deepEqual(resolveSubmitType('kaufen'), { submitType: null, requested: 'kaufen', reason: 'invalid' })
})

test('guest session params: dynamic payment methods, German locale, consent and nonce in both metadata sets', () => {
  const params = buildCheckoutSessionParams(baseParams({ customFields: [{ key: 'pat_source', optional: true }] }))

  assert.equal(params.mode, 'subscription')
  assert.equal(params.locale, 'de')
  assert.equal('payment_method_types' in params, false, 'no fixed payment methods')
  assert.equal(params.billing_address_collection, 'auto')
  assert.deepEqual(params.automatic_tax, { enabled: true })
  assert.equal(params.allow_promotion_codes, true)
  assert.deepEqual(params.line_items, [{ price: 'price_mentorship', quantity: 1 }])
  assert.equal('customer' in params, false)
  assert.equal('customer_email' in params, false)
  assert.equal('customer_update' in params, false)
  assert.equal('submit_type' in params, false)
  assert.equal('consent_collection' in params, false)
  assert.deepEqual(params.custom_fields, [{ key: 'pat_source', optional: true }])
  assert.equal(params.success_url, 'https://www.price-action-trader.de/willkommen?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(params.cancel_url, 'https://www.price-action-trader.de/checkout?abgebrochen=1&src=hero_cta')

  const expected = {
    product: 'mentorship',
    flow: 'guest',
    src: 'hero_cta',
    consent_early_start: 'true',
    consent_at: '2026-09-25T12:00:00.000Z',
    terms_version: legal.CHECKOUT_TERMS_VERSION,
    nonce_hash: 'a'.repeat(64),
  }
  assert.deepEqual(params.metadata, expected)
  assert.deepEqual(params.subscription_data, { metadata: { ...expected, signupType: 'launch_2026' } })
  for (const value of Object.values(params.metadata)) assert.equal(typeof value, 'string', 'Stripe metadata values are strings')
})

test('account session params reuse the customer and carry the user id', () => {
  const params = buildCheckoutSessionParams(
    baseParams({ flow: 'account', customerId: 'cus_1', userId: 'user_1', src: 'direct', submitType: 'subscribe' })
  )
  assert.equal(params.customer, 'cus_1')
  assert.deepEqual(params.customer_update, { address: 'auto', name: 'auto' })
  assert.equal('customer_email' in params, false)
  assert.equal(params.metadata.userId, 'user_1')
  assert.equal(params.subscription_data.metadata.userId, 'user_1')
  assert.equal(params.metadata.flow, 'account')
  assert.equal(params.submit_type, 'subscribe')
  assert.equal(params.cancel_url, 'https://www.price-action-trader.de/checkout?abgebrochen=1')
})

test('Stripe terms checkbox only when switched on; invalid input throws', () => {
  const withTos = buildCheckoutSessionParams(
    baseParams({ tosConsent: true, termsAcceptanceMessage: legal.checkoutTermsAcceptanceMessage() })
  )
  assert.deepEqual(withTos.consent_collection, { terms_of_service: 'required' })
  assert.match(withTos.custom_text.terms_of_service_acceptance.message, /\[AGB\]\(https:\/\/www\.price-action-trader\.de\/AGB\)/)

  assert.throws(() => buildCheckoutSessionParams(baseParams({ flow: 'account' })), /customer and user/)
  assert.throws(() => buildCheckoutSessionParams(baseParams({ flow: 'other' })), /Unknown checkout flow/)
  assert.throws(() => buildCheckoutSessionParams(baseParams({ consentAt: '' })), /consent or nonce/)
  assert.throws(() => buildCheckoutSessionParams(baseParams({ nonceHash: '' })), /consent or nonce/)
  assert.throws(() => buildCheckoutSessionParams(baseParams({ priceId: '' })), /price/)
})

test('the text above the Stripe order button names service, price incl. VAT, term and notice period', () => {
  const message = legal.checkoutSubmitMessage()
  assert.ok(message.length <= 1200, `custom_text.submit allows 1200 characters, got ${message.length}`)
  assert.match(message, /PAT Mentorship 2026/)
  assert.match(message, /150 € pro Monat inkl\. MwSt\./)
  assert.match(message, /Unbefristet/)
  assert.match(message, /Frist von einem Tag zum Ende des jeweiligen Abrechnungsmonats/)
  assert.match(message, /\[AGB\]\(https:\/\/www\.price-action-trader\.de\/AGB\)/)
  assert.match(message, /\[Widerrufsbelehrung\]\(https:\/\/www\.price-action-trader\.de\/Widerruf\)/)
})

test('new visible checkout texts contain no dashes and the consent text covers the legal points', () => {
  const texts = [
    legal.EARLY_START_CONSENT_TEXT,
    legal.checkoutSubmitMessage(),
    legal.checkoutTermsAcceptanceMessage(),
    ...Object.values(legal.MENTORSHIP_OFFER).filter((value) => typeof value === 'string'),
    ...legal.CHECKOUT_PAYMENT_METHODS,
  ]
  for (const text of texts) assert.doesNotMatch(text, DASHES, text)

  const consent = legal.EARLY_START_CONSENT_TEXT
  assert.match(consent, /^Ich verlange ausdrücklich/)
  assert.match(consent, /vor Ablauf der Widerrufsfrist/)
  assert.match(consent, /digitalen Inhalte .* mit Beginn der Bereitstellung erlischt/)
  assert.match(consent, /vollständig erbracht/)
  assert.match(consent, /Wertersatz/)
  assert.equal(legal.earlyStartConsentText(legal.CHECKOUT_TERMS_VERSION), consent)
  assert.equal(legal.earlyStartConsentText('unknown'), null)
  assert.equal(legal.earlyStartConsentText('toString'), null, 'no prototype lookups')
})

// --- Freischaltung: Session-Prüfung -----------------------------------------------------------------

test('only completed mentorship sessions from this flow are fulfilled', () => {
  const session = (metadata, extra = {}) => ({ mode: 'subscription', status: 'complete', metadata, ...extra })
  assert.deepEqual(checkFulfillable(session({ product: 'mentorship', flow: 'guest' })), { ok: true, flow: 'guest' })
  assert.deepEqual(checkFulfillable(session({ product: 'mentorship', flow: 'account' })), { ok: true, flow: 'account' })
  assert.deepEqual(checkFulfillable(session({ product: 'raidmap', flow: 'guest' })), { ok: false, reason: 'foreign_product' })
  assert.deepEqual(checkFulfillable(session({ product: 'research' })), { ok: false, reason: 'foreign_product' })
  assert.deepEqual(checkFulfillable(session({ userId: 'user_1' })), { ok: false, reason: 'not_this_flow' }, 'old account flow')
  assert.deepEqual(checkFulfillable(session({ product: 'mentorship', flow: 'other' })), { ok: false, reason: 'not_this_flow' })
  assert.deepEqual(checkFulfillable(session({ product: 'mentorship', flow: 'guest' }, { status: 'open' })), { ok: false, reason: 'not_complete' })
  assert.deepEqual(checkFulfillable(session({ product: 'mentorship', flow: 'guest' }, { mode: 'payment' })), { ok: false, reason: 'not_subscription' })
  assert.deepEqual(checkFulfillable(null), { ok: false, reason: 'not_this_flow' })
})

test('checkout metadata is read defensively', () => {
  assert.deepEqual(readCheckoutMetadata({ metadata: { product: 'mentorship', flow: 'guest', src: 'hero_cta', consent_early_start: 'true', consent_at: 'x', terms_version: 'v', nonce_hash: 'h' } }), {
    product: 'mentorship', flow: 'guest', src: 'hero_cta', consentEarlyStart: true, consentAt: 'x', termsVersion: 'v', nonceHash: 'h', userId: null,
  })
  assert.deepEqual(readCheckoutMetadata({}), {
    product: null, flow: null, src: 'direct', consentEarlyStart: false, consentAt: null, termsVersion: null, nonceHash: null, userId: null,
  })
})

// --- Konto-Entscheidung -----------------------------------------------------------------------------

test('account decision: new e-mail creates an account', () => {
  assert.deepEqual(decideAccount({ flow: 'guest', matches: [] }), { action: 'create' })
})

test('account decision: an existing verified account is linked, never created twice', () => {
  assert.deepEqual(decideAccount({ flow: 'guest', matches: [{ id: 'user_1', verified: true, isAdmin: false }] }), {
    action: 'link', userId: 'user_1', reason: 'existing-email', notifyAdmin: false,
  })
})

test('account decision: an unverified address on another account is not taken over', () => {
  assert.deepEqual(decideAccount({ flow: 'guest', matches: [{ id: 'user_x', verified: false, isAdmin: false }] }), { action: 'create' })
})

test('account decision: admin accounts are linked with a notice for Petar', () => {
  assert.deepEqual(
    decideAccount({ flow: 'guest', matches: [{ id: 'user_1', verified: true, isAdmin: false }, { id: 'user_admin', verified: true, isAdmin: true }] }),
    { action: 'link', userId: 'user_admin', reason: 'existing-admin', notifyAdmin: true }
  )
})

test('account decision: signed-in purchases stay with the buyer account, a deleted account falls back to the e-mail', () => {
  assert.deepEqual(decideAccount({ flow: 'account', accountUser: { id: 'user_buyer', isAdmin: true }, matches: [{ id: 'user_other', verified: true, isAdmin: false }] }), {
    action: 'link', userId: 'user_buyer', reason: 'account-flow', notifyAdmin: false,
  })
  assert.deepEqual(decideAccount({ flow: 'account', accountUser: null, matches: [] }), { action: 'create' })
})

// --- Automatische Anmeldung ------------------------------------------------------------------------

function signIn(overrides = {}) {
  return decideAutoSignIn({
    userId: 'user_new',
    createdNewUser: true,
    nonceMatches: true,
    sessionCreatedAt: NOW - 5 * 60_000,
    ticketIssuedAt: null,
    signedInUserId: null,
    now: NOW,
    ...overrides,
  })
}

test('auto sign-in only for a brand-new account, same browser, fresh session and a single ticket', () => {
  assert.deepEqual(signIn(), { allowed: true })
  assert.deepEqual(signIn({ createdNewUser: false }), { allowed: false, reason: 'existing-account' })
  assert.deepEqual(signIn({ nonceMatches: false }), { allowed: false, reason: 'nonce-mismatch' })
  assert.deepEqual(signIn({ sessionCreatedAt: NOW - AUTO_SIGN_IN_WINDOW_MS - 1 }), { allowed: false, reason: 'too-old' })
  assert.deepEqual(signIn({ ticketIssuedAt: new Date(NOW) }), { allowed: false, reason: 'ticket-already-issued' })
  assert.deepEqual(signIn({ userId: null }), { allowed: false, reason: 'no-account' })
})

test('auto sign-in never replaces a signed-in session; the buyer himself is just redirected', () => {
  assert.deepEqual(signIn({ signedInUserId: 'user_new' }), { allowed: false, reason: 'already-signed-in' })
  assert.deepEqual(signIn({ signedInUserId: 'user_other' }), { allowed: false, reason: 'other-account-signed-in' })
  assert.deepEqual(signIn({ signedInUserId: 'user_other', createdNewUser: false }), { allowed: false, reason: 'other-account-signed-in' })
})

test('the time window is 60 minutes, with one minute tolerance for clock skew', () => {
  assert.equal(AUTO_SIGN_IN_WINDOW_MS, 60 * 60 * 1000)
  assert.equal(isWithinWindow(NOW, NOW), true)
  assert.equal(isWithinWindow(NOW - AUTO_SIGN_IN_WINDOW_MS, NOW), true)
  assert.equal(isWithinWindow(NOW - AUTO_SIGN_IN_WINDOW_MS - 1, NOW), false)
  assert.equal(isWithinWindow(NOW + 30_000, NOW), true)
  assert.equal(isWithinWindow(NOW + 120_000, NOW), false)
  assert.equal(isWithinWindow(Number.NaN, NOW), false)
})

// --- Nonce ------------------------------------------------------------------------------------------

test('nonce: random, cookie-safe, only its hash leaves the server, compared in constant time', () => {
  assert.equal(CHECKOUT_NONCE_COOKIE, 'pat_co')
  assert.equal(CHECKOUT_NONCE_MAX_AGE_SECONDS, 7200)
  const a = createCheckoutNonce()
  const b = createCheckoutNonce()
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)

  const hash = hashCheckoutNonce(a)
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(hashCheckoutNonce(a), hash, 'deterministic')
  assert.notEqual(hash, hashCheckoutNonce(b))

  assert.equal(nonceMatchesHash(a, hash), true)
  assert.equal(nonceMatchesHash(b, hash), false)
  assert.equal(nonceMatchesHash(undefined, hash), false, 'no cookie (other browser, in-app browser)')
  assert.equal(nonceMatchesHash(a, null), false)
  assert.equal(nonceMatchesHash(a, hash.toUpperCase()), false)
  assert.equal(nonceMatchesHash('short', hashCheckoutNonce('short')), false)
  assert.equal(nonceMatchesHash(`${a}\n`, hash), false)
})

// --- Doppel-Abo -------------------------------------------------------------------------------------

test('duplicate detection ignores the new subscription, Raid Map, other prices and ended subscriptions', () => {
  const input = (subscriptions, extra = {}) => ({ subscriptions, newSubscriptionId: 'sub_new', mentorshipPriceIds: ['price_m'], ...extra })
  const sub = (id, status, extra = {}) => ({ id, status, product: null, priceIds: ['price_m'], ...extra })

  assert.deepEqual(findDuplicateSubscription(input([sub('sub_new', 'active')])), { duplicate: false })
  assert.deepEqual(findDuplicateSubscription(input([sub('sub_old', 'canceled'), sub('sub_x', 'incomplete_expired')])), { duplicate: false })
  assert.deepEqual(findDuplicateSubscription(input([sub('sub_rm', 'active', { product: 'raidmap' })])), { duplicate: false })
  assert.deepEqual(findDuplicateSubscription(input([sub('sub_other', 'active', { priceIds: ['price_other'] })])), { duplicate: false })
  assert.deepEqual(findDuplicateSubscription(input([sub('sub_new', 'active'), sub('sub_old', 'active')])), {
    duplicate: true, kind: 'stripe', subscriptionId: 'sub_old', status: 'active',
  })
  assert.deepEqual(findDuplicateSubscription(input([sub('sub_due', 'past_due')])), {
    duplicate: true, kind: 'stripe', subscriptionId: 'sub_due', status: 'past_due',
  })
  assert.deepEqual(findDuplicateSubscription(input([], { paypalActive: true })), { duplicate: true, kind: 'paypal' })
})

// --- Kleinkram --------------------------------------------------------------------------------------

test('session ids and e-mail masking', () => {
  assert.equal(isCheckoutSessionId('cs_test_a1B2c3D4e5F6g7H8'), true)
  assert.equal(isCheckoutSessionId('cs_live_a1B2c3D4e5F6g7H8'), true)
  for (const value of [undefined, '', 'cs_test_', 'sub_123', 'cs_test_abc/../x', 'cs_prod_a1B2c3D4e5F6g7H8']) {
    assert.equal(isCheckoutSessionId(value), false, String(value))
  }
  assert.equal(maskEmail('Max@Example.com'), 'm••@example.com')
  assert.equal(maskEmail('a@b.de'), 'a••@b.de')
  assert.equal(maskEmail('averylongname@b.de'), 'a••••••@b.de')
  assert.equal(maskEmail('invalid'), '')
})

test('middleware keeps the checkout routes public', async () => {
  const middleware = await read('../middleware.ts')
  const block = middleware.match(/isAuthRequiredRoute = createRouteMatcher\(\[([\s\S]*?)\]\)/)
  assert.ok(block, 'protected route list found')
  const protectedPatterns = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1].replace('(.*)', ''))
  for (const route of ['/checkout', '/willkommen', '/willkommen/anmelden', '/api/checkout/start']) {
    assert.equal(protectedPatterns.some((prefix) => route.startsWith(prefix)), false, route)
  }
})
