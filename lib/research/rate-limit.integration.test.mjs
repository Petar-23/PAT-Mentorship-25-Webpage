// Integrationstests gegen eine lokale Wegwerf-Postgres (nie Production):
//   RESEARCH_TEST_DATABASE_URL=postgresql://research@127.0.0.1:55433/research_test \
//     node --test lib/research/rate-limit.integration.test.mjs
// Ohne RESEARCH_TEST_DATABASE_URL werden die DB-Tests übersprungen; die
// Validierungstests laufen immer (sie erreichen die DB nie).
//
// Enthält zusätzlich einen DB-Test für lib/research/consent.ts (Transaktion
// und JSON-Metadaten), weil er dieselbe Test-DB braucht.

import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
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

const DATABASE_URL = process.env.RESEARCH_TEST_DATABASE_URL
const skipDb = DATABASE_URL ? false : 'RESEARCH_TEST_DATABASE_URL is not set'
const RUN_ID = randomUUID()
const createdKeyHashes = new Set()
const createdConsentReferences = new Set()

let pool
let prisma
let rateLimit
let consent

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function uniqueKey(label) {
  const key = `test:${RUN_ID}:${label}:${randomUUID()}`
  createdKeyHashes.add(sha256Hex(`research:v1:${key}`))
  return key
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

before(async () => {
  if (skipDb) return
  const { Pool } = require('pg')
  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg } = require('@prisma/adapter-pg')
  pool = new Pool({ connectionString: DATABASE_URL, max: 25 })
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  rateLimit = loadTs('./rate-limit.ts', { 'server-only': {}, '@/lib/prisma': { prisma } })
  consent = loadTs('./consent.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma, withPrismaRetry: (operation) => operation() },
    '@/lib/research/config.mjs': await import('./config.mjs'),
  })
})

