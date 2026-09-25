import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  customerIdsForDbCheck,
  findMisassignedCustomers,
  findUserSubscriptionsForCustomers,
} from './find-misassigned-stripe-customers.mjs'

const scriptPath = fileURLToPath(new URL('./find-misassigned-stripe-customers.mjs', import.meta.url))

const CUSTOMERS = [
  { id: 'cus_mentor', email: 'a@example.com', currency: 'eur', metadata: { userId: 'u1' } },
  { id: 'cus_mentor_new', email: 'n@example.com', currency: null, metadata: { userId: 'u4' } },
  { id: 'cus_raidmap', email: 'a@example.com', currency: 'usd', metadata: { raidmapUserId: 'u1' } },
  { id: 'cus_bad_same', email: 'a@example.com', currency: 'usd', metadata: { userId: 'u1', raidmapUserId: 'u1' } },
  { id: 'cus_bad_other', email: 'b@example.com', metadata: { userId: 'u2', researchUserId: 'u3', raidmapUserId: 'u2' } },
  { id: 'cus_early_raidmap', email: 'c@example.com', currency: 'usd', metadata: { userId: 'u5' } },
  { id: 'cus_deleted', deleted: true, metadata: { userId: 'u1', raidmapUserId: 'u1' } },
]

test('reports customers with metadata.userId plus a product-scoped key or a non-EUR currency, without emails or values', () => {
  const findings = findMisassignedCustomers(CUSTOMERS)
  assert.deepEqual(findings, [
    { id: 'cus_bad_same', keys: ['userId', 'raidmapUserId'], sameUser: true, currency: 'usd' },
    { id: 'cus_bad_other', keys: ['userId', 'raidmapUserId', 'researchUserId'], sameUser: false, currency: null },
    { id: 'cus_early_raidmap', keys: ['userId'], sameUser: null, currency: 'usd' },
  ])
  assert.doesNotMatch(JSON.stringify(findings), /@|u1|u2|u3|u5/)
})

test('the DB check covers every product-scoped customer and every reported customer, once each', () => {
  assert.deepEqual(customerIdsForDbCheck(CUSTOMERS, findMisassignedCustomers(CUSTOMERS)), [
    'cus_raidmap', 'cus_bad_same', 'cus_bad_other', 'cus_early_raidmap',
  ])
})

test('UserSubscription lookup only SELECTs inside a READ ONLY transaction and always rolls back', async () => {
  const queries = []
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params })
      return sql.startsWith('SELECT') ? { rows: [{ userId: 'user_1', stripeCustomerId: 'cus_raidmap', status: 'trialing' }] } : {}
    },
  }
  assert.deepEqual(await findUserSubscriptionsForCustomers(db, ['cus_raidmap']), [
    { userId: 'user_1', stripeCustomerId: 'cus_raidmap', status: 'trialing' },
  ])
  assert.deepEqual(queries.map((q) => q.sql.split(' ').slice(0, 2).join(' ')), ['BEGIN READ', 'SELECT "userId",', 'ROLLBACK'])
  assert.match(queries[1].sql, /FROM "UserSubscription" WHERE "stripeCustomerId" = ANY\(\$1::text\[\]\)/)
  assert.deepEqual(queries[1].params, [['cus_raidmap']])

  queries.length = 0
  assert.deepEqual(await findUserSubscriptionsForCustomers(db, []), [])
  assert.deepEqual(queries, [])

  const failing = { query: async (sql) => { queries.push({ sql }); if (sql.startsWith('SELECT')) throw new Error('boom'); return {} } }
  await assert.rejects(findUserSubscriptionsForCustomers(failing, ['cus_x']), /boom/)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})

test('refuses to run without STRIPE_SECRET_KEY (also via a symlinked path) and never writes', () => {
  const env = { ...process.env }
  delete env.STRIPE_SECRET_KEY
  delete env.DATABASE_URL
  const result = spawnSync(process.execPath, [scriptPath], { env, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /STRIPE_SECRET_KEY/)
  assert.equal(result.stdout, '')

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misassigned-'))
  try {
    const link = path.join(dir, 'report.mjs')
    fs.symlinkSync(scriptPath, link)
    const viaLink = spawnSync(process.execPath, [link], { env, encoding: 'utf8' })
    assert.equal(viaLink.status, 1)
    assert.match(viaLink.stderr, /STRIPE_SECRET_KEY/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  const source = fs.readFileSync(scriptPath, 'utf8')
  assert.match(source, /customers\.list\(/)
  assert.doesNotMatch(source, /\.(update|create|del|search)\(/)
  assert.doesNotMatch(source, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|COMMIT)\b/)
})
