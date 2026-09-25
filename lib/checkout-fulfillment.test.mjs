import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCOUNT_CLAIM_LEASE_MS,
  MAIL_ATTEMPT_LEASE_MS,
  fulfillCheckoutSessionFlow,
  handleAsyncPaymentFailedFlow,
} from './checkout-fulfillment-flow.mjs'

// Freischaltung nach dem Gast-Checkout mit Attrappen für Stripe, Clerk, DB, Mail und Telegram.
// Schwerpunkt: Idempotenz (Webhook und /willkommen parallel und wiederholt) und keine Personendaten
// in Meldungen an Petar.

const EMAIL = 'max@example.com'
const NAME = 'Max Mustermann'
const START = Date.parse('2026-09-25T12:00:00Z')

function stripeSession(overrides = {}) {
  return {
    id: 'cs_test_guest123456',
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    created: Math.floor(START / 1000) - 60,
    customer: 'cus_new',
    subscription: 'sub_new',
    amount_total: 15000,
    currency: 'eur',
    customer_details: { email: ' Max@Example.com ', name: NAME },
    metadata: {
      product: 'mentorship',
      flow: 'guest',
      src: 'hero_cta',
      consent_early_start: 'true',
      consent_at: '2026-09-25T11:58:00.000Z',
      terms_version: 'v-test',
      nonce_hash: 'h'.repeat(64),
    },
    ...overrides,
  }
}

function memoryStore(clock) {
  const rows = new Map()
  const tick = () => new Promise((resolve) => setImmediate(resolve))
  const store = {
    rows,
    async ensure(data) {
      await tick()
      if (!rows.has(data.stripeSessionId)) {
        rows.set(data.stripeSessionId, {
          ...data,
          userId: null,
          createdNewUser: false,
          accountClaimedAt: null,
          ticketIssuedAt: null,
          welcomeEmailAttemptAt: null,
          welcomeEmailSentAt: null,
          duplicateCheckedAt: null,
          paymentFailedNotifiedAt: null,
          purchaseTrackedAt: null,
          createdAt: new Date(clock.now),
        })
      }
      return { ...rows.get(data.stripeSessionId) }
    },
    async get(id) {
      await tick()
      const row = rows.get(id)
      return row ? { ...row } : null
    },
    async claimAccount(id, now, staleBefore) {
      await tick()
      const row = rows.get(id)
      if (!row || row.userId || (row.accountClaimedAt && row.accountClaimedAt >= staleBefore)) return false
      row.accountClaimedAt = now
      return true
    },
    async setAccount(id, data) {
      await tick()
      const row = rows.get(id)
      if (!row || row.userId) return false
      Object.assign(row, data)
      return true
    },
    async claimMail(id, now, staleBefore) {
      await tick()
      const row = rows.get(id)
      if (!row || row.welcomeEmailSentAt || (row.welcomeEmailAttemptAt && row.welcomeEmailAttemptAt >= staleBefore)) return false
      row.welcomeEmailAttemptAt = now
      return true
    },
    async markMailSent(id, now) {
      rows.get(id).welcomeEmailSentAt = now
    },
    async claimOnce(id, field, now) {
      await tick()
      const row = rows.get(id)
      if (!row || row[field]) return false
      row[field] = now
      return true
    },
  }
  return store
}

