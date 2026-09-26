// Research-Customers (USD, metadata.researchUserId) dürfen von den Mentorship-
// Email-Fallbacks (EUR) nie ausgewählt werden. Das Weglassen von metadata.userId
// reicht dafür NICHT — die Fallbacks suchen per E-Mail. Der Schutz ist
// lib/stripe-customer-scope.mjs (PR #161); diese Tests binden ihn an die
// Research-Konfiguration und an den Customer, den lib/research/stripe.ts anlegt.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

import * as accessRules from './access-rules.mjs'
import * as config from './config.mjs'
import * as subscriptionSync from './subscription-sync.mjs'
import {
  PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS,
  isProductScopedCustomer,
  selectEmailFallbackCustomer,
} from '../stripe-customer-scope.mjs'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const USER = 'user_2abcDEF123'
const EMAIL = 'max@example.com'
const KEY = config.RESEARCH_CUSTOMER_METADATA_KEY

const researchOnly = (id, created) => ({ id, object: 'customer', created, email: EMAIL, metadata: { [KEY]: USER } })
const mentorship = (id, created) => ({ id, object: 'customer', created, email: EMAIL, metadata: { userId: USER } })
const legacy = (id, created, metadata = {}) => ({ id, object: 'customer', created, email: EMAIL, metadata })
const deleted = (id, created) => ({ id, object: 'customer', created, deleted: true, metadata: {} })
const carriesOnlyResearchKey = customer => Boolean(customer?.metadata?.[KEY]) && !customer?.metadata?.userId

test('customer scope: the research customer metadata key is a product-scoped key', () => {
  assert.equal(KEY, 'researchUserId')
  assert.notEqual(KEY, 'userId')
  assert.ok(
    PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS.includes(KEY),
    `lib/stripe-customer-scope.mjs must list ${KEY}, otherwise the mentorship email fallbacks can pick research (USD) customers`
  )
  assert.equal(isProductScopedCustomer(researchOnly('cus_r', 1)), true)
})

test('customer scope: the mentorship email fallback never returns a customer carrying only researchUserId', () => {
  const pool = [
    researchOnly('cus_research_new', 50),
    researchOnly('cus_research_old', 5),
    mentorship('cus_mentorship', 20),
    legacy('cus_legacy', 10),
    legacy('cus_legacy_null', 30, null),
    deleted('cus_deleted', 60),
  ]
  // Alle Teilmengen in beiden Reihenfolgen.
  for (let mask = 0; mask < 1 << pool.length; mask++) {
    const subset = pool.filter((_, index) => mask & (1 << index))
    for (const list of [subset, [...subset].reverse()]) {
      const picked = selectEmailFallbackCustomer(list)
      assert.equal(carriesOnlyResearchKey(picked), false, `picked ${picked?.id} from ${list.map(c => c.id).join(',')}`)
      const expected = list
        .filter(c => !c.deleted && !carriesOnlyResearchKey(c))
        .sort((a, b) => b.created - a.created)[0]
      assert.equal(picked?.id ?? null, expected?.id ?? null)
    }
  }

  assert.equal(selectEmailFallbackCustomer([researchOnly('cus_a', 2), researchOnly('cus_b', 3)]), null)
  assert.equal(selectEmailFallbackCustomer([researchOnly('cus_newest', 99), legacy('cus_old', 1)]).id, 'cus_old')
})

test('customer scope: the customer that lib/research/stripe.ts creates is excluded from the mentorship email fallback', async () => {
  const calls = []
  const stripe = {
    customers: {
      async search(params) {
        calls.push(['customers.search', params])
        return { data: [] }
      },
      async create(params, options) {
        calls.push(['customers.create', params, options])
        return { id: 'cus_research_created', created: 1_000_000, ...params }
      },
      async update(id, params) {
        calls.push(['customers.update', id, params])
        return { id }
      },
    },
  }
  const research = loadTs('./stripe.ts', {
    'server-only': {},
    '@/lib/prisma': {
      prisma: { researchSubscription: { async findUnique() { return null } } },
      withPrismaRetry: operation => operation(),
    },
    '@/lib/research/access-rules.mjs': accessRules,
    '@/lib/research/config.mjs': config,
    '@/lib/research/subscription-sync.mjs': subscriptionSync,
    '@/lib/research/consent': { async recordResearchConsent() { return { id: 'consent' } } },
    '@/lib/stripe': { stripe },
    '@/lib/telegram-notify': { async sendCortanaTelegram() {} },
  })

  assert.equal(await research.findOrCreateResearchCustomer(USER, EMAIL), 'cus_research_created')
  const [, params] = calls.find(([name]) => name === 'customers.create')
  const created = { id: 'cus_research_created', object: 'customer', created: 1_000_000, ...params }

  // Gleiche E-Mail wie der Mentorship-Customer, aber neuer: der Fallback nimmt trotzdem den Mentorship-Customer.
  assert.equal(created.email, EMAIL)
  assert.equal(isProductScopedCustomer(created), true)
  assert.equal(selectEmailFallbackCustomer([created]), null)
  assert.equal(selectEmailFallbackCustomer([created, legacy('cus_mentorship_eur', 10)]).id, 'cus_mentorship_eur')
})
