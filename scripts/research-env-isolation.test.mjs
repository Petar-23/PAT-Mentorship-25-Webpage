import test from 'node:test'
import assert from 'node:assert/strict'
import { databaseIdentity, evaluateResearchTestIsolation, fingerprint, parseEnvFile, productionDatabaseUrl, MUST_BE_EMPTY } from './research-env-isolation.mjs'

// Realistische Prisma-Postgres-URLs: der Tenant steckt im Benutzernamen, der
// Datenbankname ist bei allen gleich ("postgres").
const production = {
  DATABASE_URL: 'postgres://prodtenant01:prodsecret@db.prisma.io:5432/postgres?sslmode=require',
  STRIPE_SECRET_KEY: 'sk_live_prod',
  STRIPE_WEBHOOK_SECRET: 'whsec_prod',
  CLERK_SECRET_KEY: 'sk_live_clerk',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_prod',
  DISCORD_BOT_TOKEN: 'discord-prod',
}

function isolatedPreview(overrides = {}) {
  return {
    DATABASE_URL: 'postgres://testtenant02:testsecret@db.prisma.io:5432/postgres?sslmode=require',
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

test('databaseIdentity never contains credentials and identifies Prisma Postgres tenants', () => {
  const identity = databaseIdentity(production.DATABASE_URL)
  assert.match(identity, /^db\.prisma\.io\/tenant:[0-9a-f]{12}$/)
  assert.ok(!identity.includes('prodsecret') && !identity.includes('prodtenant01'))
  // gepoolter Host = derselbe Tenant
  assert.equal(databaseIdentity('postgres://prodtenant01:other@pooled.db.prisma.io:5432/postgres?sslmode=require'), identity)
  // anderer Tenant = andere Datenbank, obwohl Host und DB-Name gleich sind
  assert.notEqual(databaseIdentity('postgres://testtenant02:x@db.prisma.io:5432/postgres'), identity)
  // klassisches Postgres: Host, Port und Datenbankname
  assert.equal(databaseIdentity('postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/research_test?sslmode=require'), 'ep-x.eu-central-1.aws.neon.tech:5432/research_test')
  assert.equal(databaseIdentity('prisma+postgres://accelerate.prisma-data.net/?api_key=secret'), 'unverifiable')
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

test('same database as production fails: same Prisma tenant via the pooled host, or same classic host/db with other credentials', () => {
  for (const [previewUrl, productionUrl] of [
    ['postgres://prodtenant01:pw2@pooled.db.prisma.io:5432/postgres?sslmode=require', production.DATABASE_URL],
    ['postgres://other:pw@db.example.com:5432/prod_db', 'postgres://owner:pw@db.example.com:5432/prod_db'],
  ]) {
    const result = evaluateResearchTestIsolation({ preview: isolatedPreview({ DATABASE_URL: previewUrl }), production: { ...production, DATABASE_URL: productionUrl } })
    assert.equal(result.ok, false, previewUrl)
    assert.equal(result.checks.find(c => c.name === 'Datenbank ≠ Production').ok, false)
  }
})

test('Accelerate URLs cannot prove isolation', () => {
  const result = evaluateResearchTestIsolation({ preview: isolatedPreview({ DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=abc' }), production })
  assert.equal(result.checks.find(c => c.name === 'Datenbank ≠ Production').ok, false)
})

test('a DIRECT_URL pointing elsewhere than DATABASE_URL fails', () => {
  const result = evaluateResearchTestIsolation({ preview: isolatedPreview({ DIRECT_URL: production.DATABASE_URL }), production })
  assert.equal(result.ok, false)
  assert.equal(result.checks.find(c => c.name === 'DIRECT_URL zeigt auf dieselbe Test-DB').ok, false)
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

test('"disabled" branch overrides count as empty side-effect credentials and as isolated shared tokens', () => {
  const overrides = Object.fromEntries(MUST_BE_EMPTY.map(name => [name, 'disabled']))
  const preview = isolatedPreview({ ...overrides, BLOB_READ_WRITE_TOKEN: 'disabled', BUNNY_API_KEY: 'Disabled' })
  const result = evaluateResearchTestIsolation({ preview, production: { ...production, BUNNY_API_KEY: 'bunny-prod' } })
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter(c => !c.ok)))
  // ein echter Wert bleibt ein Fehler
  assert.equal(evaluateResearchTestIsolation({ preview: isolatedPreview({ ...overrides, BREVO_API_KEY: 'xkeysib-real' }), production }).ok, false)
})

test('Vercel "Sensitive" placeholders: production DB falls back to PROD_DATABASE_URL, test keys prove Stripe/Clerk isolation', () => {
  const sensitiveProduction = {
    DATABASE_URL: '[SENSITIVE]',
    PROD_DATABASE_URL: production.DATABASE_URL,
    STRIPE_SECRET_KEY: '[SENSITIVE]',
    CLERK_SECRET_KEY: '[SENSITIVE]',
    BLOB_READ_WRITE_TOKEN: production.BLOB_READ_WRITE_TOKEN,
  }
  assert.deepEqual(productionDatabaseUrl(sensitiveProduction), { url: production.DATABASE_URL, source: 'PROD_DATABASE_URL' })
  const ok = evaluateResearchTestIsolation({ preview: isolatedPreview(), production: sensitiveProduction })
  assert.equal(ok.ok, true, JSON.stringify(ok.checks.filter(c => !c.ok)))
  // Preview-DB = Production-Store (über PROD_DATABASE_URL erkannt)
  const same = evaluateResearchTestIsolation({ preview: isolatedPreview({ DATABASE_URL: production.DATABASE_URL }), production: sensitiveProduction })
  assert.equal(same.checks.find(c => c.name === 'Datenbank ≠ Production').ok, false)
  // Live-Key im Preview bei unlesbarem Production-Key fällt durch
  assert.equal(evaluateResearchTestIsolation({ preview: isolatedPreview({ STRIPE_SECRET_KEY: 'sk_live_x' }), production: sensitiveProduction }).ok, false)
  // Unlesbare Preview-DB ist nicht prüfbar
  assert.equal(evaluateResearchTestIsolation({ preview: isolatedPreview({ DATABASE_URL: '[SENSITIVE]' }), production: sensitiveProduction }).ok, false)
})

test('a missing Stripe webhook secret is a readiness gap, not an isolation failure', () => {
  const preview = isolatedPreview({ STRIPE_WEBHOOK_SECRET: undefined })
  const result = evaluateResearchTestIsolation({ preview, production })
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter(c => !c.ok)))
  assert.equal(result.readiness.find(r => r.name === 'STRIPE_WEBHOOK_SECRET gesetzt').ok, false)
  assert.equal(result.readiness.find(r => r.name === 'Research-Stripe-IDs gesetzt').ok, false)
})