function setup({ session = stripeSession(), accounts = [], mailResults = [], subscriptions = [], paypalActive = false, createAccountError = null } = {}) {
  const clock = { now: START }
  const calls = { createAccount: [], loginLinks: [], links: [], upserts: [], mails: [], notify: [], findAccounts: [], getAccount: [], duplicateLists: 0, retrieveSession: 0 }
  const clerkUsers = [...accounts]
  const store = memoryStore(clock)
  const deps = {
    now: () => new Date(clock.now),
    sleep: () => new Promise((resolve) => setImmediate(resolve)),
    store,
    retrieveSession: async (id) => {
      calls.retrieveSession += 1
      assert.equal(id, session.id)
      return session
    },
    retrieveSubscription: async (id) => ({ id, status: 'active', start_date: Math.floor(START / 1000) - 50, current_period_end: Math.floor(START / 1000) + 30 * 86400, metadata: {} }),
    getAccount: async (userId) => {
      calls.getAccount.push(userId)
      const user = clerkUsers.find((u) => u.id === userId)
      return user ? { id: user.id, isAdmin: Boolean(user.isAdmin) } : null
    },
    findAccountsByEmail: async (email) => {
      calls.findAccounts.push(email)
      return clerkUsers.filter((u) => u.email === email).map((u) => ({ id: u.id, verified: u.verified !== false, isAdmin: Boolean(u.isAdmin) }))
    },
    createAccount: async (input) => {
      calls.createAccount.push(input)
      await new Promise((resolve) => setImmediate(resolve))
      if (createAccountError) {
        const error = createAccountError
        createAccountError = null
        throw error
      }
      const user = { id: `user_created_${calls.createAccount.length}`, email: input.email }
      clerkUsers.push(user)
      return { id: user.id }
    },
    createLoginLink: async (userId) => {
      calls.loginLinks.push(userId)
      return `https://app.test/willkommen/anmelden#ticket=t_${userId}`
    },
    linkStripe: async (input) => {
      calls.links.push(input)
    },
    upsertSubscription: async (input) => {
      calls.upserts.push(input)
    },
    listSubscriptionsForDuplicateCheck: async () => {
      calls.duplicateLists += 1
      return { subscriptions, paypalActive, mentorshipPriceIds: ['price_m'] }
    },
    buildConfirmationMail: (input) => ({ subject: 'Bestätigung', text: JSON.stringify(input), html: '<p>ok</p>' }),
    buildPaymentFailedMail: (input) => ({ subject: 'Zahlung fehlgeschlagen', text: JSON.stringify(input), html: '<p>x</p>' }),
    sendMail: async (mail, tag) => {
      calls.mails.push({ ...mail, tag })
      return mailResults.length > 0 ? mailResults.shift() : { ok: true }
    },
    notify: async (lines) => {
      calls.notify.push(lines.join('\n'))
    },
  }
  return { deps, calls, store, clock, clerkUsers, session }
}

function assertNoPersonalData(calls) {
  for (const message of calls.notify) {
    assert.doesNotMatch(message, /@/, 'no e-mail address in Telegram')
    assert.doesNotMatch(message, /Max|Mustermann/, 'no name in Telegram')
  }
}

// ---------------------------------------------------------------------------------------------

test('new guest: creates exactly one passwordless account, links Stripe, writes the cache, sends the confirmation', async () => {
  const { deps, calls, store } = setup()
  const result = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)

  assert.equal(result.status, 'fulfilled')
  assert.equal(result.record.userId, 'user_created_1')
  assert.equal(result.record.createdNewUser, true)
  assert.equal(result.record.email, EMAIL, 'e-mail lower-cased and trimmed')
  assert.deepEqual(calls.createAccount, [{ email: EMAIL, name: NAME, stripeSessionId: 'cs_test_guest123456' }])
  assert.deepEqual(calls.links, [{ customerId: 'cus_new', subscriptionId: 'sub_new', userId: 'user_created_1' }])
  assert.equal(calls.upserts.length, 1)
  assert.equal(calls.upserts[0].userId, 'user_created_1')
  assert.equal(calls.upserts[0].customerId, 'cus_new')

  assert.equal(calls.mails.length, 1)
  assert.equal(calls.mails[0].to, EMAIL)
  assert.equal(calls.mails[0].tag, 'kauf-bestaetigung')
  const mailInput = JSON.parse(calls.mails[0].text)
  assert.equal(mailInput.createdNewUser, true)
  assert.equal(mailInput.loginUrl, 'https://app.test/willkommen/anmelden#ticket=t_user_created_1')
  assert.equal(mailInput.consentEarlyStart, true)
  assert.equal(mailInput.consentAt, '2026-09-25T11:58:00.000Z')
  assert.equal(mailInput.termsVersion, 'v-test')
  assert.equal(mailInput.subscriptionId, 'sub_new')
  assert.deepEqual(result.sideEffects, { mail: 'sent', duplicate: 'none' })

  const row = store.rows.get('cs_test_guest123456')
  assert.ok(row.welcomeEmailSentAt)
  assert.ok(row.duplicateCheckedAt)
  assert.equal(row.nonceHash, 'h'.repeat(64))
  assert.equal(calls.notify.length, 0)
})

