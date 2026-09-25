import test from 'node:test'
import assert from 'node:assert/strict'

import { RESEARCH_ACCESS_REASONS, RESEARCH_RENEWAL_LEEWAY_MS, computeResearchAccess } from './access-rules.mjs'
import { RESEARCH_PAST_DUE_GRACE_MS } from './config.mjs'

const NOW = Date.parse('2026-09-25T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function row(overrides = {}) {
  return {
    status: 'active',
    tier: 'member',
    billingInterval: 'month',
    cancelAtPeriodEnd: false,
    cancelAt: null,
    currentPeriodEnd: new Date(NOW + 20 * DAY),
    pastDueSince: null,
    updatedAt: new Date(NOW - DAY),
    ...overrides,
  }
}

test('grace period is 72 hours', () => {
  assert.equal(RESEARCH_PAST_DUE_GRACE_MS, 72 * HOUR)
})

test('no row means no access with an empty, serialisable state', () => {
  for (const missing of [null, undefined]) {
    assert.deepEqual(computeResearchAccess(missing, NOW), {
      hasAccess: false,
      reason: 'none',
      status: null,
      tier: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      graceEndsAt: null,
    })
  }
})

test('active subscription within the period grants access and reports ISO dates', () => {
  const cancelAt = new Date(NOW + 20 * DAY)
  const result = computeResearchAccess(row({ cancelAtPeriodEnd: true, cancelAt, tier: 'supporter', billingInterval: 'year' }), NOW)
  assert.deepEqual(result, {
    hasAccess: true,
    reason: 'active',
    status: 'active',
    tier: 'supporter',
    interval: 'year',
    currentPeriodEnd: new Date(NOW + 20 * DAY).toISOString(),
    cancelAtPeriodEnd: true,
    cancelAt: cancelAt.toISOString(),
    graceEndsAt: null,
  })
  assert.doesNotThrow(() => JSON.stringify(result))
})

test('trialing within the period grants access', () => {
  const result = computeResearchAccess(row({ status: 'trialing' }), NOW)
  assert.equal(result.hasAccess, true)
  assert.equal(result.reason, 'trialing')
})

test('every research tier grants the same access', () => {
  for (const tier of ['reader', 'member', 'supporter']) {
    for (const billingInterval of ['month', 'year']) {
      const result = computeResearchAccess(row({ tier, billingInterval }), NOW)
      assert.equal(result.hasAccess, true, `${tier}/${billingInterval}`)
      assert.equal(result.tier, tier)
      assert.equal(result.interval, billingInterval)
    }
  }
})

test('unknown or missing tier never grants access, even when active', () => {
  for (const tier of [null, undefined, '', 'monthly', 'annual', 'MEMBER', 'admin', 42]) {
    const result = computeResearchAccess(row({ tier }), NOW)
    assert.equal(result.hasAccess, false, String(tier))
    assert.equal(result.reason, 'unknown_tier')
    assert.equal(result.tier, null)
  }
})

test('unknown tier takes precedence over an ended period', () => {
  const result = computeResearchAccess(row({ tier: 'gold', currentPeriodEnd: new Date(NOW - DAY) }), NOW)
  assert.equal(result.reason, 'unknown_tier')
})

test('an unknown interval does not block access but is reported as null', () => {
  const result = computeResearchAccess(row({ billingInterval: 'week' }), NOW)
  assert.equal(result.hasAccess, true)
  assert.equal(result.interval, null)
})

test('missing or invalid period end never grants access, whatever the status', () => {
  for (const status of ['active', 'trialing', 'past_due', 'canceled']) {
    for (const currentPeriodEnd of [null, undefined, new Date(Number.NaN), 'not a date', '']) {
      const result = computeResearchAccess(row({ status, currentPeriodEnd, pastDueSince: new Date(NOW) }), NOW)
      assert.equal(result.hasAccess, false, `${status}/${String(currentPeriodEnd)}`)
      assert.equal(result.reason, 'period_ended')
      assert.equal(result.currentPeriodEnd, null)
    }
  }
})

