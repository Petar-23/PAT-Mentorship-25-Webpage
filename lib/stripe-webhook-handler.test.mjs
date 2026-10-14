import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import * as checkoutGuest from './checkout-guest.mjs'

// Exercise the real webhook handler with all network/database effects intercepted.
const source = fs.readFileSync(new URL('./stripe-webhook-handler.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const FUTURE = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
const subscription = (overrides = {}) => ({
  id: 'sub_example', customer: 'cus_shared', status: 'active', metadata: {},
  current_period_end: FUTURE, cancel_at_period_end: false, cancel_at: null,
  items: { data: [{ price: { id: 'price_substack' } }] },
  ...overrides,
})
const lifecycle = [
  { type: 'customer.subscription.created', title: 'Neuer Kunde registriert', role: 'add' },
  {
    type: 'customer.subscription.updated', title: 'Kündigung eingegangen', role: 'add',
    changes: { cancel_at_period_end: true }, previous: { cancel_at_period_end: false },
  },
  {
    type: 'customer.subscription.updated', title: 'Geplante Kündigung', role: 'add',
    changes: { cancel_at: FUTURE }, previous: { cancel_at: null },
  },
  {
    type: 'customer.subscription.updated', title: 'Kündigung zurückgenommen', role: 'add',
    previous: { cancel_at_period_end: true },
  },
  {
    type: 'customer.subscription.deleted', title: 'Abonnement beendet', role: 'remove',
    changes: { status: 'canceled' },
  },
]
const event = (step, sub) => ({
  id: 'evt_example', type: step.type,
  data: { object: { ...sub, ...step.changes }, previous_attributes: step.previous },
})

function harness({ accessPriceIds = ['price_legacy'] } = {}) {
  const calls = { customers: [], tax: [], cache: [], raidmap: [], messages: [], add: [], remove: [] }
  const record = key => async value => { calls[key].push(value) }
  const unexpected = async () => { throw new Error('Unexpected checkout/Telegram effect') }
  const replacements = {
    './stripe': {
      getAccessPriceIdsFromEnv: () => accessPriceIds,
      stripe: { customers: { retrieve: async id => {
        calls.customers.push(id)
        // Same customer already owns a Mentorship: its metadata must not classify another product.
        return { id, email: 'member@example.com', metadata: { userId: 'user_member', discordUserId: 'discord_member' } }
      } } },
    },
    './prisma': { prisma: { raidMapSubscription: { upsert: record('raidmap') } } },
    './user-subscription-cache': { upsertUserSubscription: record('cache') },
    './updateCustomers': { ensureCustomerTaxInfo: record('tax') },
    './discord': {
      sendDiscordChannelMessage: record('messages'),
      addRoleToGuildMember: record('add'),
      removeRoleFromGuildMember: record('remove'),
    },
    './checkout-guest.mjs': checkoutGuest,
    './checkout-fulfillment': { fulfillCheckoutSession: unexpected, handleCheckoutAsyncPaymentFailed: unexpected },
    '@/lib/pat-source': { persistPatSourceFromMentorshipCheckout: unexpected },
    '@/lib/raidmap-fulfillment': { handleRaidMapCheckoutCompleted: unexpected },
    '@/lib/telegram-notify': { sendCortanaTelegram: unexpected },
  }
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => {
    assert.ok(id in replacements, `Unmocked dependency: ${id}`)
    return replacements[id]
  }, compiled, compiled.exports)
  return { handle: compiled.exports.handleStripeEvent, calls }
}

const env = {
  STRIPE_PRICE_ID: 'price_current', DISCORD_MOD_CHANNEL_ID: 'channel_mod',
  DISCORD_GUILD_ID: 'guild_test', DISCORD_ROLE_MENTEE26_ID: 'role_mentee',
}
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
test.beforeEach(t => {
  Object.assign(process.env, env)
  t.mock.method(console, 'log', () => {})
})
test.afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function assertNoEffects(calls) {
  for (const [kind, entries] of Object.entries(calls)) assert.deepEqual(entries, [], kind)
}

for (const step of lifecycle) {
  test(`Substack/unknown product: ${step.title} does not touch Mentorship`, async () => {
    const { handle, calls } = harness()
    // Substack need not provide any PAT product metadata. Its price is enough to exclude it.
    await handle(event(step, subscription()))
    assertNoEffects(calls)
  })

  for (const [name, overrides] of [
    ['legacy price without product metadata', { items: { data: [{ price: { id: 'price_legacy' } }] } }],
    ['current checkout price', { items: { data: [{ price: { id: 'price_current' } }] } }],
    ['explicit Mentorship metadata', { metadata: { product: 'mentorship' } }],
  ]) {
    test(`Mentorship ${name}: ${step.title} still updates cache and role`, async () => {
      const { handle, calls } = harness()
      const e = event(step, subscription(overrides))
      await handle(e)
      assert.deepEqual(calls.customers, ['cus_shared'])
      assert.deepEqual(calls.cache, [{ userId: 'user_member', stripeCustomerId: 'cus_shared', subscription: e.data.object }])
      assert.equal(calls.messages.length, 1)
      assert.equal(calls.messages[0].embeds[0].title, step.title)
      assert.deepEqual(calls[step.role], [{ guildId: 'guild_test', discordUserId: 'discord_member', roleId: 'role_mentee' }])
      assert.deepEqual(calls[step.role === 'add' ? 'remove' : 'add'], [])
      assert.deepEqual(calls.raidmap, [])
      assert.deepEqual(calls.tax, step.type.endsWith('.created') ? ['cus_shared'] : [])
    })
  }

  test(`Raid Map: ${step.title} stays in its own cache`, async () => {
    const { handle, calls } = harness()
    await handle(event(step, subscription({ metadata: { product: 'raidmap', userId: 'user_raidmap', tier: 'monthly' } })))
    assert.equal(calls.raidmap.length, 1)
    assert.equal(calls.raidmap[0].where.userId, 'user_raidmap')
    assert.equal(calls.raidmap[0].update.status, step.changes?.status ?? 'active')
    assertNoEffects({ ...calls, raidmap: [] })
  })
}

test('explicit foreign product wins over a matching price', async () => {
  for (const step of lifecycle) {
    const { handle, calls } = harness()
    await handle(event(step, subscription({
      metadata: { product: 'substack' }, items: { data: [{ price: { id: 'price_legacy' } }] },
    })))
    assertNoEffects(calls)
  }
})

test('missing configuration never lets arbitrary prices into Mentorship', async () => {
  delete process.env.STRIPE_PRICE_ID
  for (const step of lifecycle) {
    const { handle, calls } = harness({ accessPriceIds: [] })
    await handle(event(step, subscription()))
    assertNoEffects(calls)
  }
})

test('missing price items and product metadata are ignored', async () => {
  for (const items of [undefined, { data: [] }]) {
    const { handle, calls } = harness()
    await handle(event(lifecycle[0], subscription({ items })))
    assertNoEffects(calls)
  }
})

test('a legacy Mentorship price in a later line item is recognized', async () => {
  const { handle, calls } = harness()
  await handle(event(lifecycle[0], subscription({
    items: { data: [{ price: { id: 'price_addon' } }, { price: { id: 'price_legacy' } }] },
  })))
  assert.equal(calls.messages.length, 1)
  assert.equal(calls.cache.length, 1)
})

test('canceling an actual Mentorship trial still removes the role immediately', async () => {
  const { handle, calls } = harness()
  await handle(event(lifecycle[1], subscription({ status: 'trialing', metadata: { product: 'mentorship' } })))
  assert.equal(calls.cache.length, 1)
  assert.equal(calls.messages[0].embeds[0].title, 'Kündigung eingegangen')
  assert.equal(calls.remove.length, 1)
  assert.deepEqual(calls.add, [])
})