test('idempotent: repeated calls (webhook retries, reloads) never create a second account or send a second mail', async () => {
  const { deps, calls } = setup()
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  const second = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  const third = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)

  assert.equal(calls.createAccount.length, 1)
  assert.equal(calls.mails.length, 1)
  assert.equal(calls.loginLinks.length, 1)
  assert.equal(calls.duplicateLists, 1)
  assert.equal(second.record.userId, 'user_created_1')
  assert.equal(third.record.createdNewUser, true)
  assert.deepEqual(third.sideEffects, { mail: 'skipped', duplicate: 'skipped' })
  // Zugangs-Cache und Stripe-Verknüpfung werden bei jedem Aufruf aufgefrischt (wiederholbar).
  assert.equal(calls.upserts.length, 3)
})

test('idempotent under concurrency: webhook and /willkommen at the same time create one account and one mail', async () => {
  const { deps, calls } = setup()
  const results = await Promise.all([
    fulfillCheckoutSessionFlow('cs_test_guest123456', deps),
    fulfillCheckoutSessionFlow('cs_test_guest123456', deps),
    fulfillCheckoutSessionFlow('cs_test_guest123456', deps),
  ])
  assert.equal(calls.createAccount.length, 1)
  assert.equal(calls.mails.length, 1)
  for (const result of results) {
    assert.equal(result.status, 'fulfilled')
    assert.equal(result.record.userId, 'user_created_1')
    assert.equal(result.record.createdNewUser, true)
    // Wer die Mail-Sperre nicht bekam, wartet auf den Versand statt „erledigt“ zu melden.
    assert.ok(['sent', 'skipped'].includes(result.sideEffects.mail), result.sideEffects.mail)
  }
  assert.equal(results.filter((result) => result.sideEffects.mail === 'sent').length, 1)
})

test('webhook while /willkommen holds the mail lock and fails: reported as in_progress, so Stripe retries', async () => {
  const { deps, calls } = setup({ mailResults: [{ ok: false, reason: 'send_failed' }] })
  const tasks = []
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps, { defer: (task) => tasks.push(task) })
  const [, webhook] = await Promise.all([tasks[0](), fulfillCheckoutSessionFlow('cs_test_guest123456', deps)])
  assert.equal(calls.mails.length, 1)
  assert.equal(webhook.sideEffects.mail, 'in_progress')
})

test('a crashed account claim is taken over after the lease; before that the second caller reports pending', async () => {
  const { deps, calls, store, clock } = setup()
  await store.ensure({ stripeSessionId: 'cs_test_guest123456', flow: 'guest', email: EMAIL, nonceHash: null, stripeCustomerId: 'cus_new', stripeSubscriptionId: 'sub_new' })
  await store.claimAccount('cs_test_guest123456', new Date(clock.now), new Date(0)) // anderer Aufruf, danach abgestürzt

  const pending = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(pending.status, 'pending')
  assert.equal(calls.createAccount.length, 0)
  assert.equal(calls.mails.length, 0)

  clock.now += ACCOUNT_CLAIM_LEASE_MS + 1
  const taken = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(taken.status, 'fulfilled')
  assert.equal(calls.createAccount.length, 1)
})

