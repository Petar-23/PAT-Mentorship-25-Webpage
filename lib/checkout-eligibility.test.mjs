import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decideDashboardView,
  findCheckoutBlockingSubscription,
  hasPeriodEnded,
  subscriptionAllowsNewCheckout,
} from './checkout-eligibility.mjs'

const NOW = Date.parse('2026-09-25T12:00:00Z')
const FUTURE = '2026-10-25T12:00:00.000Z'
const PAST = '2026-08-25T12:00:00.000Z'

function details(status, currentPeriodEnd = FUTURE) {
  return {
    status,
    startDate: '2026-03-01T00:00:00.000Z',
    isPending: status === 'incomplete',
    isCanceled: status === 'canceled',
    cancelAt: null,
    currentPeriodEnd,
  }
}

function decide(status, { currentPeriodEnd = FUTURE, hasActiveSubscription = false, isAdmin = false } = {}) {
  return decideDashboardView({
    hasActiveSubscription,
    subscriptionDetails: status === null ? null : details(status, currentPeriodEnd),
    isAdmin,
    now: NOW,
  })
}

test('no subscription at all leads to checkout', () => {
  assert.deepEqual(decide(null), { view: 'checkout', notice: null, reason: 'no-subscription' })
  assert.equal(decideDashboardView({ hasActiveSubscription: false, subscriptionDetails: undefined, now: NOW }).view, 'checkout')
})

test('canceled members can buy again', () => {
  assert.deepEqual(decide('canceled'), { view: 'checkout', notice: null, reason: 'subscription-ended' })
  assert.equal(decide('canceled', { currentPeriodEnd: PAST }).view, 'checkout')
  assert.equal(decide('canceled', { currentPeriodEnd: null }).view, 'checkout')
})

test('incomplete_expired can buy again, without the returning member wording', () => {
  // Die Erstzahlung kam nie zustande: Checkout ja, aber kein „Willkommen zurück“.
  assert.deepEqual(decide('incomplete_expired'), { view: 'checkout', notice: null, reason: 'payment-expired' })
  assert.equal(decide('incomplete_expired', { currentPeriodEnd: PAST }).reason, 'payment-expired')
})

test('DB cache status none counts as no subscription', () => {
  assert.equal(decide('none').view, 'checkout')
})

test('active and trialing with an expired paid period lead to checkout', () => {
  assert.deepEqual(decide('active', { currentPeriodEnd: PAST }), { view: 'checkout', notice: null, reason: 'period-ended' })
  assert.deepEqual(decide('trialing', { currentPeriodEnd: PAST }), { view: 'checkout', notice: null, reason: 'period-ended' })
})

test('past_due stays in the member view with a payment notice, even after the period ended', () => {
  assert.deepEqual(decide('past_due'), { view: 'member', notice: 'payment-due', reason: 'payment-due' })
  assert.deepEqual(decide('past_due', { currentPeriodEnd: PAST }), { view: 'member', notice: 'payment-due', reason: 'payment-due' })
})

test('unpaid stays in the member view with a payment notice, even after the period ended', () => {
  assert.deepEqual(decide('unpaid'), { view: 'member', notice: 'payment-due', reason: 'payment-due' })
  assert.deepEqual(decide('unpaid', { currentPeriodEnd: PAST }), { view: 'member', notice: 'payment-due', reason: 'payment-due' })
})

test('incomplete shows the payment processing notice and never checkout', () => {
  assert.deepEqual(decide('incomplete'), { view: 'member', notice: 'payment-processing', reason: 'payment-processing' })
  assert.equal(decide('incomplete', { currentPeriodEnd: PAST }).view, 'member')
})

