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
  researchAuthUrls,
  researchCheckoutError,
  researchIntervalLabel,
  researchPlanPrice,
  researchPortalError,
  researchSignInHref,
  resolveResearchWelcomeState,
  safeResearchRedirectPath,
  splitTermsLink,
} from './ui.mjs'
import { RESEARCH_CONSENT_TEXT, RESEARCH_TIERS } from './config.mjs'

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
  assert.match(researchCheckoutError('rate_limited', 'server text').message, /Too many checkout attempts/)
  assert.match(researchCheckoutError(undefined, 'server text').message, /could not be started/)
})

test('checkout and portal errors map to calm messages', () => {
  assert.equal(researchCheckoutError('already_subscribed').action, 'account')
  assert.equal(researchCheckoutError('signed_out').action, 'sign-in')
  assert.match(researchCheckoutError('consent_required').message, /confirm both/)
  assert.match(researchCheckoutError('rate_limited').message, /wait/)
  assert.equal(researchCheckoutError(undefined).action, null)
  assert.match(researchCheckoutError('checkout_failed').message, /could not be started/)
  assert.equal(researchPortalError(404, 'no_customer'), 'No subscription found yet.')
  assert.equal(researchPortalError(500, 'no_customer'), 'No subscription found yet.')
  assert.match(researchPortalError(401, 'signed_out'), /sign in again/)
  assert.match(researchPortalError(429, 'rate_limited'), /wait/)
  assert.match(researchPortalError(500, 'portal_failed'), /could not be opened/)
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