test('existing account with this e-mail: linked, never created, no one-time login link in the mail', async () => {
  const { deps, calls } = setup({ accounts: [{ id: 'user_existing', email: EMAIL }] })
  const result = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(result.record.userId, 'user_existing')
  assert.equal(result.record.createdNewUser, false)
  assert.equal(calls.createAccount.length, 0)
  assert.equal(calls.loginLinks.length, 0)
  const mailInput = JSON.parse(calls.mails[0].text)
  assert.equal(mailInput.createdNewUser, false)
  assert.equal(mailInput.loginUrl, null)
})

test('admin e-mail: linked to the admin account, Petar is notified once, without personal data', async () => {
  const { deps, calls } = setup({ accounts: [{ id: 'user_admin', email: EMAIL, isAdmin: true }] })
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(calls.createAccount.length, 0)
  const adminNotices = calls.notify.filter((message) => message.includes('Admin-Kontos'))
  assert.equal(adminNotices.length, 1)
  assert.match(adminNotices[0], /sub_new/)
  assertNoPersonalData(calls)
})

test('race on account creation (e-mail just taken elsewhere): the existing account is linked instead', async () => {
  const error = Object.assign(new Error('That email address is taken.'), { status: 422 })
  const { deps, calls, clerkUsers } = setup({ createAccountError: error })
  const originalCreate = deps.createAccount
  deps.createAccount = async (input) => {
    clerkUsers.push({ id: 'user_parallel', email: input.email })
    return originalCreate(input)
  }
  const result = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(result.record.userId, 'user_parallel')
  assert.equal(result.record.createdNewUser, false)
  assert.equal(calls.createAccount.length, 1)
})

test('account creation fails without a matching account: the error surfaces (webhook retries)', async () => {
  const { deps, store } = setup({ createAccountError: new Error('Clerk down') })
  await assert.rejects(() => fulfillCheckoutSessionFlow('cs_test_guest123456', deps), /Clerk down/)
  assert.equal(store.rows.get('cs_test_guest123456').userId, null)
})

test('signed-in purchase (flow account) uses the buyer account from the metadata, no e-mail lookup', async () => {
  const session = stripeSession({ metadata: { ...stripeSession().metadata, flow: 'account', userId: 'user_buyer' } })
  const { deps, calls } = setup({ session, accounts: [{ id: 'user_buyer', email: 'other@example.com' }, { id: 'user_other', email: EMAIL }] })
  const result = await fulfillCheckoutSessionFlow(session.id, deps)
  assert.equal(result.record.userId, 'user_buyer')
  assert.equal(result.record.flow, 'account')
  assert.deepEqual(calls.getAccount, ['user_buyer'])
  assert.deepEqual(calls.findAccounts, [])
})

test('other sessions are skipped without any writes: Raid Map, old account flow, unfinished payments', async () => {
  for (const [session, reason] of [
    [stripeSession({ metadata: { product: 'raidmap', userId: 'user_1' } }), 'foreign_product'],
    [stripeSession({ metadata: { userId: 'user_1' } }), 'not_this_flow'],
    [stripeSession({ status: 'open' }), 'not_complete'],
    [stripeSession({ status: 'expired' }), 'not_complete'],
  ]) {
    const { deps, calls, store } = setup({ session })
    const result = await fulfillCheckoutSessionFlow(session.id, deps)
    assert.deepEqual([result.status, result.reason], ['skipped', reason])
    assert.equal(store.rows.size, 0)
    assert.equal(calls.createAccount.length + calls.mails.length + calls.links.length, 0)
  }
})

test('a session without e-mail, customer or subscription is an error, not a silent success', async () => {
  const { deps } = setup({ session: stripeSession({ subscription: null }) })
  await assert.rejects(() => fulfillCheckoutSessionFlow('cs_test_guest123456', deps), /no email, customer or subscription/)
})