test('active access is always the plain member view (Stripe, PayPal legacy, override)', () => {
  // PayPal-Altvertrag und Override-E-Mail kommen als aktiver Snapshot ohne Periodenende an.
  assert.deepEqual(decide('active', { hasActiveSubscription: true, currentPeriodEnd: null }), {
    view: 'member',
    notice: null,
    reason: 'active-access',
  })
  assert.equal(decide('trialing', { hasActiveSubscription: true }).view, 'member')
  // Selbst widersprüchliche Daten öffnen keinen Checkout, solange der Zugang aktiv ist.
  assert.equal(decide('canceled', { hasActiveSubscription: true, currentPeriodEnd: PAST }).view, 'member')
})

test('running period without access keeps the member view (no double subscription)', () => {
  // trialing mit geplanter Kündigung oder aktives Abo mit fremder Preis-ID
  assert.deepEqual(decide('trialing'), { view: 'member', notice: null, reason: 'subscription-running' })
  assert.deepEqual(decide('active'), { view: 'member', notice: null, reason: 'subscription-running' })
  assert.deepEqual(decide('active', { currentPeriodEnd: null }), { view: 'member', notice: null, reason: 'subscription-running' })
})

test('admins keep their previous member view instead of the checkout', () => {
  assert.deepEqual(decide('canceled', { isAdmin: true }), { view: 'member', notice: null, reason: 'admin-keeps-member-view' })
  assert.equal(decide('active', { isAdmin: true, currentPeriodEnd: PAST }).view, 'member')
  // Ohne Abo-Daten bekam auch ein Admin bisher die Kaufansicht.
  assert.equal(decide(null, { isAdmin: true }).view, 'checkout')
  assert.equal(decide('past_due', { isAdmin: true }).notice, 'payment-due')
})

test('period end parsing accepts ISO strings, Date and milliseconds and treats unknown as running', () => {
  assert.equal(hasPeriodEnded(PAST, NOW), true)
  assert.equal(hasPeriodEnded(new Date(PAST), NOW), true)
  assert.equal(hasPeriodEnded(Date.parse(PAST), NOW), true)
  assert.equal(hasPeriodEnded(FUTURE, NOW), false)
  assert.equal(hasPeriodEnded(null, NOW), false)
  assert.equal(hasPeriodEnded('kein Datum', NOW), false)
  assert.equal(hasPeriodEnded(NOW, NOW), true, 'die Periode endet genau zum Endzeitpunkt')
})

test('checkout rule and server guard block while a mentorship subscription is still running or owed', () => {
  const blocking = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']
  for (const status of blocking) {
    assert.equal(subscriptionAllowsNewCheckout({ status, currentPeriodEnd: FUTURE }, NOW), false, status)
  }
  for (const status of ['canceled', 'incomplete_expired']) {
    assert.equal(subscriptionAllowsNewCheckout({ status, currentPeriodEnd: FUTURE }, NOW), true, status)
  }

  const subs = [
    { id: 'sub_old', status: 'canceled', currentPeriodEnd: PAST },
    { id: 'sub_due', status: 'past_due', currentPeriodEnd: PAST },
  ]
  assert.equal(findCheckoutBlockingSubscription(subs)?.id, 'sub_due')
  assert.equal(findCheckoutBlockingSubscription([subs[0]]), null)
  assert.equal(findCheckoutBlockingSubscription([]), null)
  assert.equal(findCheckoutBlockingSubscription([{ id: 'sub_x', status: 'incomplete_expired' }]), null)
})

test('server guard trusts the fresh Stripe status over a stale period end', () => {
  // Stripe führt das Abo noch als aktiv: Es wird weiter berechnet, ein zweiter Checkout wäre ein Doppelabo.
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']) {
    assert.equal(findCheckoutBlockingSubscription([{ id: 'sub_1', status, currentPeriodEnd: PAST }])?.id, 'sub_1', status)
  }
  // Pausierte Abos (Trial ohne Zahlungsmethode) rechnen nicht ab und sperren den Neukauf nicht.
  assert.equal(findCheckoutBlockingSubscription([{ id: 'sub_p', status: 'paused', currentPeriodEnd: PAST }]), null)
})
