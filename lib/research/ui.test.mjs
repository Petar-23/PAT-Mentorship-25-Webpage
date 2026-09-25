import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeResearchMembership,
  firstSearchParam,
  formatResearchDate,
  formatResearchDateTime,
  isCheckoutSessionId,
  isSafeBillingRedirect,
  parseResearchPlanSelection,
  parseRetryAfterSeconds,
  requestResearchCheckout,
  requestResearchPortal,
  RESEARCH_CHECKOUT_ENDPOINT,
  RESEARCH_PORTAL_ENDPOINT,
  researchAuthUrls,
  researchCheckoutError,
  researchCheckoutRequestBody,
  researchIntervalLabel,
  researchPlanPrice,
  researchPortalError,
  researchRateLimitMessage,
  researchSignInHref,
  resolveResearchWelcomeState,
  safeResearchRedirectPath,
  splitTermsLink,
} from './ui.mjs'
import { RESEARCH_CONSENT_TEXT, RESEARCH_CONSENT_VERSIONS, RESEARCH_TIERS } from './config.mjs'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import * as researchConfig from './config.mjs'
import * as researchUi from './ui.mjs'

// Gleiche Semantik wie researchHref aus routing.mjs, hier als Testdouble.
const hrefFor = basePath => path => {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error(`invalid path ${path}`)
  if (!basePath) return path
  return path === '/' ? basePath : `${basePath}${path}`
}

test('firstSearchParam takes the first string value only', () => {
  assert.equal(firstSearchParam('a'), 'a')
  assert.equal(firstSearchParam(['b', 'c']), 'b')
  assert.equal(firstSearchParam([]), undefined)
  assert.equal(firstSearchParam(undefined), undefined)
  assert.equal(firstSearchParam(null), undefined)
})

test('safeResearchRedirectPath accepts same-origin relative paths', () => {
  for (const value of ['/', '/pricing', '/research/pricing?tier=member&interval=year', '/welcome?session_id=cs_test_1#top', '/pricing?next=//evil.com#//x']) {
    assert.equal(safeResearchRedirectPath(value), value, value)
  }
})

test('safeResearchRedirectPath returns the normalised path, never the raw dot segments', () => {
  assert.equal(safeResearchRedirectPath('/x/../pricing'), '/pricing')
  assert.equal(safeResearchRedirectPath('/research/./pricing?tier=member'), '/research/pricing?tier=member')
  assert.equal(safeResearchRedirectPath('/research/%2e%2e/account'), '/account')
  assert.equal(safeResearchRedirectPath('/..'), '/')
  assert.equal(safeResearchRedirectPath('/a//b'), '/a//b')
})

// Payloads, die erst nach der Normalisierung durch den URL-Parser zu "//host"
// werden (Clerk → router.push → new URL(href, location.href) → https://evil.com).
const DOT_SEGMENT_PAYLOADS = [
  '/..//evil.com', '/.//evil.com', '/%2e%2e//evil.com', '/%2E%2E//evil.com', '/.%2e//evil.com', '/%2e//evil.com',
  '/x/..//evil.com', '/x/%2e%2e//evil.com', '/research/../..//evil.com', '/research/..//evil.com/research',
  '/../..//evil.com?x=1#y',
]

test('safeResearchRedirectPath rejects open redirects and junk', () => {
  const rejected = [
    undefined, null, 42, {}, '', 'pricing', '//evil.com', '//evil.com/research', '/\\evil.com', '\\\\evil.com',
    '/\t/evil.com', '/\n/evil.com', '/\r\n/evil.com', '/\u0000', 'https://evil.com', 'http://localhost/research',
    'javascript:alert(1)', ' /pricing', '/' + 'a'.repeat(2048),
    // Kodierte Schrägstriche im Pfad (falls ein Glied der Kette sie dekodiert).
    '/%2F%2Fevil.com', '/%2f%2fevil.com', '/%5C%5Cevil.com', '/x/%2F/evil.com',
    ...DOT_SEGMENT_PAYLOADS,
  ]
  for (const value of rejected) assert.equal(safeResearchRedirectPath(value), null, JSON.stringify(value))
})

test('every accepted redirect stays on the research origin when a router resolves it', () => {
  const candidates = [
    '/', '/pricing', '/x/../pricing', '/a//b', '/research/./welcome?session_id=cs_test_1', '/.../x', '/..%2F', '/%2e%2e%2f',
    ...DOT_SEGMENT_PAYLOADS,
  ]
  for (const location of ['https://research.price-action-trader.de/sign-in', 'http://localhost:3000/research/sign-in?x=1']) {
    const { origin } = new URL(location)
    for (const value of candidates) {
      const safe = safeResearchRedirectPath(value)
      if (safe === null) continue
      assert.ok(safe.startsWith('/') && !safe.startsWith('//'), `${value} -> ${safe}`)
      // So löst Next.js (dispatchNavigateAction) router.push-Ziele auf.
      assert.equal(new URL(safe, location).origin, origin, `${value} -> ${safe}`)
      // Clerk macht das Ziel absolut und schneidet die Origin wieder ab.
      const absolute = new URL(safe, origin).href
      assert.equal(new URL(absolute.slice(origin.length), location).origin, origin, `${value} -> ${safe}`)
      assert.equal(safeResearchRedirectPath(safe), safe, `idempotent: ${value}`)
    }
  }
})

