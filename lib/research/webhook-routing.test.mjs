// Webhook-Routing: Research-Events laufen ausschließlich über die Research-
// Handler; Mentorship- und Raid-Map-Events lösen exakt dieselben Aufrufe aus wie
// vor dem Research-Zweig (Erwartungen gegen origin/main abgeglichen).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const NOW_S = Math.floor(Date.now() / 1000)
const FUTURE = NOW_S + 20 * 24 * 3600

const DISCORD_ENV = { DISCORD_MOD_CHANNEL_ID: 'chan_mod', DISCORD_GUILD_ID: 'guild_1', DISCORD_ROLE_MENTEE26_ID: 'role_m26' }

function harness({ customers = {}, subscriptions = {}, paypalStatus = null, fail = {} } = {}) {
  const calls = []
  const record = (name, ...args) => calls.push([name, ...args])
  const maybeFail = async name => {
    if (fail[name]) throw fail[name]
  }

  const stripe = {
    customers: {
      async retrieve(id) {
        record('stripe.customers.retrieve', id)
        return customers[id] ?? { id, email: null, metadata: {} }
      },
    },
    subscriptions: {
      async retrieve(id) {
        record('stripe.subscriptions.retrieve', id)
        return subscriptions[id]
      },
    },
  }
  const prisma = {
    payPalSubscriber: {
      async findUnique(args) {
        record('prisma.payPalSubscriber.findUnique', args.where)
        return paypalStatus ? { status: paypalStatus } : null
      },
    },
    userSubscription: {
      async upsert(args) {
        record('prisma.userSubscription.upsert', args.where, args.update.status)
        return {}
      },
    },
    raidMapSubscription: {
      async upsert(args) {
        record('prisma.raidMapSubscription.upsert', args.where, args.update.status)
        return {}
      },
    },
  }

  const handler = loadTs('../stripe-webhook-handler.ts', {
    '@/lib/pat-source': {
      async persistPatSourceFromMentorshipCheckout(session) {
        record('persistPatSourceFromMentorshipCheckout', session.id)
      },
    },
    '@/lib/raidmap-fulfillment': {
      async handleRaidMapCheckoutCompleted(session) {
        record('handleRaidMapCheckoutCompleted', session.id)
      },
    },
    '@/lib/research/stripe': {
      async handleResearchSubscriptionEvent(subscription) {
        record('handleResearchSubscriptionEvent', subscription.id)
        await maybeFail('handleResearchSubscriptionEvent')
        return { action: 'upserted' }
      },
      async handleResearchCheckoutCompleted(session) {
        record('handleResearchCheckoutCompleted', session.id)
        await maybeFail('handleResearchCheckoutCompleted')
      },
      async notifyResearchInvoicePaid(invoice, subscription) {
        record('notifyResearchInvoicePaid', invoice.id, subscription.id)
        await maybeFail('notifyResearchInvoicePaid')
      },
    },
    '@/lib/telegram-notify': {
      async sendCortanaTelegram(text) {
        record('sendCortanaTelegram', text)
      },
    },
    './stripe': { stripe },
    './prisma': { prisma },
    './updateCustomers': {
      async ensureCustomerTaxInfo(id) {
        record('ensureCustomerTaxInfo', id)
        return true
      },
    },
    './discord': {
      async addRoleToGuildMember(args) {
        record('discord.addRole', args)
      },
      async removeRoleFromGuildMember(args) {
        record('discord.removeRole', args)
      },
      async sendDiscordChannelMessage(args) {
        record('discord.message', args.channelId, args.embeds.map(embed => embed.title))
      },
    },
  })

  return { handle: event => handler.handleStripeEvent(event), calls }
}

