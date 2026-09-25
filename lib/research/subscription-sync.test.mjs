import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RESEARCH_OPEN_SUBSCRIPTION_STATUSES,
  findOpenResearchSubscription,
  mapStripeSubscriptionToResearchRow,
  pickResearchFallbackSubscription,
  resolveResearchSubscriptionPrice,
  shouldReplaceResearchSubscription,
} from './subscription-sync.mjs'
import { RESEARCH_PAST_DUE_GRACE_MS } from './config.mjs'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-10-01T12:00:00.000Z')
const NOW_S = Math.floor(NOW / 1000)

const ENV = Object.freeze({
  STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY: 'price_reader_m',
  STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL: 'price_reader_y',
  STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY: 'price_member_m',
  STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL: 'price_member_y',
  STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY: 'price_supporter_m',
  STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL: ' price_supporter_y ',
  STRIPE_RESEARCH_PRODUCT_ID: 'prod_research',
})

function subscription(overrides = {}) {
  const { price, itemPeriodEnd, metadata, ...rest } = overrides
  return {
    id: 'sub_new',
    status: 'active',
    customer: 'cus_research',
    created: NOW_S - 10 * 24 * 3600,
    cancel_at_period_end: false,
    cancel_at: null,
    current_period_end: NOW_S + 20 * 24 * 3600,
    metadata: metadata === undefined ? { userId: 'user_abc', product: 'research', tier: 'member', interval: 'month' } : metadata,
    items: {
      data: [
        {
          price: price === undefined ? { id: 'price_member_m', product: 'prod_research', metadata: {} } : price,
          ...(itemPeriodEnd === undefined ? {} : { current_period_end: itemPeriodEnd }),
        },
      ],
    },
    ...rest,
  }
}

function map(sub, existing = null, nowMs = NOW) {
  return mapStripeSubscriptionToResearchRow(sub, { env: ENV, nowMs, existing })
}

function mappedRow(sub, existing = null, nowMs = NOW) {
  const result = map(sub, existing, nowMs)
  assert.equal(result.ok, true, `expected mapping to succeed, got ${JSON.stringify(result)}`)
  return result.row
}

// Simuliert das Speichern (Prisma liefert zusätzlich updatedAt).
function stored(row, updatedAt = new Date(NOW)) {
  return { ...row, updatedAt }
}

test('configured prices map to tier and interval (all six, env values are trimmed)', () => {
  const cases = [
    ['price_reader_m', 'reader', 'month'],
    ['price_reader_y', 'reader', 'year'],
    ['price_member_m', 'member', 'month'],
    ['price_member_y', 'member', 'year'],
    ['price_supporter_m', 'supporter', 'month'],
    ['price_supporter_y', 'supporter', 'year'],
  ]
  for (const [priceId, tier, interval] of cases) {
    assert.deepEqual(resolveResearchSubscriptionPrice(subscription({ price: { id: priceId, product: 'prod_other' } }), ENV), {
      priceId,
      tier,
      interval,
    })
    // Price kann auch nur als ID-String vorliegen.
    assert.deepEqual(resolveResearchSubscriptionPrice(subscription({ price: priceId }), ENV), { priceId, tier, interval })
  }
})

test('rotated prices of the research product fall back to price metadata', () => {
  const rotated = { id: 'price_rotated', product: 'prod_research', metadata: { research_tier: 'supporter', research_interval: 'year' } }
  assert.deepEqual(resolveResearchSubscriptionPrice(subscription({ price: rotated }), ENV), {
    priceId: 'price_rotated',
    tier: 'supporter',
    interval: 'year',
  })
  // Produkt als expandiertes Objekt
  assert.deepEqual(
    resolveResearchSubscriptionPrice(subscription({ price: { ...rotated, product: { id: 'prod_research', name: 'PAT Research' } } }), ENV),
    { priceId: 'price_rotated', tier: 'supporter', interval: 'year' }
  )
})