test('researchSignInHref keeps the base path and returns to the current page', () => {
  assert.equal(researchSignInHref(hrefFor(''), '/pricing'), `/sign-in?redirect_url=${encodeURIComponent('/pricing')}`)
  assert.equal(researchSignInHref(hrefFor('/research'), '/'), `/research/sign-in?redirect_url=${encodeURIComponent('/research')}`)
  assert.equal(
    researchSignInHref(hrefFor('/research'), '/pricing?tier=supporter&interval=year'),
    `/research/sign-in?redirect_url=${encodeURIComponent('/research/pricing?tier=supporter&interval=year')}`,
  )
})

test('researchSignInHref never loops back to the auth pages', () => {
  for (const path of ['/sign-in', '/sign-in/factor-one', '/sign-up', '/sign-up?x=1']) {
    assert.equal(researchSignInHref(hrefFor('/research'), path), `/research/sign-in?redirect_url=${encodeURIComponent('/research')}`)
  }
  // "/sign-inside" ist keine Anmeldeseite.
  assert.equal(researchSignInHref(hrefFor(''), '/sign-inside'), `/sign-in?redirect_url=${encodeURIComponent('/sign-inside')}`)
})

test('researchAuthUrls passes the normalised target to Clerk', () => {
  const urls = researchAuthUrls(hrefFor('/research'), '/research/x/../pricing?tier=reader')
  assert.equal(urls.target, '/research/pricing?tier=reader')
  assert.equal(urls.signUpUrl, `/research/sign-up?redirect_url=${encodeURIComponent('/research/pricing?tier=reader')}`)
})

test('researchAuthUrls forces a safe target and forwards it between sign-in and sign-up', () => {
  const urls = researchAuthUrls(hrefFor('/research'), '/research/pricing?tier=reader')
  assert.deepEqual(urls, {
    target: '/research/pricing?tier=reader',
    home: '/research',
    signInPath: '/research/sign-in',
    signUpPath: '/research/sign-up',
    signInUrl: `/research/sign-in?redirect_url=${encodeURIComponent('/research/pricing?tier=reader')}`,
    signUpUrl: `/research/sign-up?redirect_url=${encodeURIComponent('/research/pricing?tier=reader')}`,
  })
})

test('researchAuthUrls ignores unsafe redirect_url values and falls back to home', () => {
  for (const raw of [undefined, '', '//evil.com', 'https://evil.com/x', '/\\evil.com', ...DOT_SEGMENT_PAYLOADS]) {
    const urls = researchAuthUrls(hrefFor(''), raw)
    assert.equal(urls.target, '/')
    assert.equal(urls.signInUrl, '/sign-in')
    assert.equal(urls.signUpUrl, '/sign-up')
  }
})

test('parseResearchPlanSelection validates tier and interval', () => {
  assert.deepEqual(parseResearchPlanSelection({}), { tier: 'member', interval: 'month' })
  assert.deepEqual(parseResearchPlanSelection(undefined), { tier: 'member', interval: 'month' })
  assert.deepEqual(parseResearchPlanSelection({ tier: 'supporter', interval: 'year' }), { tier: 'supporter', interval: 'year' })
  assert.deepEqual(parseResearchPlanSelection({ tier: ['reader', 'member'], interval: ['year'] }), { tier: 'reader', interval: 'year' })
  assert.deepEqual(parseResearchPlanSelection({ tier: 'gold', interval: 'week' }), { tier: 'member', interval: 'month' })
  assert.deepEqual(parseResearchPlanSelection({ tier: '__proto__', interval: 'constructor' }), { tier: 'member', interval: 'month' })
})

test('researchPlanPrice shows the monthly price or the yearly total with free months', () => {
  assert.deepEqual(researchPlanPrice('member', 'month'), { amount: '$10', period: 'per month', summary: '$10 per month', saving: null })
  assert.deepEqual(researchPlanPrice('member', 'year'), { amount: '$100', period: 'per year', summary: '$100 per year', saving: '2 months free' })
  assert.equal(researchPlanPrice('reader', 'year').summary, '$70 per year')
  assert.equal(researchPlanPrice('supporter', 'year').summary, '$150 per year')
  for (const tier of RESEARCH_TIERS) assert.equal(researchPlanPrice(tier, 'year').saving, '2 months free')
  assert.equal(researchIntervalLabel('month'), 'Monthly')
  assert.equal(researchIntervalLabel('year'), 'Annual')
})

test('splitTermsLink finds the Terms of Service phrase in the consent text', () => {
  const parts = splitTermsLink(RESEARCH_CONSENT_TEXT.terms)
  assert.ok(parts)
  assert.equal(parts.before + parts.link + parts.after, RESEARCH_CONSENT_TEXT.terms)
  assert.equal(parts.link, 'Terms of Service')
  assert.equal(splitTermsLink('No link here'), null)
})

test('already_subscribed uses the route message and never claims an active membership on its own', () => {
  const fallback = researchCheckoutError('already_subscribed')
  assert.equal(fallback.action, 'account')
  assert.doesNotMatch(fallback.message, /active/i)
  assert.match(fallback.message, /account/)
  const openPayment = 'Your existing PAT Research subscription has an open payment. Please update your payment method in your account instead of subscribing again.'
  assert.deepEqual(researchCheckoutError('already_subscribed', openPayment), { message: openPayment, action: 'account' })
  assert.equal(researchCheckoutError('already_subscribed', '  You already have an active PAT Research membership. ').message,
    'You already have an active PAT Research membership.')
  for (const junk of [undefined, null, 42, {}, '', '   ', 'x'.repeat(301)]) {
    assert.equal(researchCheckoutError('already_subscribed', junk).message, fallback.message, JSON.stringify(junk))
  }
  // Andere Codes übernehmen die Server-Meldung nicht.
  assert.equal(researchCheckoutError('rate_limited', 'server text').message, 'Too many attempts. Please try again later.')
  assert.match(researchCheckoutError(undefined, 'server text').message, /could not be started/)
})

