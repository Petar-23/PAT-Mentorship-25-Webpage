import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as guest from './checkout-guest.mjs'
import * as flow from './checkout-fulfillment-flow.mjs'
import * as vertrag from './vertrag-erklaerung.mjs'
import * as scope from './stripe-customer-scope.mjs'

// linkStripe (lib/checkout-fulfillment.ts): verknüpft den neuen Stripe-Customer aus dem Gast-Checkout
// mit dem Konto und übernimmt eine frühere Discord-Verknüpfung, damit der Webhook die Mentee-Rolle setzt.
// Stripe ist eine Attrappe, keine Netzaufrufe.

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

function fakeStripe({ customers, subscriptionMetadata = {} }) {
  const calls = { customerUpdates: [], subscriptionUpdates: [], searches: [] }
  const byId = new Map(customers.map((customer) => [customer.id, customer]))
  const stripe = {
    customers: {
      retrieve: async (id) => byId.get(id),
      update: async (id, params) => {
        calls.customerUpdates.push({ id, metadata: params.metadata })
        const customer = byId.get(id)
        customer.metadata = { ...customer.metadata, ...params.metadata }
        return customer
      },
      search: async ({ query }) => {
        calls.searches.push(query)
        const userId = /metadata\['userId'\]:'([^']+)'/.exec(query)?.[1]
        return { data: customers.filter((customer) => customer.metadata?.userId === userId) }
      },
    },
    subscriptions: {
      retrieve: async (id) => ({ id, metadata: subscriptionMetadata }),
      update: async (id, params) => {
        calls.subscriptionUpdates.push({ id, metadata: params.metadata })
        return { id }
      },
    },
  }
  return { stripe, calls }
}

function load(stripe) {
  const stub = new Proxy({}, { get: () => () => { throw new Error('not used in this test') } })
  return loadTs('./checkout-fulfillment.ts', {
    'server-only': {},
    '@clerk/nextjs/server': stub,
    '@/lib/authz': stub,
    '@/lib/prisma': { prisma: stub, withPrismaRetry: stub },
    '@/lib/stripe': { stripe, getAccessPriceIdsFromEnv: () => [] },
    '@/lib/user-subscription-cache': stub,
    '@/lib/mailer': stub,
    '@/lib/telegram-notify': stub,
    '@/lib/legal-texts': { SITE_URL: 'https://www.price-action-trader.de' },
    '@/lib/checkout-mail': stub,
    '@/lib/vertrag-erklaerung.mjs': vertrag,
    '@/lib/stripe-customer-scope.mjs': scope,
    '@/lib/checkout-guest.mjs': guest,
    '@/lib/checkout-fulfillment-flow.mjs': flow,
  })
}

test('returning member: the Discord link of the previous customer moves to the new one before the subscription update', async () => {
  const { stripe, calls } = fakeStripe({
    customers: [
      { id: 'cus_new', created: 300, metadata: {} },
      { id: 'cus_old', created: 100, metadata: { userId: 'user_1', discordUserId: 'discord_1' } },
      { id: 'cus_raidmap', created: 200, metadata: { userId: 'user_1', raidmapUserId: 'user_1', discordUserId: 'discord_x' } },
    ],
  })
  await load(stripe).linkStripe({ customerId: 'cus_new', subscriptionId: 'sub_new', userId: 'user_1' })
  assert.deepEqual(calls.customerUpdates, [{ id: 'cus_new', metadata: { userId: 'user_1', discordUserId: 'discord_1' } }])
  assert.deepEqual(calls.subscriptionUpdates, [{ id: 'sub_new', metadata: { userId: 'user_1' } }])
})

test('new buyer without earlier customers: only the user id is linked; repeated calls do nothing', async () => {
  const { stripe, calls } = fakeStripe({ customers: [{ id: 'cus_new', created: 300, metadata: {} }] })
  const fulfillment = load(stripe)
  await fulfillment.linkStripe({ customerId: 'cus_new', subscriptionId: 'sub_new', userId: 'user_2' })
  assert.deepEqual(calls.customerUpdates, [{ id: 'cus_new', metadata: { userId: 'user_2' } }])
  assert.equal(calls.searches.length, 1)

  const again = fakeStripe({ customers: [{ id: 'cus_new', created: 300, metadata: { userId: 'user_2' } }], subscriptionMetadata: { userId: 'user_2' } })
  await load(again.stripe).linkStripe({ customerId: 'cus_new', subscriptionId: 'sub_new', userId: 'user_2' })
  assert.equal(again.calls.customerUpdates.length + again.calls.subscriptionUpdates.length + again.calls.searches.length, 0)
})

test('an existing Discord link on the new customer is never overwritten', async () => {
  const { stripe, calls } = fakeStripe({
    customers: [
      { id: 'cus_new', created: 300, metadata: { discordUserId: 'discord_new' } },
      { id: 'cus_old', created: 100, metadata: { userId: 'user_3', discordUserId: 'discord_old' } },
    ],
  })
  await load(stripe).linkStripe({ customerId: 'cus_new', subscriptionId: 'sub_new', userId: 'user_3' })
  assert.deepEqual(calls.customerUpdates, [{ id: 'cus_new', metadata: { userId: 'user_3' } }])
  assert.equal(calls.searches.length, 0)
})
