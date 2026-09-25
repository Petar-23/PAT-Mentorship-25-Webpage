import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { findMisassignedCustomers } from './find-misassigned-stripe-customers.mjs'

const scriptPath = fileURLToPath(new URL('./find-misassigned-stripe-customers.mjs', import.meta.url))

test('reports only customers carrying metadata.userId plus a product-scoped key, without emails or values', () => {
  const findings = findMisassignedCustomers([
    { id: 'cus_mentor', email: 'a@example.com', metadata: { userId: 'u1' } },
    { id: 'cus_raidmap', email: 'a@example.com', metadata: { raidmapUserId: 'u1' } },
    { id: 'cus_bad_same', email: 'a@example.com', metadata: { userId: 'u1', raidmapUserId: 'u1' } },
    { id: 'cus_bad_other', email: 'b@example.com', metadata: { userId: 'u2', researchUserId: 'u3', raidmapUserId: 'u2' } },
    { id: 'cus_deleted', deleted: true, metadata: { userId: 'u1', raidmapUserId: 'u1' } },
  ])
  assert.deepEqual(findings, [
    { id: 'cus_bad_same', keys: ['userId', 'raidmapUserId'], sameUser: true },
    { id: 'cus_bad_other', keys: ['userId', 'raidmapUserId', 'researchUserId'], sameUser: false },
  ])
  assert.doesNotMatch(JSON.stringify(findings), /@|u1|u2|u3/)
})

test('refuses to run without STRIPE_SECRET_KEY and only ever lists customers', () => {
  const env = { ...process.env }
  delete env.STRIPE_SECRET_KEY
  const result = spawnSync(process.execPath, [scriptPath], { env, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /STRIPE_SECRET_KEY/)
  assert.equal(result.stdout, '')

  const source = fs.readFileSync(scriptPath, 'utf8')
  assert.match(source, /customers\.list\(/)
  assert.doesNotMatch(source, /\.(update|create|del|search)\(/)
})