test('checkout and portal errors map to calm messages', () => {
  assert.equal(researchCheckoutError('already_subscribed').action, 'account')
  assert.equal(researchCheckoutError('signed_out').action, 'sign-in')
  assert.match(researchCheckoutError('consent_required').message, /confirm both/)
  assert.equal(researchCheckoutError('rate_limited').message, 'Too many attempts. Please try again later.')
  assert.equal(researchCheckoutError(undefined).action, null)
  assert.match(researchCheckoutError('checkout_failed').message, /could not be started/)
  assert.equal(researchPortalError(404, 'no_customer'), 'No subscription found yet.')
  assert.equal(researchPortalError(500, 'no_customer'), 'No subscription found yet.')
  assert.match(researchPortalError(401, 'signed_out'), /sign in again/)
  assert.equal(researchPortalError(429, 'rate_limited'), 'Too many attempts. Please try again later.')
  assert.match(researchPortalError(500, 'portal_failed'), /could not be opened/)
})

test('portal: a kill-switch 404 never tells a paying member they have no subscription', () => {
  const generic = 'Billing could not be opened. Please try again in a moment.'
  // Route (`not_found`) und Middleware (Text-404 ohne JSON, also ohne Code).
  for (const code of ['not_found', undefined, null]) {
    assert.equal(researchPortalError(404, code), generic, String(code))
  }
  assert.equal(researchPortalError(404, 'no_customer'), 'No subscription found yet.')
})

test('Retry-After: only the delta-seconds form is read', () => {
  assert.equal(parseRetryAfterSeconds('1234'), 1234)
  assert.equal(parseRetryAfterSeconds(' 60 '), 60)
  assert.equal(parseRetryAfterSeconds('0'), 0)
  for (const value of [null, undefined, '', '  ', '-5', '1.5', '12abc', 'Wed, 21 Oct 2026 07:28:00 GMT', '9'.repeat(10)]) {
    assert.equal(parseRetryAfterSeconds(value), null, String(value))
  }
})

test('rate-limit copy rounds the Retry-After seconds up to whole minutes (at least 1)', () => {
  const cases = [
    [0, 'Too many attempts. Please try again in about 1 minute.'],
    [1, 'Too many attempts. Please try again in about 1 minute.'],
    [60, 'Too many attempts. Please try again in about 1 minute.'],
    [61, 'Too many attempts. Please try again in about 2 minutes.'],
    [1234, 'Too many attempts. Please try again in about 21 minutes.'],
    [3600, 'Too many attempts. Please try again in about 60 minutes.'],
  ]
  for (const [seconds, message] of cases) {
    assert.equal(researchRateLimitMessage(seconds), message, String(seconds))
    assert.deepEqual(researchCheckoutError('rate_limited', 'server text', seconds), { message, action: null }, String(seconds))
    assert.equal(researchPortalError(429, 'rate_limited', seconds), message, String(seconds))
    assert.equal(researchPortalError(429, null, seconds), message, String(seconds))
  }
  for (const missing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(researchRateLimitMessage(missing), 'Too many attempts. Please try again later.', String(missing))
    assert.equal(researchCheckoutError('rate_limited', undefined, missing).message, 'Too many attempts. Please try again later.')
    assert.equal(researchPortalError(429, 'rate_limited', missing), 'Too many attempts. Please try again later.')
  }
  // Header + Parser zusammen, wie in den Client-Komponenten.
  assert.equal(researchPortalError(429, 'rate_limited', parseRetryAfterSeconds('1234')), 'Too many attempts. Please try again in about 21 minutes.')
  assert.equal(researchCheckoutError('rate_limited', undefined, parseRetryAfterSeconds(null)).message, 'Too many attempts. Please try again later.')
  // Andere Fehler ignorieren die Wartezeit.
  assert.equal(researchPortalError(404, 'no_customer', 120), 'No subscription found yet.')
  assert.match(researchCheckoutError('checkout_failed', undefined, 120).message, /could not be started/)
})

test('checkout body sends the versions of the consent texts the page renders', () => {
  for (const tier of RESEARCH_TIERS) {
    for (const interval of ['month', 'year']) {
      assert.deepEqual(researchCheckoutRequestBody(tier, interval), {
        tier,
        interval,
        acceptTerms: true,
        waiveWithdrawal: true,
        termsVersion: RESEARCH_CONSENT_VERSIONS.terms,
        withdrawalWaiverVersion: RESEARCH_CONSENT_VERSIONS.withdrawalWaiver,
      })
    }
  }
})

// Die Checkout-Route vergleicht nur Versionen, nicht den Wortlaut. Deshalb hier
// jede je ausgelieferte Version mit dem sha256 ihres Texts (derselbe Hash, den
// consent.ts als textSha256 protokolliert). Wortlaut geändert? Neue Version in
// config.mjs UND neuen Eintrag hier. Bestehende Einträge nie ändern.
const CONSENT_TEXT_LEDGER = {
  terms: {
    'terms-2026-09-25-draft': 'bbec510f9f6b194fba7ba0890f5ba33ce1f8b3074d3a85653a729f0557715e23',
  },
  withdrawalWaiver: {
    'withdrawal-waiver-2026-09-25-draft': 'f68df0b79e27528401f382fb111166bb295e50def27212169d4e30a675a5af85',
  },
}