test('mail failures never block access; transient ones are retried after the lease, permanent ones reported', async () => {
  const { deps, calls, store, clock } = setup({ mailResults: [{ ok: false, reason: 'send_failed' }] })
  const first = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(first.status, 'fulfilled', 'access is granted anyway')
  assert.equal(first.sideEffects.mail, 'failed_transient')
  assert.equal(store.rows.get('cs_test_guest123456').welcomeEmailSentAt, null)
  assert.equal(calls.notify.filter((m) => m.includes('Vertragsbestätigung nicht versendet')).length, 1)

  const tooEarly = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(tooEarly.sideEffects.mail, 'in_progress', 'no parallel second attempt within the lease, but not reported as done')
  assert.equal(calls.mails.length, 1)

  clock.now += MAIL_ATTEMPT_LEASE_MS + 1
  const retry = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(retry.sideEffects.mail, 'sent')
  assert.equal(calls.mails.length, 2)
  assertNoPersonalData(calls)

  const permanent = setup({ mailResults: [{ ok: false, reason: 'not_configured' }] })
  const result = await fulfillCheckoutSessionFlow('cs_test_guest123456', permanent.deps)
  assert.equal(result.sideEffects.mail, 'failed_permanent')
  assert.match(permanent.calls.notify[0], /manuell senden/)
})

test('duplicate subscription: Petar is notified once with Stripe ids only', async () => {
  const subscriptions = [
    { id: 'sub_new', status: 'active', product: null, priceIds: ['price_m'] },
    { id: 'sub_old', status: 'active', product: null, priceIds: ['price_m'] },
  ]
  const { deps, calls } = setup({ accounts: [{ id: 'user_existing', email: EMAIL }], subscriptions })
  const first = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  assert.equal(first.sideEffects.duplicate, 'notified')
  const notices = calls.notify.filter((m) => m.includes('Doppel-Abo'))
  assert.equal(notices.length, 1)
  assert.match(notices[0], /sub_new/)
  assert.match(notices[0], /sub_old \(active\)/)
  assertNoPersonalData(calls)

  const paypal = setup({ paypalActive: true })
  await fulfillCheckoutSessionFlow('cs_test_guest123456', paypal.deps)
  assert.match(paypal.calls.notify.join('\n'), /PayPal/)
})

test('/willkommen defers mail and duplicate check until after the response', async () => {
  const { deps, calls } = setup()
  const tasks = []
  const result = await fulfillCheckoutSessionFlow('cs_test_guest123456', deps, { defer: (task) => tasks.push(task) })
  assert.equal(result.status, 'fulfilled')
  assert.equal(result.sideEffects, 'deferred')
  assert.equal(calls.upserts.length, 1, 'access cache is written before the redirect')
  assert.equal(calls.mails.length, 0)
  assert.equal(tasks.length, 1)
  await tasks[0]()
  assert.equal(calls.mails.length, 1)
})

test('SEPA failure later: cache refreshed, Petar and the buyer informed exactly once', async () => {
  const { deps, calls } = setup()
  await fulfillCheckoutSessionFlow('cs_test_guest123456', deps)
  await handleAsyncPaymentFailedFlow('cs_test_guest123456', deps)
  await handleAsyncPaymentFailedFlow('cs_test_guest123456', deps)

  const failedMails = calls.mails.filter((mail) => mail.tag === 'kauf-zahlung-fehlgeschlagen')
  assert.equal(failedMails.length, 1)
  assert.equal(failedMails[0].to, EMAIL)
  assert.equal(calls.notify.filter((m) => m.includes('verzögerte Zahlung fehlgeschlagen')).length, 1)
  assert.equal(calls.upserts.length, 3)
  assert.equal(calls.mails.filter((mail) => mail.tag === 'kauf-bestaetigung').length, 1)
  assertNoPersonalData(calls)
})