async function withQuietEnv(t, fn) {
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})
  const previous = {}
  for (const [key, value] of Object.entries(DISCORD_ENV)) {
    previous[key] = process.env[key]
    process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function subscription(id, metadata, overrides = {}) {
  return {
    id,
    object: 'subscription',
    status: 'active',
    customer: `cus_${id}`,
    cancel_at_period_end: false,
    cancel_at: null,
    current_period_end: FUTURE,
    metadata,
    items: { data: [{ price: { id: 'price_x' } }] },
    ...overrides,
  }
}

const event = (type, object, previous_attributes) => ({ id: `evt_${type}`, type, data: { object, ...(previous_attributes ? { previous_attributes } : {}) } })

const RESEARCH_META = { userId: 'user_research', product: 'research', tier: 'member', interval: 'month' }
const RAIDMAP_META = { userId: 'user_raid', product: 'raidmap', tier: 'monthly' }
const MENTEE_CUSTOMER = { id: 'cus_sub_m', email: 'mentee@example.com', metadata: { userId: 'user_mentee', discordUserId: 'discord_1' } }

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

test('research subscription events call only the research handler', async t => {
  await withQuietEnv(t, async () => {
    for (const type of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']) {
      const h = harness()
      const status = type.endsWith('deleted') ? 'canceled' : 'active'
      await h.handle(event(type, subscription('sub_r', RESEARCH_META, { status }), type.endsWith('updated') ? { cancel_at_period_end: false } : undefined))
      assert.deepEqual(h.calls, [['handleResearchSubscriptionEvent', 'sub_r']], type)
    }
  })
})

test('research checkout completion calls only the research handler', async t => {
  await withQuietEnv(t, async () => {
    const h = harness()
    await h.handle(event('checkout.session.completed', { id: 'cs_r', metadata: { ...RESEARCH_META, consentReference: 'ref' } }))
    assert.deepEqual(h.calls, [['handleResearchCheckoutCompleted', 'cs_r']])
  })
})

test('research invoice.paid notifies through the research helper only', async t => {
  await withQuietEnv(t, async () => {
    const sub = subscription('sub_r', RESEARCH_META)
    const h = harness({ subscriptions: { sub_r: sub } })
    await h.handle(event('invoice.paid', { id: 'in_r', amount_paid: 1000, currency: 'usd', subscription: 'sub_r', customer_email: 'x@example.com' }))
    assert.deepEqual(h.calls, [
      ['stripe.subscriptions.retrieve', 'sub_r'],
      ['notifyResearchInvoicePaid', 'in_r', 'sub_r'],
    ])
  })
})

test('research sync errors propagate so Stripe retries; notification errors do not', async t => {
  await withQuietEnv(t, async () => {
    const syncError = new Error('db down')
    const h1 = harness({ fail: { handleResearchSubscriptionEvent: syncError } })
    await assert.rejects(h1.handle(event('customer.subscription.updated', subscription('sub_r', RESEARCH_META))), /db down/)
    assert.deepEqual(h1.calls, [['handleResearchSubscriptionEvent', 'sub_r']])

    const h2 = harness({ fail: { handleResearchCheckoutCompleted: syncError } })
    await assert.rejects(h2.handle(event('checkout.session.completed', { id: 'cs_r', metadata: RESEARCH_META })), /db down/)
    assert.deepEqual(h2.calls, [['handleResearchCheckoutCompleted', 'cs_r']])

    const h3 = harness({ subscriptions: { sub_r: subscription('sub_r', RESEARCH_META) }, fail: { notifyResearchInvoicePaid: new Error('telegram down') } })
    await h3.handle(event('invoice.paid', { id: 'in_r', amount_paid: 1000, currency: 'usd', subscription: 'sub_r' }))
    assert.deepEqual(h3.calls.map(([name]) => name), ['stripe.subscriptions.retrieve', 'notifyResearchInvoicePaid'])
  })
})

// ---------------------------------------------------------------------------
// Raid Map (unverändert)
// ---------------------------------------------------------------------------

test('raid map events behave exactly as before', async t => {
  await withQuietEnv(t, async () => {
    for (const type of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']) {
      const h = harness()
      await h.handle(event(type, subscription('sub_rm', RAIDMAP_META, { status: 'trialing' })))
      assert.deepEqual(h.calls, [['prisma.raidMapSubscription.upsert', { userId: 'user_raid' }, 'trialing']], type)
    }

    const checkout = harness()
    await checkout.handle(event('checkout.session.completed', { id: 'cs_rm', metadata: RAIDMAP_META }))
    assert.deepEqual(checkout.calls, [['handleRaidMapCheckoutCompleted', 'cs_rm']])

    const paid = harness({ subscriptions: { sub_rm: subscription('sub_rm', RAIDMAP_META) } })
    await paid.handle(event('invoice.paid', { id: 'in_rm', amount_paid: 2900, currency: 'usd', subscription: 'sub_rm', customer_email: 'buyer@example.com' }))
    assert.deepEqual(paid.calls, [
      ['stripe.subscriptions.retrieve', 'sub_rm'],
      ['sendCortanaTelegram', '💰 Raid Map Zahlung eingegangen\n29.00 USD · monthly · buyer@example.com'],
    ])
  })
})

// ---------------------------------------------------------------------------
// Mentorship (unverändert)
// ---------------------------------------------------------------------------

test('mentorship subscription created: tax info, cache, mod embed and Discord role as before', async t => {
  await withQuietEnv(t, async () => {
    const h = harness({ customers: { cus_sub_m: MENTEE_CUSTOMER } })
    await h.handle(event('customer.subscription.created', subscription('sub_m', { userId: 'user_mentee' })))
    assert.deepEqual(h.calls, [
      ['ensureCustomerTaxInfo', 'cus_sub_m'],
      ['stripe.customers.retrieve', 'cus_sub_m'],
      ['prisma.userSubscription.upsert', { userId: 'user_mentee' }, 'active'],
      ['discord.message', 'chan_mod', ['Neuer Kunde registriert']],
      ['discord.addRole', { guildId: 'guild_1', discordUserId: 'discord_1', roleId: 'role_m26' }],
    ])
  })
})

test('mentorship subscription updated (cancellation, past_due) as before', async t => {
  await withQuietEnv(t, async () => {
    const cancel = harness({ customers: { cus_sub_m: MENTEE_CUSTOMER } })
    await cancel.handle(
      event('customer.subscription.updated', subscription('sub_m', {}, { cancel_at_period_end: true }), { cancel_at_period_end: false })
    )
    assert.deepEqual(cancel.calls, [
      ['stripe.customers.retrieve', 'cus_sub_m'],
      ['prisma.userSubscription.upsert', { userId: 'user_mentee' }, 'active'],
      ['discord.message', 'chan_mod', ['Kündigung eingegangen']],
      ['discord.addRole', { guildId: 'guild_1', discordUserId: 'discord_1', roleId: 'role_m26' }],
    ])

    const pastDue = harness({ customers: { cus_sub_m: MENTEE_CUSTOMER }, paypalStatus: 'ACTIVE' })
    await pastDue.handle(event('customer.subscription.updated', subscription('sub_m', {}, { status: 'past_due' }), { status: 'active' }))
    assert.deepEqual(pastDue.calls, [
      ['stripe.customers.retrieve', 'cus_sub_m'],
      ['prisma.payPalSubscriber.findUnique', { userId: 'user_mentee' }],
      ['prisma.userSubscription.upsert', { userId: 'user_mentee' }, 'active'],
      ['discord.removeRole', { guildId: 'guild_1', discordUserId: 'discord_1', roleId: 'role_m26' }],
    ])
  })
})

test('mentorship subscription deleted as before', async t => {
  await withQuietEnv(t, async () => {
    const h = harness({ customers: { cus_sub_m: MENTEE_CUSTOMER } })
    await h.handle(event('customer.subscription.deleted', subscription('sub_m', {}, { status: 'canceled' })))
    assert.deepEqual(h.calls, [
      ['stripe.customers.retrieve', 'cus_sub_m'],
      ['prisma.payPalSubscriber.findUnique', { userId: 'user_mentee' }],
      ['prisma.userSubscription.upsert', { userId: 'user_mentee' }, 'canceled'],
      ['discord.message', 'chan_mod', ['Abonnement beendet']],
      ['discord.removeRole', { guildId: 'guild_1', discordUserId: 'discord_1', roleId: 'role_m26' }],
    ])
  })
})

test('mentorship checkout, customer.created and invoice.paid as before', async t => {
  await withQuietEnv(t, async () => {
    const checkout = harness()
    await checkout.handle(event('checkout.session.completed', { id: 'cs_m', metadata: { userId: 'user_mentee' } }))
    assert.deepEqual(checkout.calls, [['persistPatSourceFromMentorshipCheckout', 'cs_m']])

    const noMetadata = harness()
    await noMetadata.handle(event('checkout.session.completed', { id: 'cs_m2', metadata: null }))
    assert.deepEqual(noMetadata.calls, [['persistPatSourceFromMentorshipCheckout', 'cs_m2']])

    const created = harness()
    await created.handle(event('customer.created', { id: 'cus_new' }))
    assert.deepEqual(created.calls, [['ensureCustomerTaxInfo', 'cus_new']])

    const paid = harness({ subscriptions: { sub_m: subscription('sub_m', { userId: 'user_mentee' }) } })
    await paid.handle(event('invoice.paid', { id: 'in_m', amount_paid: 29700, currency: 'eur', subscription: 'sub_m' }))
    assert.deepEqual(paid.calls, [['stripe.subscriptions.retrieve', 'sub_m']])

    const free = harness()
    await free.handle(event('invoice.paid', { id: 'in_0', amount_paid: 0, subscription: 'sub_m' }))
    assert.deepEqual(free.calls, [])
  })
})