test('every consent wording change comes with a new text version (ledger)', () => {
  for (const key of ['terms', 'withdrawalWaiver']) {
    const version = RESEARCH_CONSENT_VERSIONS[key]
    const ledger = CONSENT_TEXT_LEDGER[key]
    assert.ok(Object.hasOwn(ledger, version), `New ${key} version ${version}: add it with the sha256 of its text to CONSENT_TEXT_LEDGER.`)
    assert.equal(
      createHash('sha256').update(RESEARCH_CONSENT_TEXT[key]).digest('hex'),
      ledger[version],
      `RESEARCH_CONSENT_TEXT.${key} changed but RESEARCH_CONSENT_VERSIONS.${key} is still ${version}: bump the version, otherwise open pages are not asked to reload.`,
    )
  }
})

test('consent_outdated asks the user to reload and confirm again', () => {
  const error = researchCheckoutError('consent_outdated', 'server text')
  assert.equal(error.action, 'reload')
  assert.match(error.message, /terms were updated/)
  assert.match(error.message, /reload the page and confirm again/)
})

const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

// Fake-fetch: protokolliert Aufrufe (Body als JSON) und antwortet mit respond().
function fakeFetch(respond) {
  const calls = []
  const fetch = async (input, init) => {
    calls.push({ input, init, body: JSON.parse(init.body) })
    return respond()
  }
  return { fetch, calls }
}

const GENERIC_CHECKOUT_ERROR = researchCheckoutError(null)
const GENERIC_PORTAL_ERROR = 'Billing could not be opened. Please try again in a moment.'

test('checkout request: posts exactly researchCheckoutRequestBody (incl. text versions) to the unprefixed API', async () => {
  assert.equal(RESEARCH_CHECKOUT_ENDPOINT, '/api/research/checkout')
  const { signal } = new AbortController()
  for (const tier of RESEARCH_TIERS) {
    for (const interval of ['month', 'year']) {
      const { fetch, calls } = fakeFetch(() => jsonResponse(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }))
      assert.deepEqual(await requestResearchCheckout({ tier, interval, signal, fetch }), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
      assert.equal(calls.length, 1)
      const [{ input, init, body }] = calls
      assert.equal(input, '/api/research/checkout')
      assert.equal(init.method, 'POST')
      assert.deepEqual(init.headers, { 'Content-Type': 'application/json' })
      assert.equal(init.signal, signal)
      assert.deepEqual(body, researchCheckoutRequestBody(tier, interval))
      assert.equal(body.termsVersion, RESEARCH_CONSENT_VERSIONS.terms)
      assert.equal(body.withdrawalWaiverVersion, RESEARCH_CONSENT_VERSIONS.withdrawalWaiver)
    }
  }
  // Test-Modus: relatives Ziel.
  const testMode = fakeFetch(() => jsonResponse(200, { url: '/research/welcome?test=1' }))
  assert.deepEqual(await requestResearchCheckout({ tier: 'member', interval: 'month', fetch: testMode.fetch }), { url: '/research/welcome?test=1' })
})

test('checkout request: responses map to the pricing page messages (Retry-After only on 429)', async () => {
  const openPayment = 'Your existing PAT Research subscription has an open payment. Please update your payment method in your account instead of subscribing again.'
  const cases = [
    [() => jsonResponse(429, { code: 'rate_limited', message: 'x' }, { 'Retry-After': '1234' }), { message: 'Too many attempts. Please try again in about 21 minutes.', action: null }],
    [() => jsonResponse(429, { code: 'rate_limited' }), { message: 'Too many attempts. Please try again later.', action: null }],
    [() => jsonResponse(409, { code: 'consent_outdated', message: 'server text' }), researchCheckoutError('consent_outdated')],
    [() => jsonResponse(409, { code: 'already_subscribed', message: openPayment }), { message: openPayment, action: 'account' }],
    [() => jsonResponse(401, { code: 'signed_out' }), researchCheckoutError('signed_out')],
    [() => jsonResponse(400, { code: 'consent_required' }), researchCheckoutError('consent_required')],
    [() => jsonResponse(503, { code: 'checkout_failed' }, { 'Retry-After': '120' }), GENERIC_CHECKOUT_ERROR],
    // 200 ohne sicheres Ziel, Text-404 der Middleware (Kill-Switch), Netzwerkfehler.
    [() => jsonResponse(200, { url: 'http://checkout.stripe.com/c/pay/cs_test_1' }), GENERIC_CHECKOUT_ERROR],
    [() => jsonResponse(200, { url: '//evil.com', code: 'already_subscribed' }), GENERIC_CHECKOUT_ERROR],
    [() => new Response('Not found', { status: 404 }), GENERIC_CHECKOUT_ERROR],
    [() => { throw new TypeError('Failed to fetch') }, GENERIC_CHECKOUT_ERROR],
  ]
  for (const [respond, expected] of cases) {
    const { fetch } = fakeFetch(respond)
    assert.deepEqual(await requestResearchCheckout({ tier: 'member', interval: 'month', fetch }), { error: expected }, String(respond))
  }
  assert.equal(researchCheckoutError('consent_outdated').action, 'reload')
})

