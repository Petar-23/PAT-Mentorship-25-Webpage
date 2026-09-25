import test from 'node:test'
import assert from 'node:assert/strict'
import { databaseIdentity, evaluateResearchTestIsolation, fingerprint, parseEnvFile, MUST_BE_EMPTY } from './research-env-isolation.mjs'

const production = {
  DATABASE_URL: 'postgres://user:prodsecret@db.prisma.io:5432/prod_db?sslmode=require',
  STRIPE_SECRET_KEY: 'sk_live_prod',
  STRIPE_WEBHOOK_SECRET: 'whsec_prod',
  CLERK_SECRET_KEY: 'sk_live_clerk',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_prod',
  DISCORD_BOT_TOKEN: 'discord-prod',
}

function isolatedPreview(overrides = {}) {
  return {
    DATABASE_URL: 'postgres://user:testsecret@db.prisma.io:5432/research_test?sslmode=require',
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    CLERK_SECRET_KEY: 'sk_test_clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_xyz',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test',
    ...overrides,
  }
}

test('parseEnvFile reads vercel env pull output including quotes and comments', () => {
  const env = parseEnvFile('# Created by Vercel CLI\nA="1"\nB=\'two\'\nexport C=3\nEMPTY=""\ninvalid line\n')
  assert.deepEqual(env, { A: '1', B: 'two', C: '3', EMPTY: '' })
})

test('databaseIdentity never contains credentials', () => {
  const identity = databaseIdentity(production.DATABASE_URL)
  assert.equal(identity, 'db.prisma.io:5432/prod_db')
  assert.ok(!identity.includes('prodsecret'))
  assert.equal(databaseIdentity('not a url'), 'unparseable')
  assert.equal(databaseIdentity(undefined), null)
})

test('a fully isolated preview passes and its report contains no secret values', () => {
  const preview = isolatedPreview()
  const result = evaluateResearchTestIsolation({ preview, production })
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter(c => !c.ok)))
  const report = JSON.stringify(result)
  for (const value of [...Object.values(preview), ...Object.values(production)]) {
    if (value.length > 8) assert.ok(!report.includes(value), `report leaks a value`)
  }
})

test('same database as production fails even with different credentials', () => {
  const preview = isolatedPreview({ DATABASE_URL: 'postgres://other:pw@db.prisma.io:5432/prod_db' })
  const result = evaluateResearchTestIsolation({ preview, production })
  assert.equal(result.ok, false)
  assert.equal(result.checks.find(c => c.name === 'Datenbank ≠ Production').ok, false)
})

test('live Stripe key, production Clerk and shared blob token fail', () => {
  for (const overrides of [
    { STRIPE_SECRET_KEY: 'sk_live_prod' },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_x' },
    { BLOB_READ_WRITE_TOKEN: production.BLOB_READ_WRITE_TOKEN },
  ]) {
    assert.equal(evaluateResearchTestIsolation({ preview: isolatedPreview(overrides), production }).ok, false, JSON.stringify(overrides))
  }
})

test('every side-effect credential must be empty in the research preview', () => {
  for (const name of MUST_BE_EMPTY) {
    const result = evaluateResearchTestIsolation({ preview: isolatedPreview({ [name]: 'set' }), production })
    assert.equal(result.ok, false, name)
  }
})

test('without the production file isolation is not proven', () => {
  assert.equal(evaluateResearchTestIsolation({ preview: isolatedPreview(), production: null }).ok, false)
})

test('fingerprint is stable and short', () => {
  assert.equal(fingerprint('abc'), fingerprint('abc'))
  assert.equal(fingerprint('abc').length, 12)
  assert.equal(fingerprint(''), null)
})