test('renewal leeway is 24 hours and shorter than the past_due grace', () => {
  assert.equal(RESEARCH_RENEWAL_LEEWAY_MS, 24 * HOUR)
  assert.ok(RESEARCH_RENEWAL_LEEWAY_MS < RESEARCH_PAST_DUE_GRACE_MS)
})

test('period end boundary: a subscription that does not renew loses access exactly at currentPeriodEnd', () => {
  const ending = { cancelAtPeriodEnd: true }
  assert.equal(computeResearchAccess(row({ ...ending, currentPeriodEnd: new Date(NOW + 1) }), NOW).hasAccess, true)
  const atEnd = computeResearchAccess(row({ ...ending, currentPeriodEnd: new Date(NOW) }), NOW)
  assert.equal(atEnd.hasAccess, false)
  assert.equal(atEnd.reason, 'period_ended')
  const afterEnd = computeResearchAccess(row({ ...ending, currentPeriodEnd: new Date(NOW - 1) }), NOW)
  assert.equal(afterEnd.reason, 'period_ended')
})

test('renewal: a stale active row keeps access right after the renewal instant (webhook pending)', () => {
  // Stripe hat um 12:00 verlängert, customer.subscription.updated ist noch
  // nicht verarbeitet: der Cache hat noch das alte Periodenende.
  for (const status of ['active', 'trialing']) {
    const justBefore = computeResearchAccess(row({ status, currentPeriodEnd: new Date(NOW + 1) }), NOW)
    assert.equal(justBefore.reason, status)

    for (const periodEnd of [NOW, NOW - 1, NOW - HOUR, NOW - RESEARCH_RENEWAL_LEEWAY_MS + 1]) {
      const result = computeResearchAccess(row({ status, currentPeriodEnd: new Date(periodEnd) }), NOW)
      assert.equal(result.hasAccess, true, `${status} ended ${NOW - periodEnd} ms ago`)
      assert.equal(result.reason, 'renewal_pending')
      assert.equal(result.status, status)
      assert.equal(result.currentPeriodEnd, new Date(periodEnd).toISOString())
      assert.equal(result.graceEndsAt, null)
    }
  }
})

test('renewal leeway boundary is exclusive (24 h after currentPeriodEnd)', () => {
  const periodEnd = new Date(NOW - RESEARCH_RENEWAL_LEEWAY_MS)
  const atEnd = computeResearchAccess(row({ currentPeriodEnd: periodEnd }), NOW)
  assert.equal(atEnd.hasAccess, false)
  assert.equal(atEnd.reason, 'period_ended')
  assert.equal(atEnd.status, 'active')

  const justInside = computeResearchAccess(row({ currentPeriodEnd: periodEnd }), NOW - 1)
  assert.equal(justInside.reason, 'renewal_pending')

  const longAgo = computeResearchAccess(row({ currentPeriodEnd: new Date(NOW - 3 * DAY) }), NOW)
  assert.equal(longAgo.reason, 'period_ended')
})

test('renewal leeway never applies to subscriptions that end or are not in good standing', () => {
  const ended = new Date(NOW - HOUR)
  const cases = [
    { cancelAtPeriodEnd: true },
    { cancelAtPeriodEnd: true, cancelAt: ended },
    { cancelAt: ended },
    { cancelAt: new Date(ended.getTime() - DAY) },
    { cancelAt: new Date(NOW) }, // Kündigung zwischen Periodenende und jetzt
    { cancelAt: 'not a date' }, // ungültig → fail closed
    { cancelAtPeriodEnd: null }, // unbekannt → fail closed
    { cancelAtPeriodEnd: undefined },
    { status: 'past_due', pastDueSince: new Date(NOW - HOUR) },
    { status: 'canceled' },
    { status: 'unpaid' },
    { status: 'incomplete' },
    { status: 'paused' },
  ]
  for (const overrides of cases) {
    const result = computeResearchAccess(row({ currentPeriodEnd: ended, ...overrides }), NOW)
    assert.equal(result.hasAccess, false, JSON.stringify(overrides))
    assert.equal(result.reason, 'period_ended', JSON.stringify(overrides))
  }
})