test('portal request: posts {} to the unprefixed API and maps every answer', async () => {
  assert.equal(RESEARCH_PORTAL_ENDPOINT, '/api/research/portal')
  const { signal } = new AbortController()
  const ok = fakeFetch(() => jsonResponse(200, { url: 'https://billing.stripe.com/p/session/test_1' }))
  assert.deepEqual(await requestResearchPortal({ signal, fetch: ok.fetch }), { url: 'https://billing.stripe.com/p/session/test_1' })
  assert.equal(ok.calls.length, 1)
  assert.equal(ok.calls[0].input, '/api/research/portal')
  assert.equal(ok.calls[0].init.method, 'POST')
  assert.equal(ok.calls[0].init.body, '{}')
  assert.equal(ok.calls[0].init.signal, signal)

  const cases = [
    [() => jsonResponse(429, { code: 'rate_limited' }, { 'Retry-After': '1234' }), 'Too many attempts. Please try again in about 21 minutes.'],
    [() => jsonResponse(429, { code: 'rate_limited' }), 'Too many attempts. Please try again later.'],
    [() => jsonResponse(404, { code: 'no_customer' }), 'No subscription found yet.'],
    [() => jsonResponse(404, { code: 'not_found' }), GENERIC_PORTAL_ERROR],
    [() => new Response('Not found', { status: 404 }), GENERIC_PORTAL_ERROR],
    [() => jsonResponse(401, { code: 'signed_out' }), 'Your session has ended. Please sign in again.'],
    [() => jsonResponse(500, { code: 'portal_failed' }, { 'Retry-After': '120' }), GENERIC_PORTAL_ERROR],
    [() => jsonResponse(200, { url: 'javascript:alert(1)' }), GENERIC_PORTAL_ERROR],
    [() => { throw new TypeError('Failed to fetch') }, GENERIC_PORTAL_ERROR],
  ]
  for (const [respond, expected] of cases) {
    const { fetch } = fakeFetch(respond)
    assert.deepEqual(await requestResearchPortal({ fetch }), { error: expected }, String(respond))
  }
})

test('request helpers use the global fetch by default', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push([input, init.body])
    return jsonResponse(200, { url: 'https://billing.stripe.com/p/session/test_1' })
  })
  assert.deepEqual(await requestResearchPortal(), { url: 'https://billing.stripe.com/p/session/test_1' })
  assert.deepEqual(await requestResearchCheckout({ tier: 'reader', interval: 'year' }), { url: 'https://billing.stripe.com/p/session/test_1' })
  assert.deepEqual(calls, [
    ['/api/research/portal', '{}'],
    ['/api/research/checkout', JSON.stringify(researchCheckoutRequestBody('reader', 'year'))],
  ])
})

test('billing redirects must be https or same-origin relative', () => {
  assert.equal(isSafeBillingRedirect('https://checkout.stripe.com/c/pay/cs_test_1'), true)
  assert.equal(isSafeBillingRedirect('/research/welcome?test=1'), true)
  for (const value of ['http://checkout.stripe.com', 'javascript:alert(1)', '//evil.com', '/..//evil.com', '/%2e%2e//evil.com', '', null, 1, 'not a url']) {
    assert.equal(isSafeBillingRedirect(value), false, String(value))
  }
})

test('isCheckoutSessionId accepts Stripe checkout session ids only', () => {
  assert.equal(isCheckoutSessionId('cs_test_a1B2c3'), true)
  assert.equal(isCheckoutSessionId('cs_live_XYZ_123'), true)
  for (const value of ['', 'cs_', 'sub_123', 'cs_test_1/../x', 'cs_test 1', '{CHECKOUT_SESSION_ID}', 'cs_' + 'a'.repeat(251), null]) {
    assert.equal(isCheckoutSessionId(value), false, String(value))
  }
})

test('dates render in en-US long form in UTC', () => {
  assert.equal(formatResearchDate('2026-09-28T23:30:00.000Z'), 'September 28, 2026')
  assert.equal(formatResearchDate(new Date('2026-01-02T00:00:00.000Z')), 'January 2, 2026')
  assert.equal(formatResearchDate(null), null)
  assert.equal(formatResearchDate('not a date'), null)
  const withTime = formatResearchDateTime('2026-09-28T15:00:00.000Z')
  assert.ok(withTime.startsWith('September 28, 2026'), withTime)
  assert.ok(withTime.includes('3:00'), withTime)
  assert.ok(withTime.endsWith('UTC'), withTime)
  assert.equal(formatResearchDateTime(undefined), null)
})

const accessRow = overrides => ({
  hasAccess: true,
  reason: 'active',
  status: 'active',
  tier: 'member',
  interval: 'month',
  currentPeriodEnd: '2026-10-25T12:00:00.000Z',
  cancelAtPeriodEnd: false,
  cancelAt: null,
  graceEndsAt: null,
  source: 'subscription',
  ...overrides,
})

test('membership: active subscriptions show plan, interval and renewal date', () => {
  const summary = describeResearchMembership(accessRow())
  assert.equal(summary.state, 'active')
  assert.equal(summary.status, 'Active')
  assert.equal(summary.plan, 'Member')
  assert.equal(summary.interval, 'Monthly')
  assert.equal(summary.dateLabel, 'Renews on')
  assert.equal(summary.date, 'October 25, 2026')
  assert.equal(summary.hasSubscription, true)
  assert.equal(describeResearchMembership(accessRow({ reason: 'trialing', status: 'trialing', interval: 'year' })).interval, 'Annual')
})