test('unknown prices never resolve: foreign product, invalid metadata, missing product env, missing price', () => {
  const meta = { research_tier: 'member', research_interval: 'month' }
  const unknown = [
    subscription({ price: { id: 'price_x', product: 'prod_mentorship', metadata: meta } }),
    subscription({ price: { id: 'price_x', product: 'prod_research', metadata: { research_tier: 'gold', research_interval: 'month' } } }),
    subscription({ price: { id: 'price_x', product: 'prod_research', metadata: { research_tier: 'member', research_interval: 'week' } } }),
    subscription({ price: { id: 'price_x', product: 'prod_research', metadata: null } }),
    subscription({ price: { id: 'price_x', product: null, metadata: meta } }),
    subscription({ price: 'price_x' }),
    subscription({ price: null }),
    { ...subscription(), items: { data: [] } },
    { ...subscription(), items: null },
  ]
  for (const sub of unknown) assert.equal(resolveResearchSubscriptionPrice(sub, ENV), null)

  const withoutProductEnv = { ...ENV, STRIPE_RESEARCH_PRODUCT_ID: undefined }
  assert.equal(
    resolveResearchSubscriptionPrice(subscription({ price: { id: 'price_x', product: 'prod_research', metadata: meta } }), withoutProductEnv),
    null
  )
  assert.equal(
    resolveResearchSubscriptionPrice(subscription({ price: { id: 'price_x', product: '', metadata: meta } }), { ...ENV, STRIPE_RESEARCH_PRODUCT_ID: '' }),
    null
  )
})

test('maps every column exactly', () => {
  const sub = subscription({ cancel_at_period_end: true, cancel_at: NOW_S + 3600, customer: { id: 'cus_obj' } })
  const result = map(sub)
  assert.deepEqual(result, {
    ok: true,
    userId: 'user_abc',
    row: {
      stripeCustomerId: 'cus_obj',
      stripeSubscriptionId: 'sub_new',
      status: 'active',
      tier: 'member',
      billingInterval: 'month',
      priceId: 'price_member_m',
      cancelAtPeriodEnd: true,
      cancelAt: new Date((NOW_S + 3600) * 1000),
      currentPeriodEnd: new Date((NOW_S + 20 * 24 * 3600) * 1000),
      pastDueSince: null,
      stripeCreatedAt: new Date((NOW_S - 10 * 24 * 3600) * 1000),
    },
  })
  assert.deepEqual(Object.keys(result.row).sort(), [
    'billingInterval',
    'cancelAt',
    'cancelAtPeriodEnd',
    'currentPeriodEnd',
    'pastDueSince',
    'priceId',
    'status',
    'stripeCreatedAt',
    'stripeCustomerId',
    'stripeSubscriptionId',
    'tier',
  ])
})

test('unknown price is stored with tier null (and therefore grants no access)', () => {
  const row = mappedRow(subscription({ price: { id: 'price_unknown', product: 'prod_other', metadata: {} } }))
  assert.equal(row.tier, null)
  assert.equal(row.billingInterval, null)
  assert.equal(row.priceId, 'price_unknown')
})

test('current period end falls back to the first item (newer API versions)', () => {
  const itemEnd = NOW_S + 5 * 24 * 3600
  assert.deepEqual(mappedRow(subscription({ current_period_end: undefined, itemPeriodEnd: itemEnd })).currentPeriodEnd, new Date(itemEnd * 1000))
  assert.deepEqual(mappedRow(subscription({ current_period_end: null, itemPeriodEnd: itemEnd })).currentPeriodEnd, new Date(itemEnd * 1000))
  // Subscription-Feld hat Vorrang
  assert.deepEqual(mappedRow(subscription({ itemPeriodEnd: itemEnd })).currentPeriodEnd, new Date((NOW_S + 20 * 24 * 3600) * 1000))
  assert.equal(mappedRow(subscription({ current_period_end: undefined })).currentPeriodEnd, null)
  assert.equal(mappedRow(subscription({ current_period_end: 0, created: 0, cancel_at: Number.NaN })).currentPeriodEnd, null)
})