test('renewal leeway ends at a future cancelAt that falls inside it', () => {
  const periodEnd = new Date(NOW - HOUR)
  const cancelAt = new Date(NOW + HOUR)
  const before = computeResearchAccess(row({ currentPeriodEnd: periodEnd, cancelAt }), NOW)
  assert.equal(before.reason, 'renewal_pending')
  assert.equal(before.cancelAt, cancelAt.toISOString())

  const atCancel = computeResearchAccess(row({ currentPeriodEnd: periodEnd, cancelAt }), cancelAt.getTime())
  assert.equal(atCancel.hasAccess, false)
  assert.equal(atCancel.reason, 'period_ended')

  // cancelAt weit nach der Karenz begrenzt nichts.
  const farCancel = computeResearchAccess(row({ currentPeriodEnd: periodEnd, cancelAt: new Date(NOW + 30 * DAY) }), NOW)
  assert.equal(farCancel.reason, 'renewal_pending')
})

test('past_due grants access for 72 hours from pastDueSince', () => {
  const pastDueSince = new Date(NOW - 10 * HOUR)
  const result = computeResearchAccess(row({ status: 'past_due', pastDueSince }), NOW)
  assert.equal(result.hasAccess, true)
  assert.equal(result.reason, 'past_due_grace')
  assert.equal(result.graceEndsAt, new Date(pastDueSince.getTime() + 72 * HOUR).toISOString())
})

test('past_due grace boundary is exclusive', () => {
  const justInside = computeResearchAccess(row({ status: 'past_due', pastDueSince: new Date(NOW - 72 * HOUR + 1) }), NOW)
  assert.equal(justInside.reason, 'past_due_grace')
  assert.equal(justInside.hasAccess, true)

  const exactlyAtEnd = computeResearchAccess(row({ status: 'past_due', pastDueSince: new Date(NOW - 72 * HOUR) }), NOW)
  assert.equal(exactlyAtEnd.reason, 'past_due_expired')
  assert.equal(exactlyAtEnd.hasAccess, false)
  assert.equal(exactlyAtEnd.graceEndsAt, new Date(NOW).toISOString())

  const longAgo = computeResearchAccess(row({ status: 'past_due', pastDueSince: new Date(NOW - 10 * DAY) }), NOW)
  assert.equal(longAgo.reason, 'past_due_expired')
})

test('past_due falls back to updatedAt when pastDueSince is missing', () => {
  const inGrace = computeResearchAccess(row({ status: 'past_due', pastDueSince: null, updatedAt: new Date(NOW - HOUR) }), NOW)
  assert.equal(inGrace.reason, 'past_due_grace')
  assert.equal(inGrace.graceEndsAt, new Date(NOW - HOUR + 72 * HOUR).toISOString())

  const expired = computeResearchAccess(row({ status: 'past_due', pastDueSince: null, updatedAt: new Date(NOW - 73 * HOUR) }), NOW)
  assert.equal(expired.reason, 'past_due_expired')
})

test('pastDueSince wins over a newer updatedAt (repeated webhooks do not extend grace)', () => {
  const result = computeResearchAccess(
    row({ status: 'past_due', pastDueSince: new Date(NOW - 80 * HOUR), updatedAt: new Date(NOW - 1000) }),
    NOW
  )
  assert.equal(result.reason, 'past_due_expired')
  assert.equal(result.hasAccess, false)
})

test('past_due without any timestamp fails closed', () => {
  const result = computeResearchAccess(row({ status: 'past_due', pastDueSince: null, updatedAt: undefined }), NOW)
  assert.equal(result.hasAccess, false)
  assert.equal(result.reason, 'past_due_expired')
  assert.equal(result.graceEndsAt, null)
})