test('membership: cancellation at period end or at a date shows when access ends', () => {
  const atPeriodEnd = describeResearchMembership(accessRow({ cancelAtPeriodEnd: true }))
  assert.equal(atPeriodEnd.state, 'ending')
  assert.equal(atPeriodEnd.status, 'Ends on October 25, 2026')
  assert.equal(atPeriodEnd.dateLabel, 'Access until')
  const atDate = describeResearchMembership(accessRow({ cancelAt: '2026-10-01T00:00:00.000Z' }))
  assert.equal(atDate.status, 'Ends on October 1, 2026')
})

test('membership: past_due within grace asks for a payment update with the grace end', () => {
  const summary = describeResearchMembership(accessRow({ reason: 'past_due_grace', status: 'past_due', graceEndsAt: '2026-09-28T15:00:00.000Z' }))
  assert.equal(summary.state, 'payment_issue')
  assert.equal(summary.status, 'Payment issue')
  assert.match(summary.detail, /^Please update your payment method \(grace until September 28, 2026.*UTC\)\.$/)
  assert.equal(summary.hasSubscription, true)
  assert.equal(summary.needsPaymentUpdate, true)
  assert.equal(describeResearchMembership(accessRow()).needsPaymentUpdate, false)
})

test('membership: every non-access reason reads as Inactive without a misleading date', () => {
  for (const reason of ['past_due_expired', 'inactive', 'period_ended', 'unknown_tier']) {
    const summary = describeResearchMembership(accessRow({ hasAccess: false, reason, status: 'canceled', tier: reason === 'unknown_tier' ? 'gold' : 'member' }))
    assert.equal(summary.state, 'inactive', reason)
    assert.equal(summary.status, 'Inactive', reason)
    assert.equal(summary.date, null, reason)
    assert.equal(summary.hasSubscription, true, reason)
  }
  assert.equal(describeResearchMembership(accessRow({ hasAccess: false, reason: 'unknown_tier', tier: 'gold' })).plan, null)
  assert.match(describeResearchMembership(accessRow({ hasAccess: false, reason: 'past_due_expired' })).detail, /payment method/)
  assert.equal(describeResearchMembership(accessRow({ hasAccess: false, reason: 'past_due_expired' })).needsPaymentUpdate, true)
  assert.equal(describeResearchMembership(accessRow({ hasAccess: false, reason: 'inactive', status: 'canceled' })).needsPaymentUpdate, false)
})

test('membership: no row, admins and test mode', () => {
  for (const access of [null, undefined, accessRow({ hasAccess: false, reason: 'none', status: null, tier: null, interval: null, currentPeriodEnd: null })]) {
    const summary = describeResearchMembership(access)
    assert.equal(summary.state, 'none')
    assert.equal(summary.status, 'No membership')
    assert.equal(summary.hasSubscription, false)
  }
  const admin = describeResearchMembership(accessRow({ source: 'admin', status: null }))
  assert.equal(admin.state, 'admin')
  assert.equal(admin.status, 'Admin access')
  assert.equal(describeResearchMembership(accessRow({ source: 'test' })).isTest, true)
})

// Testdoubles für resolveResearchWelcomeState: zählen Aufrufe von Rate-Limit und Stripe-Sync.
function welcomeDeps({ isMember = false, sessionId = 'cs_test_1', limited = false, rateLimitError = null, sync } = {}) {
  const calls = { rateLimit: 0, sync: [], errors: [] }
  const params = {
    sessionId,
    isMember,
    consumeRateLimit: async () => {
      calls.rateLimit += 1
      if (rateLimitError) throw rateLimitError
      return { limited }
    },
    sync: async id => {
      calls.sync.push(id)
      return sync ? sync(id) : { status: 'active' }
    },
    isForeignSession: error => error?.code === 'foreign_session',
    onError: (stage, error) => calls.errors.push([stage, error?.message]),
  }
  return { params, calls }
}

test('welcome: members and missing session ids never reach Stripe or the rate limit', async () => {
  for (const sessionId of ['cs_test_1', null]) {
    const { params, calls } = welcomeDeps({ isMember: true, sessionId })
    assert.equal(await resolveResearchWelcomeState(params), 'active')
    assert.equal(calls.rateLimit, 0)
    assert.deepEqual(calls.sync, [])
  }
  const { params, calls } = welcomeDeps({ sessionId: null })
  assert.equal(await resolveResearchWelcomeState(params), 'missing')
  assert.equal(calls.rateLimit, 0)
  assert.deepEqual(calls.sync, [])
})

test('welcome: every sync is rate limited per request; when limited Stripe is not called', async () => {
  const allowed = welcomeDeps()
  assert.equal(await resolveResearchWelcomeState(allowed.params), 'active')
  assert.equal(allowed.calls.rateLimit, 1)
  assert.deepEqual(allowed.calls.sync, ['cs_test_1'])

  const limited = welcomeDeps({ limited: true })
  assert.equal(await resolveResearchWelcomeState(limited.params), 'pending')
  assert.equal(limited.calls.rateLimit, 1)
  assert.deepEqual(limited.calls.sync, [])
  assert.deepEqual(limited.calls.errors, [])

  // Rate-Limit nicht prüfbar (z. B. Datenbank weg): lieber nicht zu Stripe.
  const broken = welcomeDeps({ rateLimitError: new Error('db down') })
  assert.equal(await resolveResearchWelcomeState(broken.params), 'pending')
  assert.deepEqual(broken.calls.sync, [])
  assert.deepEqual(broken.calls.errors, [['rate_limit', 'db down']])
})