after(async () => {
  if (skipDb || !prisma) return
  try {
    if (createdKeyHashes.size > 0) {
      await prisma.researchRateLimit.deleteMany({ where: { keyHash: { in: [...createdKeyHashes] } } })
    }
    if (createdConsentReferences.size > 0) {
      await prisma.researchConsentEvent.deleteMany({ where: { reference: { in: [...createdConsentReferences] } } })
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

test('invalid options are rejected before the database is touched', async () => {
  let queries = 0
  const { consumeResearchRateLimit } = loadTs('./rate-limit.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma: { $queryRaw: async () => { queries += 1; return [] } } },
  })
  const valid = { key: 'checkout:user_1', windowMs: 60_000, maxAttempts: 5 }
  const invalid = [
    undefined,
    null,
    { ...valid, key: '' },
    { ...valid, key: '   ' },
    { ...valid, key: 42 },
    { ...valid, key: 'x'.repeat(513) },
    { ...valid, windowMs: 0 },
    { ...valid, windowMs: -1 },
    { ...valid, windowMs: 1.5 },
    { ...valid, windowMs: Number.NaN },
    { ...valid, windowMs: Number.POSITIVE_INFINITY },
    { ...valid, windowMs: '60000' },
    { ...valid, windowMs: 367 * 24 * 60 * 60 * 1000 },
    { ...valid, maxAttempts: 0 },
    { ...valid, maxAttempts: -3 },
    { ...valid, maxAttempts: 2.5 },
    { ...valid, maxAttempts: '5' },
  ]
  for (const options of invalid) {
    await assert.rejects(consumeResearchRateLimit(options), /Invalid research rate-limit/, JSON.stringify(options))
  }
  assert.equal(queries, 0)
})

test('an empty RETURNING result fails loudly', async () => {
  const { consumeResearchRateLimit } = loadTs('./rate-limit.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma: { $queryRaw: async () => [] } },
  })
  await assert.rejects(consumeResearchRateLimit({ key: 'k', windowMs: 1000, maxAttempts: 1 }), /not returned/)
})

test('key hash is SHA-256 of the versioned research prefix + key', () => {
  const { hashResearchRateLimitKey } = loadTs('./rate-limit.ts', { 'server-only': {}, '@/lib/prisma': { prisma: {} } })
  assert.equal(hashResearchRateLimitKey('checkout:user_1'), sha256Hex('research:v1:checkout:user_1'))
  assert.match(hashResearchRateLimitKey('checkout:user_1'), /^[0-9a-f]{64}$/)
  assert.notEqual(hashResearchRateLimitKey('checkout:user_1'), sha256Hex('checkout:user_1'))
})

test('counts attempts and limits after maxAttempts', { skip: skipDb }, async () => {
  const key = uniqueKey('counts')
  const results = []
  for (let i = 0; i < 5; i++) {
    results.push(await rateLimit.consumeResearchRateLimit({ key, windowMs: 60_000, maxAttempts: 3 }))
  }
  assert.deepEqual(results.map((r) => r.count), [1, 2, 3, 4, 5])
  assert.deepEqual(results.map((r) => r.limited), [false, false, false, true, true])
  for (const result of results) {
    assert.ok(result.retryAfterSeconds >= 59 && result.retryAfterSeconds <= 60, `retryAfter ${result.retryAfterSeconds}`)
  }
})

test('different keys have independent buckets', { skip: skipDb }, async () => {
  const a = uniqueKey('independent-a')
  const b = uniqueKey('independent-b')
  await rateLimit.consumeResearchRateLimit({ key: a, windowMs: 60_000, maxAttempts: 1 })
  const second = await rateLimit.consumeResearchRateLimit({ key: a, windowMs: 60_000, maxAttempts: 1 })
  const other = await rateLimit.consumeResearchRateLimit({ key: b, windowMs: 60_000, maxAttempts: 1 })
  assert.equal(second.limited, true)
  assert.equal(other.count, 1)
  assert.equal(other.limited, false)
})

test('the window resets once resetAt has passed', { skip: skipDb }, async () => {
  const key = uniqueKey('reset')
  const options = { key, windowMs: 150, maxAttempts: 2 }
  assert.equal((await rateLimit.consumeResearchRateLimit(options)).count, 1)
  assert.equal((await rateLimit.consumeResearchRateLimit(options)).count, 2)
  const limited = await rateLimit.consumeResearchRateLimit(options)
  assert.equal(limited.count, 3)
  assert.equal(limited.limited, true)
  assert.equal(limited.retryAfterSeconds, 1)

  await wait(250)
  const fresh = await rateLimit.consumeResearchRateLimit(options)
  assert.equal(fresh.count, 1)
  assert.equal(fresh.limited, false)

  const bucket = await prisma.researchRateLimit.findUnique({ where: { keyHash: sha256Hex(`research:v1:${key}`) } })
  assert.equal(bucket.count, 1)
  assert.ok(bucket.resetAt.getTime() > Date.now() - 50, 'resetAt moved forward to the new window')
})

test('stored resetAt matches the window in UTC, independent of the DB session time zone', { skip: skipDb }, async () => {
  const key = uniqueKey('timezone')
  const before = Date.now()
  await rateLimit.consumeResearchRateLimit({ key, windowMs: 3_600_000, maxAttempts: 10 })
  const after = Date.now()
  const bucket = await prisma.researchRateLimit.findUnique({ where: { keyHash: sha256Hex(`research:v1:${key}`) } })
  assert.ok(bucket.resetAt.getTime() >= before + 3_600_000 - 5, 'resetAt not too early')
  assert.ok(bucket.resetAt.getTime() <= after + 3_600_000 + 5, 'resetAt not too late')
  // A second call inside the window keeps resetAt unchanged.
  await rateLimit.consumeResearchRateLimit({ key, windowMs: 3_600_000, maxAttempts: 10 })
  const again = await prisma.researchRateLimit.findUnique({ where: { keyHash: sha256Hex(`research:v1:${key}`) } })
  assert.equal(again.resetAt.getTime(), bucket.resetAt.getTime())
  assert.equal(again.count, 2)
})

test('20 parallel calls are counted atomically (1..20, no duplicates)', { skip: skipDb }, async () => {
  const key = uniqueKey('concurrency')
  const results = await Promise.all(
    Array.from({ length: 20 }, () => rateLimit.consumeResearchRateLimit({ key, windowMs: 60_000, maxAttempts: 10 }))
  )
  const counts = results.map((r) => r.count).sort((a, b) => a - b)
  assert.deepEqual(counts, Array.from({ length: 20 }, (_, i) => i + 1))
  assert.equal(results.filter((r) => r.limited).length, 10)

  const bucket = await prisma.researchRateLimit.findUnique({ where: { keyHash: sha256Hex(`research:v1:${key}`) } })
  assert.equal(bucket.count, 20)
})

test('only the hash of the key is stored, never the raw key', { skip: skipDb }, async () => {
  const key = uniqueKey('hashing')
  await rateLimit.consumeResearchRateLimit({ key, windowMs: 60_000, maxAttempts: 10 })

  const rows = await pool.query(
    `SELECT "keyHash" FROM "ResearchRateLimit" WHERE "keyHash" = $1 OR "keyHash" = $2 OR "keyHash" LIKE $3`,
    [key, sha256Hex(key), `%${RUN_ID}%`]
  )
  assert.equal(rows.rowCount, 0, 'neither the raw key nor its unprefixed hash is stored')

  const hashed = await pool.query(`SELECT "keyHash", "count" FROM "ResearchRateLimit" WHERE "keyHash" = $1`, [
    sha256Hex(`research:v1:${key}`),
  ])
  assert.equal(hashed.rowCount, 1)
  assert.match(hashed.rows[0].keyHash, /^[0-9a-f]{64}$/)
})

test('consent (db): checkout consents are written together with versions, hashes and reference', { skip: skipDb }, async () => {
  const config = await import('./config.mjs')
  const reference = `test-${RUN_ID}-${randomUUID()}`
  createdConsentReferences.add(reference)
  const userId = `user_test${RUN_ID.replaceAll('-', '')}`

  const { termsId, withdrawalWaiverId } = await consent.recordCheckoutConsents({ userId, reference, tier: 'member', interval: 'year' })
  const rows = await prisma.researchConsentEvent.findMany({ where: { reference }, orderBy: { kind: 'asc' } })
  assert.deepEqual(rows.map((r) => r.id).sort(), [termsId, withdrawalWaiverId].sort())
  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]))
  assert.equal(byKind.terms_accepted.textVersion, config.RESEARCH_CONSENT_VERSIONS.terms)
  assert.equal(byKind.withdrawal_waiver.textVersion, config.RESEARCH_CONSENT_VERSIONS.withdrawalWaiver)
  assert.deepEqual(byKind.terms_accepted.metadata, { tier: 'member', interval: 'year', textSha256: sha256Hex(config.RESEARCH_CONSENT_TEXT.terms) })
  assert.deepEqual(byKind.withdrawal_waiver.metadata, { tier: 'member', interval: 'year', textSha256: sha256Hex(config.RESEARCH_CONSENT_TEXT.withdrawalWaiver) })
  for (const row of rows) assert.equal(row.userId, userId)

  const { id } = await consent.recordResearchConsent({ userId, kind: 'checkout_session_created', reference, metadata: { sessionId: 'cs_test_123' } })
  const created = await prisma.researchConsentEvent.findUnique({ where: { id } })
  assert.equal(created.kind, 'checkout_session_created')
  assert.equal(created.textVersion, `${config.RESEARCH_CONSENT_VERSIONS.terms}+${config.RESEARCH_CONSENT_VERSIONS.withdrawalWaiver}`)
  assert.deepEqual(created.metadata, { sessionId: 'cs_test_123' })

  const withoutMetadata = await consent.recordResearchConsent({ userId: null, kind: 'checkout_completed', textVersion: 'custom-v1', reference })
  const completed = await prisma.researchConsentEvent.findUnique({ where: { id: withoutMetadata.id } })
  assert.equal(completed.userId, null)
  assert.equal(completed.textVersion, 'custom-v1')
  assert.equal(completed.metadata, null)
})

test('consent (db): a failing second insert rolls back the first', { skip: skipDb }, async () => {
  const reference = `test-${RUN_ID}-${randomUUID()}`
  createdConsentReferences.add(reference)
  // Real client and real $transaction; only the second create is sabotaged
  // (violates NOT NULL on "kind" in the database). Without a transaction the
  // first row would stay behind.
  let creates = 0
  const failingPrisma = {
    researchConsentEvent: {
      create: (args) => {
        creates += 1
        return creates === 2
          ? prisma.researchConsentEvent.create({ ...args, data: { ...args.data, kind: undefined } })
          : prisma.researchConsentEvent.create(args)
      },
    },
    $transaction: (operations) => prisma.$transaction(operations),
  }
  const failingConsent = loadTs('./consent.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma: failingPrisma, withPrismaRetry: (operation) => operation() },
    '@/lib/research/config.mjs': await import('./config.mjs'),
  })
  await assert.rejects(failingConsent.recordCheckoutConsents({ userId: 'user_x', reference, tier: 'reader', interval: 'month' }))
  assert.equal(creates, 2)
  assert.equal(await prisma.researchConsentEvent.count({ where: { reference } }), 0)
})