test('status matrix: every Stripe status is stored as-is; only past_due sets pastDueSince', () => {
  for (const status of ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
    const row = mappedRow(subscription({ status }))
    assert.equal(row.status, status)
    assert.deepEqual(row.pastDueSince, status === 'past_due' ? new Date(NOW) : null, status)
  }
})

test('past_due timestamps are preserved across repeated events of the same subscription', () => {
  const first = mappedRow(subscription({ status: 'past_due' }))
  assert.deepEqual(first.pastDueSince, new Date(NOW))

  // Wiederholte past_due-Events (z. B. weitere Zahlungsversuche) verlängern die Kulanz nicht.
  const later = NOW + 30 * HOUR
  const second = mappedRow(subscription({ status: 'past_due' }), stored(first), later)
  assert.deepEqual(second.pastDueSince, new Date(NOW))
  const third = mappedRow(subscription({ status: 'past_due' }), stored(second), later + 30 * HOUR)
  assert.deepEqual(third.pastDueSince, new Date(NOW))

  // Nach erfolgreicher Zahlung wieder null …
  const recovered = mappedRow(subscription({ status: 'active' }), stored(third), later + 31 * HOUR)
  assert.equal(recovered.pastDueSince, null)
  // … und ein neuer Fehlschlag startet eine neue Kulanz.
  const again = mappedRow(subscription({ status: 'past_due' }), stored(recovered), later + 40 * HOUR)
  assert.deepEqual(again.pastDueSince, new Date(later + 40 * HOUR))
})

test('past_due starts a fresh grace period when the stored row belongs to another subscription or lacks a timestamp', () => {
  const other = stored({ ...mappedRow(subscription({ id: 'sub_old', status: 'past_due' })), pastDueSince: new Date(NOW - 10 * DAY) })
  assert.deepEqual(mappedRow(subscription({ status: 'past_due' }), other, NOW + HOUR).pastDueSince, new Date(NOW + HOUR))

  const noTimestamp = stored({ ...mappedRow(subscription({ status: 'past_due' })), pastDueSince: null })
  assert.deepEqual(mappedRow(subscription({ status: 'past_due' }), noTimestamp, NOW + HOUR).pastDueSince, new Date(NOW + HOUR))

  const invalid = stored({ ...mappedRow(subscription({ status: 'past_due' })), pastDueSince: new Date(Number.NaN) })
  assert.deepEqual(mappedRow(subscription({ status: 'past_due' }), invalid, NOW + HOUR).pastDueSince, new Date(NOW + HOUR))
})

test('non-research or incomplete metadata is skipped', () => {
  const cases = [
    [subscription({ metadata: { userId: 'user_abc', product: 'raidmap' } }), 'not_research'],
    [subscription({ metadata: { userId: 'user_abc' } }), 'not_research'],
    [subscription({ metadata: null }), 'not_research'],
    [subscription({ metadata: { product: 'research' } }), 'missing_user_id'],
    [subscription({ metadata: { product: 'research', userId: '   ' } }), 'missing_user_id'],
    [subscription({ customer: null }), 'missing_customer'],
    [subscription({ customer: { id: '' } }), 'missing_customer'],
    [subscription({ status: '' }), 'missing_status'],
    [{ ...subscription(), id: '' }, 'invalid_subscription'],
    [null, 'invalid_subscription'],
  ]
  for (const [sub, reason] of cases) assert.deepEqual(map(sub), { ok: false, reason })
  assert.throws(() => mapStripeSubscriptionToResearchRow(subscription(), { env: ENV, nowMs: Number.NaN }), TypeError)
})

test('replacement: empty cache and the same subscription always take the fresh Stripe state', () => {
  const live = mappedRow(subscription())
  assert.equal(shouldReplaceResearchSubscription(null, live, NOW), true)
  assert.equal(shouldReplaceResearchSubscription(undefined, live, NOW), true)

  const canceled = mappedRow(subscription({ status: 'canceled', current_period_end: NOW_S - 60 }))
  assert.equal(shouldReplaceResearchSubscription(stored(live), canceled, NOW), true)
  assert.equal(shouldReplaceResearchSubscription(stored(canceled), live, NOW), true)
})