test('past_due grace never outlives the period end', () => {
  const periodEnd = new Date(NOW + 5 * HOUR)
  const result = computeResearchAccess(
    row({ status: 'past_due', pastDueSince: new Date(NOW - HOUR), currentPeriodEnd: periodEnd }),
    NOW
  )
  assert.equal(result.reason, 'past_due_grace')
  assert.equal(result.graceEndsAt, periodEnd.toISOString())

  const ended = computeResearchAccess(
    row({ status: 'past_due', pastDueSince: new Date(NOW - HOUR), currentPeriodEnd: new Date(NOW) }),
    NOW
  )
  assert.equal(ended.reason, 'period_ended')
  assert.equal(ended.hasAccess, false)
})

test('graceEndsAt is only reported for past_due', () => {
  for (const status of ['active', 'trialing', 'canceled', 'unpaid']) {
    assert.equal(computeResearchAccess(row({ status, pastDueSince: new Date(NOW - HOUR) }), NOW).graceEndsAt, null, status)
  }
})

test('every other status is inactive, even with a future period end', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'ended', 'ACTIVE', '', 'something_new']) {
    const result = computeResearchAccess(row({ status }), NOW)
    assert.equal(result.hasAccess, false, status)
    assert.equal(result.reason, 'inactive', status)
  }
})

test('empty status is reported as null', () => {
  assert.equal(computeResearchAccess(row({ status: '' }), NOW).status, null)
})

test('accepts ISO strings and epoch milliseconds for instants', () => {
  const asString = computeResearchAccess(
    row({ currentPeriodEnd: new Date(NOW + DAY).toISOString(), cancelAt: new Date(NOW + DAY).toISOString() }),
    NOW
  )
  assert.equal(asString.hasAccess, true)
  assert.equal(asString.cancelAt, new Date(NOW + DAY).toISOString())

  const asNumber = computeResearchAccess(row({ status: 'past_due', pastDueSince: NOW - HOUR, currentPeriodEnd: NOW + DAY }), NOW)
  assert.equal(asNumber.reason, 'past_due_grace')
})

test('rows without updatedAt (freshly mapped Stripe rows) are supported', () => {
  const { updatedAt: _ignored, ...incoming } = row({ status: 'past_due', pastDueSince: new Date(NOW) })
  assert.equal(computeResearchAccess(incoming, NOW).reason, 'past_due_grace')
})

test('cancelAtPeriodEnd is strictly boolean', () => {
  assert.equal(computeResearchAccess(row({ cancelAtPeriodEnd: null }), NOW).cancelAtPeriodEnd, false)
  assert.equal(computeResearchAccess(row({ cancelAtPeriodEnd: 'true' }), NOW).cancelAtPeriodEnd, false)
  assert.equal(computeResearchAccess(row({ cancelAtPeriodEnd: true }), NOW).cancelAtPeriodEnd, true)
})

test('defaults to the current time and rejects invalid instants', () => {
  assert.equal(computeResearchAccess(row({ currentPeriodEnd: new Date(Date.now() + DAY) })).hasAccess, true)
  assert.equal(computeResearchAccess(row({ currentPeriodEnd: new Date(Date.now() - 2 * DAY) })).hasAccess, false)
  assert.equal(computeResearchAccess(row({ currentPeriodEnd: new Date(Date.now() - HOUR) })).reason, 'renewal_pending')
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, '2026-09-25', null]) {
    assert.throws(() => computeResearchAccess(row(), invalid), TypeError)
  }
})

test('the reason list is exhaustive and access is granted only for granting reasons', () => {
  const seen = new Set()
  const cases = [
    null,
    row({ tier: 'x' }),
    row({ currentPeriodEnd: null }),
    row(),
    row({ status: 'trialing' }),
    row({ currentPeriodEnd: new Date(NOW - HOUR) }),
    row({ status: 'past_due', pastDueSince: new Date(NOW) }),
    row({ status: 'past_due', pastDueSince: new Date(NOW - 100 * HOUR) }),
    row({ status: 'canceled' }),
  ]
  for (const input of cases) {
    const result = computeResearchAccess(input, NOW)
    seen.add(result.reason)
    assert.equal(result.hasAccess, ['active', 'trialing', 'renewal_pending', 'past_due_grace'].includes(result.reason))
  }
  assert.deepEqual([...seen].sort(), [...RESEARCH_ACCESS_REASONS].sort())
})