test('welcome: sync results map to active / pending / failed', async () => {
  for (const [status, expected] of [['active', 'active'], ['pending', 'pending'], ['failed', 'failed'], ['weird', 'pending']]) {
    const { params } = welcomeDeps({ sync: () => ({ status }) })
    assert.equal(await resolveResearchWelcomeState(params), expected, status)
  }
})

test('welcome: only foreign sessions are failures; transient errors stay pending with a retry', async () => {
  const foreign = welcomeDeps({ sync: () => { throw Object.assign(new Error('foreign'), { code: 'foreign_session' }) } })
  assert.equal(await resolveResearchWelcomeState(foreign.params), 'failed')
  assert.deepEqual(foreign.calls.errors, [])

  for (const error of [
    Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' }),
    Object.assign(new Error('api error'), { type: 'StripeAPIError', statusCode: 500 }),
    Object.assign(new Error('Can\'t reach database server'), { code: 'P1001' }),
  ]) {
    const transient = welcomeDeps({ sync: () => { throw error } })
    assert.equal(await resolveResearchWelcomeState(transient.params), 'pending', error.message)
    assert.deepEqual(transient.calls.errors, [['sync', error.message]])
  }
})

// Lädt eine Research-Client-Komponente (TSX) mit festen Abhängigkeiten; ui.mjs
// und config.mjs sind die echten Module.
async function loadResearchComponent(relativePath, { react = React, globals = {} } = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const deps = {
    react,
    'react/jsx-runtime': jsxRuntime,
    'next/link': { default: ({ href, prefetch, children, ...rest }) => React.createElement('a', { href, ...rest }, children) },
    '@/components/research/icons': { ArrowRight: () => null, ArrowUpRight: () => null, Info: () => null, WarningCircle: () => null },
    '@/components/research/base-path': { useResearchHref: () => hrefFor('/research') },
    '@/lib/research/config.mjs': researchConfig,
    '@/lib/research/ui.mjs': researchUi,
  }
  const exports = {}
  runInNewContext(outputText, { ...globals, exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`)
    return deps[name]
  } })
  return exports
}

// Die Pricing-Seite schickt die Versionen aus RESEARCH_CONSENT_VERSIONS; die
// Checkbox-Labels müssen deshalb exakt die zugehörigen Texte zeigen.
async function renderPricingClient(props) {
  const { ResearchPricingClient } = await loadResearchComponent('../../components/research/pricing-client.tsx')
  return renderToStaticMarkup(React.createElement(ResearchPricingClient, props))
}

const decodeEntities = text => text
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

test('pricing checkboxes render exactly RESEARCH_CONSENT_TEXT (the text the sent versions refer to)', async () => {
  const html = await renderPricingClient({ signedIn: true, initialTier: 'member', initialInterval: 'month', checkoutCancelled: false })
  const labels = [...html.matchAll(/<label class="r-consent">([\s\S]*?)<\/label>/g)].map(([, inner]) => inner)
  assert.equal(labels.length, 2)
  const visibleText = inner => decodeEntities(inner.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '').replace(/<[^>]*>/g, ''))
  assert.deepEqual(labels.map(visibleText), [RESEARCH_CONSENT_TEXT.terms, RESEARCH_CONSENT_TEXT.withdrawalWaiver])
  // Beide Checkboxen starten leer, der Terms-Link zeigt auf die Research-Terms.
  for (const inner of labels) assert.match(inner, /<input type="checkbox"\/>/)
  assert.match(labels[0], /<a href="\/research\/terms" target="_blank" rel="noopener">Terms of Service<span class="sr-only">/)
})

// Minimaler Hook-Ersatz ohne DOM: die Komponente wird als Funktion gerendert,
// State und Refs bleiben zwischen den Renders erhalten, Effekte laufen nicht.
// So lassen sich die echten onChange/onSubmit/onClick-Handler auslösen.
function hookHarness() {
  const slots = []
  let cursor = 0
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useId: () => 'id',
    useEffect: () => {},
  }
  return { react, render: (Component, props) => { cursor = 0; return Component(props) } }
}

function* elements(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* elements(child)
  } else if (node && typeof node === 'object') {
    yield node
    yield* elements(node.props?.children)
  }
}
const findElements = (tree, predicate) => [...elements(tree)].filter(predicate)
const findElement = (tree, predicate) => {
  const [match, ...rest] = findElements(tree, predicate)
  assert.ok(match && rest.length === 0, 'expected exactly one matching element')
  return match
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('')
  : node === null || node === undefined || typeof node === 'boolean' ? ''
    : typeof node === 'object' ? textOf(node.props?.children) : String(node)

// Echte Komponente + echte ui.mjs; nur globalThis.fetch und window.location sind Testdoubles.
async function mountResearchComponent(t, relativePath, exportName, props, respond) {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    requests.push({ input, init, body: JSON.parse(init.body) })
    return respond()
  })
  const assigned = []
  const hooks = hookHarness()
  // fetch auch im Komponenten-Kontext: ein direkter fetch-Aufruf dort landet ebenfalls im Mock.
  const browserFetch = (input, init) => globalThis.fetch(input, init)
  const exports = await loadResearchComponent(relativePath, {
    react: hooks.react,
    globals: { AbortController, fetch: browserFetch, window: { fetch: browserFetch, location: { assign: url => assigned.push(url) } } },
  })
  return { requests, assigned, render: () => hooks.render(exports[exportName], props) }
}

const PRICING_PROPS = { signedIn: true, initialTier: 'supporter', initialInterval: 'year', checkoutCancelled: false }
const mountPricing = (t, respond) =>
  mountResearchComponent(t, '../../components/research/pricing-client.tsx', 'ResearchPricingClient', PRICING_PROPS, respond)

async function confirmAndSubmit(page, { tier } = {}) {
  let tree = page.render()
  if (tier) {
    findElement(tree, el => el.type === 'input' && el.props.name === 'research-tier' && el.props.value === tier).props.onChange()
    tree = page.render()
  }
  const boxes = findElements(tree, el => el.type === 'input' && el.props.type === 'checkbox')
  assert.equal(boxes.length, 2)
  for (const box of boxes) box.props.onChange({ target: { checked: true } })
  await findElement(page.render(), el => el.type === 'form').props.onSubmit({ preventDefault() {} })
  return page.render()
}

test('pricing page: submitting sends the selected plan with the rendered consent text versions, then opens Stripe', async t => {
  const page = await mountPricing(t, () => jsonResponse(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }))

  // Ohne beide Häkchen geht nichts raus.
  await findElement(page.render(), el => el.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(page.requests.length, 0)

  await confirmAndSubmit(page, { tier: 'reader' })
  assert.equal(page.requests.length, 1)
  const [{ input, init, body }] = page.requests
  assert.equal(input, '/api/research/checkout')
  assert.equal(init.method, 'POST')
  assert.deepEqual(body, researchCheckoutRequestBody('reader', 'year'))
  assert.equal(body.termsVersion, RESEARCH_CONSENT_VERSIONS.terms)
  assert.equal(body.withdrawalWaiverVersion, RESEARCH_CONSENT_VERSIONS.withdrawalWaiver)
  assert.deepEqual(page.assigned, ['https://checkout.stripe.com/c/pay/cs_test_1'])
})

test('pricing page: a 429 shows the wait from Retry-After and re-enables the button', async t => {
  const withHeader = await mountPricing(t, () => jsonResponse(429, { code: 'rate_limited', message: 'x' }, { 'Retry-After': '1234' }))
  const tree = await confirmAndSubmit(withHeader)
  assert.equal(textOf(findElement(tree, el => el.props?.role === 'alert')), 'Too many attempts. Please try again in about 21 minutes.')
  assert.equal(findElement(tree, el => el.type === 'button' && el.props.type === 'submit').props.disabled, false)
  assert.deepEqual(withHeader.assigned, [])

  const withoutHeader = await mountPricing(t, () => jsonResponse(429, { code: 'rate_limited' }))
  assert.equal(textOf(findElement(await confirmAndSubmit(withoutHeader), el => el.props?.role === 'alert')), 'Too many attempts. Please try again later.')
})

test('pricing page: consent_outdated offers a full reload of the same plan', async t => {
  const page = await mountPricing(t, () => jsonResponse(409, { code: 'consent_outdated', message: 'server text' }))
  const tree = await confirmAndSubmit(page)
  assert.match(textOf(findElement(tree, el => el.props?.role === 'alert')), /terms were updated/)
  findElement(tree, el => el.type === 'button' && textOf(el).includes('Reload page')).props.onClick()
  assert.deepEqual(page.assigned, ['/research/pricing?tier=supporter&interval=year'])
})

const mountBilling = (t, respond) =>
  mountResearchComponent(t, '../../components/research/manage-billing-button.tsx', 'ManageBillingButton', {}, respond)

test('billing button: opens the portal via POST /api/research/portal', async t => {
  const button = await mountBilling(t, () => jsonResponse(200, { url: 'https://billing.stripe.com/p/session/test_1' }))
  await findElement(button.render(), el => el.type === 'button').props.onClick()
  assert.equal(button.requests.length, 1)
  assert.equal(button.requests[0].input, '/api/research/portal')
  assert.equal(button.requests[0].init.method, 'POST')
  assert.deepEqual(button.requests[0].body, {})
  assert.deepEqual(button.assigned, ['https://billing.stripe.com/p/session/test_1'])
})

test('billing button: Retry-After wait on 429, and a kill-switch 404 is not "no subscription"', async t => {
  const cases = [
    [() => jsonResponse(429, { code: 'rate_limited' }, { 'Retry-After': '1234' }), 'Too many attempts. Please try again in about 21 minutes.'],
    [() => jsonResponse(429, { code: 'rate_limited' }), 'Too many attempts. Please try again later.'],
    [() => jsonResponse(404, { code: 'not_found' }), GENERIC_PORTAL_ERROR],
    [() => new Response('Not found', { status: 404 }), GENERIC_PORTAL_ERROR],
    [() => jsonResponse(404, { code: 'no_customer' }), 'No subscription found yet.'],
  ]
  for (const [respond, message] of cases) {
    const button = await mountBilling(t, respond)
    await findElement(button.render(), el => el.type === 'button').props.onClick()
    const tree = button.render()
    assert.equal(textOf(findElement(tree, el => el.props?.role === 'alert')), message)
    assert.equal(findElement(tree, el => el.type === 'button').props.disabled, false)
    assert.deepEqual(button.assigned, [])
  }
})