test('out-of-order events: a stale event of an OLD subscription never overwrites a live one', () => {
  const live = stored(mappedRow(subscription({ id: 'sub_new', created: NOW_S - DAY / 1000 })))
  const staleOld = [
    { status: 'canceled', current_period_end: NOW_S - 3600 },
    { status: 'canceled', current_period_end: NOW_S + 3600 },
    { status: 'unpaid' },
    { status: 'incomplete_expired' },
    { status: 'active', current_period_end: NOW_S - 3600 }, // Periode vorbei
    { status: 'active', price: { id: 'price_unknown', product: 'prod_other' } }, // unbekannte Stufe
  ]
  for (const overrides of staleOld) {
    const old = mappedRow(subscription({ id: 'sub_old', created: NOW_S - 400 * DAY / 1000, ...overrides }))
    assert.equal(shouldReplaceResearchSubscription(live, old, NOW), false, JSON.stringify(overrides))
  }

  // past_due einer anderen Subscription in der Kulanz gibt Zugang → darf die gespeicherte
  // Zeile nur ersetzen, wenn sie neuer ist.
  const olderPastDue = mappedRow(subscription({ id: 'sub_old', status: 'past_due', created: NOW_S - 400 * DAY / 1000 }))
  assert.equal(shouldReplaceResearchSubscription(live, olderPastDue, NOW), false)
})

test('a live subscription in the grace period is protected until the grace period ends', () => {
  const pastDue = stored({ ...mappedRow(subscription({ id: 'sub_live', status: 'past_due' })), pastDueSince: new Date(NOW) })
  const staleCanceled = mappedRow(subscription({ id: 'sub_old', status: 'canceled' }))
  assert.equal(shouldReplaceResearchSubscription(pastDue, staleCanceled, NOW + RESEARCH_PAST_DUE_GRACE_MS - 1), false)
  assert.equal(shouldReplaceResearchSubscription(pastDue, staleCanceled, NOW + RESEARCH_PAST_DUE_GRACE_MS), true)
})

test('when both subscriptions grant access, the newer one wins (ties replace)', () => {
  const older = mappedRow(subscription({ id: 'sub_a', created: NOW_S - 30 * 24 * 3600 }))
  const newer = mappedRow(subscription({ id: 'sub_b', created: NOW_S - 24 * 3600 }))
  assert.equal(shouldReplaceResearchSubscription(stored(older), newer, NOW), true)
  assert.equal(shouldReplaceResearchSubscription(stored(newer), older, NOW), false)

  const sameAge = mappedRow(subscription({ id: 'sub_c', created: NOW_S - 24 * 3600 }))
  assert.equal(shouldReplaceResearchSubscription(stored(newer), sameAge, NOW), true)

  // Fehlender Zeitstempel zählt als "älter".
  assert.equal(shouldReplaceResearchSubscription(stored({ ...older, stripeCreatedAt: null }), newer, NOW), true)
  assert.equal(shouldReplaceResearchSubscription(stored(newer), { ...older, stripeCreatedAt: null }, NOW), false)
})

test('a new subscription replaces a stored one that no longer grants access', () => {
  const ended = stored(mappedRow(subscription({ id: 'sub_old', status: 'canceled', current_period_end: NOW_S - 3600 })))
  for (const status of ['active', 'incomplete', 'past_due', 'canceled']) {
    const incoming = mappedRow(subscription({ id: 'sub_new', status }))
    assert.equal(shouldReplaceResearchSubscription(ended, incoming, NOW), true, status)
  }
  const unknownTier = stored({ ...mappedRow(subscription({ id: 'sub_old' })), tier: null })
  assert.equal(shouldReplaceResearchSubscription(unknownTier, mappedRow(subscription({ id: 'sub_new', status: 'incomplete' })), NOW), true)
})

// ---------------------------------------------------------------------------
// Doppel-Abos: offene Abos erkennen (Checkout-Sperre) und Fallback im Cache
// ---------------------------------------------------------------------------

test('open research subscriptions: every status that can still grant access or charge blocks a new checkout', () => {
  assert.deepEqual([...RESEARCH_OPEN_SUBSCRIPTION_STATUSES].sort(), ['active', 'incomplete', 'past_due', 'trialing', 'unpaid'])
  for (const status of RESEARCH_OPEN_SUBSCRIPTION_STATUSES) {
    const open = subscription({ id: `sub_${status}`, status })
    assert.equal(findOpenResearchSubscription([subscription({ id: 'sub_done', status: 'canceled' }), open]), open, status)
  }
  for (const status of ['canceled', 'incomplete_expired']) {
    assert.equal(findOpenResearchSubscription([subscription({ status })]), null, status)
  }
  // Nur Research-Abos zählen; kaputte Eingaben sind "keins".
  assert.equal(findOpenResearchSubscription([subscription({ metadata: { userId: 'user_abc', product: 'raidmap' } })]), null)
  assert.equal(findOpenResearchSubscription([subscription({ metadata: null })]), null)
  assert.equal(findOpenResearchSubscription(null), null)
  assert.equal(findOpenResearchSubscription([null]), null)
})

test('fallback: picks the newest other active research subscription of the same user', () => {
  const options = { env: ENV, nowMs: NOW, userId: 'user_abc', excludeSubscriptionId: 'sub_b' }
  const a = subscription({ id: 'sub_a', created: NOW_S - 300 * 24 * 3600, current_period_end: NOW_S + 60 * 24 * 3600, price: { id: 'price_reader_y', product: 'prod_research' } })
  const b = subscription({ id: 'sub_b', status: 'canceled' })
  const c = subscription({ id: 'sub_c', status: 'trialing', created: NOW_S - 5 * 24 * 3600 })
  assert.equal(pickResearchFallbackSubscription([b, a], options), a)
  assert.equal(pickResearchFallbackSubscription([a, b, c], options), c)
  // Die ausgeschlossene (gerade synchronisierte) Subscription ist nie ihr eigener Ersatz.
  assert.equal(pickResearchFallbackSubscription([subscription({ id: 'sub_b' })], options), null)
})

test('fallback: ignores subscriptions that could not grant access on their own', () => {
  const options = { env: ENV, nowMs: NOW, userId: 'user_abc', excludeSubscriptionId: 'sub_gone' }
  const rejected = [
    // past_due: Beginn der Kulanz unbekannt → nie als Ersatz
    subscription({ id: 'sub_pd', status: 'past_due' }),
    ...['unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused'].map(status => subscription({ id: `sub_${status}`, status })),
    // Periode vorbei (gekündigt bzw. länger als die Verlängerungs-Karenz)
    subscription({ id: 'sub_ended', current_period_end: NOW_S - 60, cancel_at_period_end: true }),
    subscription({ id: 'sub_stale', current_period_end: NOW_S - 25 * 3600 }),
    // unbekannter Preis → keine Stufe
    subscription({ id: 'sub_unknown_price', price: { id: 'price_other', product: 'prod_other' } }),
    // anderer User / anderes Produkt / ohne Metadaten
    subscription({ id: 'sub_other_user', metadata: { userId: 'user_other', product: 'research' } }),
    subscription({ id: 'sub_raidmap', metadata: { userId: 'user_abc', product: 'raidmap' } }),
    subscription({ id: 'sub_nometa', metadata: null }),
  ]
  assert.equal(pickResearchFallbackSubscription(rejected, options), null)
  assert.equal(pickResearchFallbackSubscription(null, options), null)
  assert.equal(pickResearchFallbackSubscription([subscription({ id: 'sub_ok' })], { ...options, userId: '' }), null)
})
