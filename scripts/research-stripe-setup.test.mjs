// Tests für --webhook-url / --rotate-webhook / --vercel-branch von
// scripts/research-stripe-setup.mjs. Produkte, Preise und Portale testet
// lib/research/stripe.test.mjs. Kein echter Stripe- oder Vercel-Aufruf: Stripe
// ist ein Fake, Vercel ein injizierter Adapter bzw. ein Fake-spawn.

import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  RESEARCH_WEBHOOK_EVENTS,
  STRIPE_API_VERSION,
  buildWebhookEndpointParams,
  classifyWebhookEndpoints,
  createVercelCliEnv,
  describeWebhookDrift,
  parseSetupArgs,
  parseVercelEnvList,
  parseWebhookUrl,
  runResearchStripeSetup,
  sanitizeCliOutput,
} from './research-stripe-setup.mjs'

const URL_A = 'https://pat-git-feat-pat-research-platform-petar.vercel.app/api/webhooks/stripe'
const URL_B = 'https://pat-git-feat-other-petar.vercel.app/api/webhooks/stripe'
const BRANCH = 'feat/pat-research-platform'
const PROJECT = 'pat-mentorship-25-webpage'
const SCOPE = 'petar23s-projects'
const OWN = Object.freeze({ pat_product: 'research', pat_webhook: 'preview' })
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]
const ID_NAMES = [
  'STRIPE_RESEARCH_PRODUCT_ID_READER',
  'STRIPE_RESEARCH_PRODUCT_ID_MEMBER',
  'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER',
  'STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL',
  'STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL',
  'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC',
]

// Stripe-Fake: wie Stripe liefert nur create das Signing-Secret, list nie.
function fakeStripe({ endpoints = [] } = {}) {
  const calls = []
  const secrets = []
  let counter = 0
  const products = []
  const prices = []
  const configurations = []
  const stored = endpoints.map(endpoint => ({ ...endpoint }))
  const page = list => async params => {
    calls.push(['list', params])
    const data = params.lookup_keys ? list.filter(item => params.lookup_keys.includes(item.lookup_key)) : list
    return { data: data.map(item => ({ ...item })), has_more: false }
  }
  const stripe = {
    products: {
      list: page(products),
      async create(params, options) {
        calls.push(['products.create', params, options])
        const product = { id: `prod_new${++counter}`, active: true, ...params }
        products.push(product)
        return product
      },
    },
    prices: {
      list: page(prices),
      async create(params, options) {
        calls.push(['prices.create', params, options])
        const price = {
          id: `price_new${++counter}`,
          active: true,
          currency: params.currency,
          unit_amount: params.unit_amount,
          recurring: { interval: params.recurring.interval, interval_count: 1 },
          tax_behavior: params.tax_behavior,
          lookup_key: params.lookup_key,
          product: params.product,
          metadata: params.metadata,
        }
        prices.push(price)
        return price
      },
    },
    billingPortal: {
      configurations: {
        list: page(configurations),
        async create(params) {
          calls.push(['configurations.create', params])
          const configuration = { id: `bpc_new${++counter}`, active: true, ...params }
          configurations.push(configuration)
          return configuration
        },
        async update(id, params) {
          calls.push(['configurations.update', id, params])
          const index = configurations.findIndex(c => c.id === id)
          configurations[index] = { ...configurations[index], ...params }
          return configurations[index]
        },
      },
    },
    webhookEndpoints: {
      list: page(stored),
      async create(params) {
        calls.push(['webhookEndpoints.create', structuredClone(params)])
        const endpoint = {
          id: `we_new${++counter}`,
          object: 'webhook_endpoint',
          status: 'enabled',
          url: params.url,
          enabled_events: [...params.enabled_events],
          api_version: params.api_version ?? null,
          description: params.description ?? null,
          metadata: { ...params.metadata },
        }
        stored.push(endpoint)
        const secret = `whsec_fakeSigningSecret${counter}x`
        secrets.push(secret)
        return { ...endpoint, secret }
      },
      async update(id, params) {
        calls.push(['webhookEndpoints.update', id, structuredClone(params)])
        const endpoint = stored.find(e => e.id === id)
        const { disabled, ...rest } = params
        Object.assign(endpoint, rest)
        if (disabled === false) endpoint.status = 'enabled'
        return { ...endpoint }
      },
      async del(id) {
        calls.push(['webhookEndpoints.del', id])
        stored.splice(stored.findIndex(e => e.id === id), 1)
        return { id, object: 'webhook_endpoint', deleted: true }
      },
    },
  }
  return { stripe, calls, secrets, endpoints: stored }
}

// Vercel-Adapter-Fake: merkt sich geschriebene Werte (Config lesbar, Sensitive nicht).
function fakeVercel({ existing = new Map(), productionBranch = 'main', listError = null, failWrite = () => false } = {}) {
  const writes = []
  const adapter = {
    async productionBranch() {
      if (productionBranch instanceof Error) throw productionBranch
      return productionBranch
    },
    async listEnv(names) {
      if (listError) throw listError
      return new Map([...existing].filter(([name]) => names.includes(name)))
    },
    async writeEnv(entry) {
      writes.push(entry)
      if (failWrite(entry)) throw new Error(`vercel env add ${entry.name} failed (exit 1): not authorized`)
      existing.set(entry.name, { value: entry.sensitive ? undefined : entry.value, sensitive: entry.sensitive })
    },
  }
  return { adapter, writes, existing }
}

const stripeWrites = calls => calls.filter(([name]) => name !== 'list')
const webhookWrites = calls => calls.filter(([name]) => name.startsWith('webhookEndpoints.'))
const argsFor = (extra = [], { apply = true } = {}) =>
  parseSetupArgs([...(apply ? ['--apply'] : []), '--terms-url', 'https://r.example/terms', '--privacy-url', 'https://r.example/privacy', ...extra])
const withBranch = (extra = []) => ['--webhook-url', URL_A, '--vercel-branch', BRANCH, ...extra]

async function run({ fake, vercel = null, args }) {
  const lines = []
  const result = await runResearchStripeSetup({ stripe: fake.stripe, args, vercel: vercel?.adapter ?? null, log: line => lines.push(line) })
  return { result, lines }
}

function assertSecretsHidden(secrets, ...haystacks) {
  const text = haystacks.map(value => (typeof value === 'string' ? value : JSON.stringify(value))).join('\n')
  for (const secret of secrets) assert.equal(text.includes(secret), false, 'signing secret leaked')
  assert.doesNotMatch(text, /whsec_/)
}

// ---------------------------------------------------------------------------
// Argumente
// ---------------------------------------------------------------------------

test('webhook url: https only, ends with /api/webhooks/stripe, no credentials, query or fragment', () => {
  assert.equal(parseWebhookUrl(URL_A), URL_A)
  assert.equal(parseWebhookUrl('https://Preview.Example.COM/api/webhooks/stripe'), 'https://preview.example.com/api/webhooks/stripe')
  assert.equal(parseSetupArgs(['--webhook-url', URL_A]).webhookUrl, URL_A)
  assert.equal(parseSetupArgs([`--webhook-url=${URL_A}`]).webhookUrl, URL_A)

  for (const [value, pattern] of [
    ['http://preview.example.com/api/webhooks/stripe', /https/],
    ['not a url', /https/],
    ['https://user:hunter2pw@preview.example.com/api/webhooks/stripe', /credentials/],
    ['https://preview.example.com/api/webhooks/paypal', /must end with \/api\/webhooks\/stripe/],
    ['https://preview.example.com/api/webhooks/stripe/', /must end with/],
    ['https://preview.example.com/api/webhooks/stripe?x-vercel-protection-bypass=tokenvalue123', /must end with/],
    ['https://preview.example.com/api/webhooks/stripe#frag', /must end with/],
    ['https://preview.example.com/', /must end with/],
  ]) {
    assert.throws(() => parseSetupArgs(['--webhook-url', value]), error => {
      assert.match(error.message, pattern)
      assert.doesNotMatch(error.message, /hunter2pw|tokenvalue123/)
      return true
    })
  }
})

test('vercel branch: main, dev and empty are refused; names are validated; rotate needs url and branch', () => {
  const args = parseSetupArgs(['--vercel-branch', BRANCH])
  assert.equal(args.vercelBranch, BRANCH)
  assert.equal(args.vercelProject, PROJECT)
  assert.equal(args.vercelScope, SCOPE)
  const custom = parseSetupArgs(['--vercel-branch', 'feat/x', '--vercel-project', 'other-project', '--vercel-scope=other-team'])
  assert.deepEqual([custom.vercelProject, custom.vercelScope], ['other-project', 'other-team'])

  for (const value of ['main', 'dev', 'Main', 'DEV']) {
    assert.throws(() => parseSetupArgs(['--vercel-branch', value]), /Refusing --vercel-branch/)
  }
  assert.throws(() => parseSetupArgs(['--vercel-branch', '']), /must not be empty/)
  assert.throws(() => parseSetupArgs(['--vercel-branch', '   ']), /must not be empty/)
  assert.throws(() => parseSetupArgs(['--vercel-branch=']), /must not be empty/)
  assert.throws(() => parseSetupArgs(['--vercel-branch', '--apply']), /Missing value/)
  for (const value of ['-rf', 'feat/../main', 'feat branch', 'feat/', 'feat;rm', 'a//b']) {
    assert.throws(() => parseSetupArgs([`--vercel-branch=${value}`]), /not a valid git branch name/)
  }
  assert.throws(() => parseSetupArgs(['--vercel-branch', BRANCH, '--vercel-project', '--scope']), /Missing value/)
  assert.throws(() => parseSetupArgs(['--vercel-branch', BRANCH, '--vercel-scope=-x']), /not a valid Vercel name/)

  assert.throws(() => parseSetupArgs(['--rotate-webhook']), /--rotate-webhook needs --webhook-url/)
  assert.throws(() => parseSetupArgs(['--rotate-webhook', '--webhook-url', URL_A]), /--rotate-webhook needs --vercel-branch/)
  assert.equal(parseSetupArgs(['--rotate-webhook', ...withBranch()]).rotateWebhook, true)
})

test('webhook helpers: exact params, classification and drift', () => {
  const params = buildWebhookEndpointParams({ url: URL_A, label: BRANCH })
  assert.deepEqual(params, {
    url: URL_A,
    enabled_events: EVENTS,
    api_version: '2024-10-28.acacia',
    description: `PAT Research preview webhook (${BRANCH})`,
    metadata: OWN,
  })
  assert.deepEqual([...RESEARCH_WEBHOOK_EVENTS], EVENTS)
  assert.equal(STRIPE_API_VERSION, '2024-10-28.acacia')

  const endpoints = [
    { id: 'we_own_a', url: URL_A, metadata: OWN },
    { id: 'we_own_b', url: URL_B, metadata: OWN },
    { id: 'we_foreign_a', url: URL_A, metadata: {} },
    { id: 'we_half_marked', url: URL_A, metadata: { pat_product: 'research' } },
    { id: 'we_mentorship', url: 'https://www.example.com/api/webhooks/stripe', metadata: {} },
  ]
  const classified = classifyWebhookEndpoints(endpoints, URL_A)
  assert.deepEqual(classified.matches.map(e => e.id), ['we_own_a'])
  assert.deepEqual(classified.ownElsewhere.map(e => e.id), ['we_own_b'])
  assert.deepEqual(classified.foreignSameUrl.map(e => e.id), ['we_foreign_a', 'we_half_marked'])

  const matching = { ...params, status: 'enabled', enabled_events: [...EVENTS].reverse() }
  assert.deepEqual(describeWebhookDrift(matching, params), [])
  assert.deepEqual(describeWebhookDrift({ ...matching, enabled_events: ['*'] }, params), ['enabled_events'])
  assert.deepEqual(describeWebhookDrift({ ...matching, enabled_events: [...EVENTS, 'charge.succeeded'] }, params), ['enabled_events'])
  assert.deepEqual(describeWebhookDrift({ ...matching, description: 'x', status: 'disabled' }, params), ['description', 'disabled'])
})

// ---------------------------------------------------------------------------
// Ablauf mit Stripe-Fake und Vercel-Adapter-Fake
// ---------------------------------------------------------------------------

test('dry run: would create the endpoint and would write all 13 variables; nothing is written anywhere', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel()
  const { result, lines } = await run({ fake, vercel, args: argsFor(withBranch(), { apply: false }) })

  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.deepEqual(vercel.writes, [])
  assert.ok(result.actions.includes(`+ would create webhook endpoint for ${URL_A} (6 events, API version 2024-10-28.acacia)`), result.actions.join('\n'))
  assert.deepEqual(result.webhook, { id: null, url: URL_A, action: 'would-create', secretObtained: false })
  assert.deepEqual(result.vercelEnv.map(entry => entry.name), ['STRIPE_WEBHOOK_SECRET', ...ID_NAMES])
  assert.ok(result.vercelEnv.every(entry => entry.status === 'would-write'))
  assert.ok(lines.includes('  + would write STRIPE_WEBHOOK_SECRET (sensitive; secret of the new endpoint)'), lines.join('\n'))
})

test('apply: creates the endpoint with exact events, api_version and metadata; the secret goes only to the Vercel writer', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel()
  const { result, lines } = await run({ fake, vercel, args: argsFor(withBranch()) })

  assert.deepEqual(webhookWrites(fake.calls), [
    [
      'webhookEndpoints.create',
      {
        url: URL_A,
        enabled_events: EVENTS,
        api_version: '2024-10-28.acacia',
        description: `PAT Research preview webhook (${BRANCH})`,
        metadata: { pat_product: 'research', pat_webhook: 'preview' },
      },
    ],
  ])
  assert.equal(fake.secrets.length, 1)
  const [secret] = fake.secrets
  assert.equal(result.webhook.action, 'created')
  assert.equal(result.webhook.secretObtained, true)
  assert.match(result.webhook.id, /^we_new/)

  // Secret zuerst (Sensitive), danach die 12 IDs (Config) mit den ausgegebenen Werten.
  assert.deepEqual(vercel.writes[0], { name: 'STRIPE_WEBHOOK_SECRET', value: secret, sensitive: true })
  const envValues = Object.fromEntries(result.envLines.map(line => line.split('=')))
  assert.deepEqual(
    vercel.writes.slice(1),
    ID_NAMES.map(name => ({ name, value: envValues[name], sensitive: false }))
  )
  assert.ok(result.vercelEnv.every(entry => entry.status === 'written'))
  assert.ok(lines.includes('  + STRIPE_WEBHOOK_SECRET written (sensitive)'))

  // Das Secret steht in keiner Logzeile, keiner Aktion, keinem Rückgabewert und keinem Stripe-Aufruf-Protokoll.
  assertSecretsHidden(fake.secrets, lines, result, fake.calls)
  assert.equal(result.envLines.some(line => line.startsWith('STRIPE_WEBHOOK_SECRET')), false)
})

test('re-run with the existing endpoint: nothing is written, the secret is skipped and --rotate-webhook is suggested', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel()
  await run({ fake, vercel, args: argsFor(withBranch()) })
  const stripeBefore = fake.calls.length
  const vercelBefore = vercel.writes.length

  const { result, lines } = await run({ fake, vercel, args: argsFor(withBranch()) })
  assert.deepEqual(stripeWrites(fake.calls.slice(stripeBefore)), [])
  assert.deepEqual(vercel.writes.slice(vercelBefore), [], 'neither the secret nor unchanged IDs are written again')
  assert.equal(result.webhook.action, 'exists')
  assert.equal(result.webhook.secretObtained, false)
  const secretEntry = result.vercelEnv[0]
  assert.equal(secretEntry.name, 'STRIPE_WEBHOOK_SECRET')
  assert.equal(secretEntry.status, 'skipped')
  assert.match(secretEntry.reason, /only on create; it is set on Vercel/)
  assert.ok(result.vercelEnv.slice(1).every(entry => entry.status === 'unchanged'))
  assert.ok(lines.some(line => line.includes('--rotate-webhook') && line.includes(result.webhook.id)), lines.join('\n'))
  assertSecretsHidden(fake.secrets, lines, result)

  // Fehlt das Secret auf Vercel, sagt der Lauf das ausdrücklich — schreibt aber nichts Erfundenes.
  const withoutSecret = fakeVercel({ existing: new Map([...vercel.existing].filter(([name]) => name !== 'STRIPE_WEBHOOK_SECRET')) })
  const missing = await run({ fake, vercel: withoutSecret, args: argsFor(withBranch()) })
  assert.deepEqual(withoutSecret.writes, [])
  assert.match(missing.result.vercelEnv[0].reason, /it is NOT set on Vercel/)
  assert.ok(missing.lines.some(line => line.includes('--rotate-webhook')))

  // Ein geänderter ID-Wert auf Vercel wird überschrieben, der Rest bleibt.
  const drifted = fakeVercel({ existing: new Map(vercel.existing) })
  drifted.existing.set('STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', { value: 'price_old', sensitive: false })
  const fixed = await run({ fake, vercel: drifted, args: argsFor(withBranch()) })
  assert.deepEqual(drifted.writes.map(entry => entry.name), ['STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY'])
  assert.equal(fixed.result.vercelEnv.find(entry => entry.name === 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY').status, 'written')
})

test('drift in events/description/status is fixed via update; the URL is never changed; api_version drift only points to --rotate-webhook', async () => {
  const own = {
    id: 'we_own',
    url: URL_A,
    status: 'disabled',
    enabled_events: ['checkout.session.completed'],
    api_version: '2023-10-16',
    description: 'old',
    metadata: { ...OWN },
  }
  const fake = fakeStripe({ endpoints: [own] })
  const host = new URL(URL_A).host

  const dry = await run({ fake, args: argsFor(['--webhook-url', URL_A], { apply: false }) })
  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.ok(dry.result.actions.includes(`~ would update webhook endpoint for ${URL_A} we_own (enabled_events, description, disabled)`), dry.result.actions.join('\n'))
  assert.ok(dry.lines.some(line => line.includes('uses API version 2023-10-16') && line.includes('--rotate-webhook')))

  const applied = await run({ fake, args: argsFor(['--webhook-url', URL_A]) })
  assert.deepEqual(webhookWrites(fake.calls), [
    ['webhookEndpoints.update', 'we_own', { enabled_events: EVENTS, description: `PAT Research preview webhook (${host})`, disabled: false }],
  ])
  assert.equal(applied.result.webhook.action, 'updated')
  assert.equal(fake.endpoints[0].url, URL_A)
  assert.deepEqual(applied.result.vercelEnv, [], 'no Vercel step without --vercel-branch')
})

test('an own endpoint for another URL and a foreign endpoint for the same URL are reported and left untouched', async () => {
  const ownB = { id: 'we_own_b', url: URL_B, status: 'enabled', enabled_events: EVENTS, api_version: STRIPE_API_VERSION, description: 'b', metadata: { ...OWN } }
  const foreignA = { id: 'we_foreign', url: URL_A, status: 'enabled', enabled_events: ['*'], api_version: null, description: 'manual', metadata: {} }
  const fake = fakeStripe({ endpoints: [ownB, foreignA] })
  const snapshot = structuredClone(fake.endpoints)

  const { result, lines } = await run({ fake, args: argsFor(['--webhook-url', URL_A]) })
  assert.deepEqual(webhookWrites(fake.calls).map(([name]) => name), ['webhookEndpoints.create'])
  assert.equal(result.webhook.action, 'created')
  assert.deepEqual(fake.endpoints.slice(0, 2), snapshot)
  assert.ok(lines.some(line => line.includes('we_own_b') && line.includes('another URL') && line.includes('left untouched')))
  assert.ok(lines.some(line => line.includes('we_foreign') && line.includes('not managed by this script')))
  // Ohne --vercel-branch: Secret wird nicht ausgegeben, nur der Hinweis, wo es zu finden ist.
  assert.ok(lines.some(line => line.includes('never printed')))
  assertSecretsHidden(fake.secrets, lines, result)
})

test('--rotate-webhook deletes only the own endpoint of this URL, recreates it and writes the new secret', async () => {
  const ownA = { id: 'we_own_a', url: URL_A, status: 'enabled', enabled_events: EVENTS, api_version: STRIPE_API_VERSION, description: `PAT Research preview webhook (${BRANCH})`, metadata: { ...OWN } }
  const ownB = { ...ownA, id: 'we_own_b', url: URL_B }
  const foreignA = { ...ownA, id: 'we_foreign_a', metadata: {} }
  const fake = fakeStripe({ endpoints: [ownA, ownB, foreignA] })

  const dryVercel = fakeVercel()
  const dry = await run({ fake, vercel: dryVercel, args: argsFor(withBranch(['--rotate-webhook']), { apply: false }) })
  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.deepEqual(dryVercel.writes, [])
  assert.equal(dry.result.webhook.action, 'would-rotate')
  assert.ok(dry.result.actions.some(line => line.startsWith(`~ would rotate webhook endpoint for ${URL_A} we_own_a`)))
  assert.equal(dry.result.vercelEnv[0].status, 'would-write')

  const vercel = fakeVercel()
  const { result, lines } = await run({ fake, vercel, args: argsFor(withBranch(['--rotate-webhook'])) })
  const hooks = webhookWrites(fake.calls)
  assert.deepEqual(hooks.map(([name, id]) => [name, typeof id === 'string' ? id : 'params']), [
    ['webhookEndpoints.del', 'we_own_a'],
    ['webhookEndpoints.create', 'params'],
  ])
  assert.deepEqual(hooks[1][1].metadata, OWN)
  assert.deepEqual(fake.endpoints.map(e => e.id).slice(0, 2), ['we_own_b', 'we_foreign_a'])
  assert.equal(result.webhook.action, 'rotated')
  assert.notEqual(result.webhook.id, 'we_own_a')
  assert.deepEqual(vercel.writes[0], { name: 'STRIPE_WEBHOOK_SECRET', value: fake.secrets[0], sensitive: true })
  assertSecretsHidden(fake.secrets, lines, result, fake.calls)
})

test('two own endpoints for the same URL abort before anything is written', async () => {
  const own = { url: URL_A, status: 'enabled', enabled_events: EVENTS, api_version: STRIPE_API_VERSION, metadata: { ...OWN } }
  const fake = fakeStripe({ endpoints: [{ ...own, id: 'we_1' }, { ...own, id: 'we_2' }] })
  const vercel = fakeVercel()
  await assert.rejects(run({ fake, vercel, args: argsFor(withBranch(['--rotate-webhook'])) }), /Found 2 research preview webhook endpoints .*\(we_1, we_2\).*nothing was changed/)
  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.deepEqual(vercel.writes, [])
})

test('the production branch of the Vercel project is refused before anything is written', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel({ productionBranch: BRANCH })
  await assert.rejects(run({ fake, vercel, args: argsFor(withBranch()) }), /production branch of the Vercel project — nothing was changed/)
  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.deepEqual(vercel.writes, [])

  // Kann Vercel den Production-Branch nicht nennen, bleibt es bei main/dev (Warnung, kein Abbruch).
  const unknown = fakeVercel({ productionBranch: new Error('api unavailable') })
  const { lines } = await run({ fake: fakeStripe(), vercel: unknown, args: argsFor(withBranch()) })
  assert.ok(lines.some(line => line.includes('could not read the production branch')))
  assert.equal(unknown.writes.length, 13)
})

test('Vercel unreachable: --apply aborts before Stripe is touched, the dry run only warns', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel({ listError: new Error('vercel env ls failed (exit 1): not logged in') })
  await assert.rejects(run({ fake, vercel, args: argsFor(withBranch()) }), /Could not read the Vercel env of branch feat\/pat-research-platform .*nothing was changed/)
  assert.deepEqual(stripeWrites(fake.calls), [])
  assert.deepEqual(vercel.writes, [])

  const { lines, result } = await run({ fake, vercel, args: argsFor(withBranch(), { apply: false }) })
  assert.ok(lines.some(line => line.startsWith('! could not read the Vercel env')))
  assert.ok(result.vercelEnv.every(entry => entry.status === 'would-write'))
})

test('a failed Vercel write stops further writes and is reported without values', async () => {
  const fake = fakeStripe()
  const vercel = fakeVercel({ failWrite: entry => entry.name === 'STRIPE_WEBHOOK_SECRET' })
  const { result, lines } = await run({ fake, vercel, args: argsFor(withBranch()) })
  assert.equal(vercel.writes.length, 1)
  assert.equal(result.vercelEnv[0].status, 'failed')
  assert.ok(result.vercelEnv.slice(1).every(entry => entry.status === 'skipped' && entry.reason === 'an earlier write failed'))
  assert.ok(lines.some(line => line.includes('was NOT stored') && line.includes('--rotate-webhook')))
  assertSecretsHidden(fake.secrets, lines, result)
})

test('--vercel-branch without an adapter is an error; without --webhook-url the secret is skipped', async () => {
  await assert.rejects(runResearchStripeSetup({ stripe: fakeStripe().stripe, args: argsFor(['--vercel-branch', BRANCH]), log: () => {} }), /needs a Vercel env adapter/)

  const vercel = fakeVercel()
  const { result } = await run({ fake: fakeStripe(), vercel, args: argsFor(['--vercel-branch', BRANCH]) })
  assert.deepEqual(result.vercelEnv[0], { name: 'STRIPE_WEBHOOK_SECRET', status: 'skipped', reason: 'no --webhook-url' })
  assert.deepEqual(vercel.writes.map(entry => entry.name), ID_NAMES)
  assert.equal(result.webhook, null)
})

// ---------------------------------------------------------------------------
// Echter Vercel-Adapter mit Fake-spawn
// ---------------------------------------------------------------------------

function fakeSpawn(respond = () => ({})) {
  const calls = []
  const spawn = (command, argv, options) => {
    const call = { command, argv: [...argv], options, stdin: '' }
    calls.push(call)
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.stdin = Object.assign(new EventEmitter(), {
      end(data) {
        if (data !== undefined) call.stdin += String(data)
        const { code = 0, stdout = '', stderr = '' } = respond(call) ?? {}
        setImmediate(() => {
          if (stdout) child.stdout.emit('data', Buffer.from(stdout))
          if (stderr) child.stderr.emit('data', Buffer.from(stderr))
          child.emit('close', code)
        })
      },
    })
    return child
  }
  return { spawn, calls }
}

const COMMON = ['--project', PROJECT, '--scope', SCOPE, '--non-interactive', '--no-color']
const CHILD_ENV = { PATH: '/usr/bin', HOME: '/tmp/home', STRIPE_SECRET_KEY: 'sk_test_mustNotReachVercel' }

test('Vercel CLI adapter: values go only via stdin, never argv; the child env has no Stripe key', async () => {
  const secret = 'whsec_adapterSecretValue42'
  const fake = fakeSpawn()
  const adapter = createVercelCliEnv({ project: PROJECT, scope: SCOPE, branch: BRANCH, spawn: fake.spawn, env: CHILD_ENV })

  await adapter.writeEnv({ name: 'STRIPE_WEBHOOK_SECRET', value: secret, sensitive: true })
  await adapter.writeEnv({ name: 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', value: 'price_123', sensitive: false })
  const [secretCall, idCall] = fake.calls
  assert.equal(secretCall.command, 'npx')
  assert.deepEqual(secretCall.argv, ['-y', 'vercel@latest', 'env', 'add', 'STRIPE_WEBHOOK_SECRET', 'preview', '--git-branch', BRANCH, '--yes', '--force', '--sensitive', ...COMMON])
  assert.equal(secretCall.stdin, secret)
  assert.equal(secretCall.argv.some(arg => arg.includes(secret)), false)
  assert.deepEqual(idCall.argv, ['-y', 'vercel@latest', 'env', 'add', 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', 'preview', '--git-branch', BRANCH, '--yes', '--force', '--no-sensitive', ...COMMON])
  assert.equal(idCall.stdin, 'price_123')
  for (const call of fake.calls) {
    assert.equal(call.options.shell, false)
    assert.deepEqual(call.options.stdio, ['pipe', 'pipe', 'pipe'])
    assert.equal(call.options.env.STRIPE_SECRET_KEY, undefined)
    assert.equal(call.options.env.PATH, '/usr/bin')
    assert.equal(call.options.env.VERCEL_TELEMETRY_DISABLED, '1')
  }

  await assert.rejects(adapter.writeEnv({ name: 'STRIPE_WEBHOOK_SECRET', value: '', sensitive: true }), /refusing to write an empty/)
  assert.equal(fake.calls.length, 2)
})

test('Vercel CLI adapter: a failing write reports exit code and stderr without the value', async () => {
  const secret = 'whsec_failingSecretValue7'
  const fake = fakeSpawn(() => ({ code: 1, stderr: `\u001b[31mError:\u001b[39m could not add ${secret}\nother whsec_unrelatedSecret9 too\nNot authorized` }))
  const adapter = createVercelCliEnv({ project: PROJECT, scope: SCOPE, branch: BRANCH, spawn: fake.spawn, env: CHILD_ENV })
  await assert.rejects(adapter.writeEnv({ name: 'STRIPE_WEBHOOK_SECRET', value: secret, sensitive: true }), error => {
    assert.match(error.message, /vercel env add STRIPE_WEBHOOK_SECRET failed \(exit 1\)/)
    assert.match(error.message, /Not authorized/)
    assert.doesNotMatch(error.message, /failingSecretValue7|unrelatedSecret9|\u001b/)
    return true
  })
  assert.equal(sanitizeCliOutput('a\nb\nc\nd'), 'b | c | d')
})

test('Vercel CLI adapter: env ls and the production branch are read with the right commands', async () => {
  const lsOutput = JSON.stringify({
    envs: [
      { key: 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', value: 'price_123', type: 'encrypted', target: ['preview'], gitBranch: BRANCH },
      { key: 'STRIPE_WEBHOOK_SECRET', type: 'sensitive', target: ['preview'], gitBranch: BRANCH },
    ],
  })
  const fake = fakeSpawn(call => {
    if (call.argv[2] === 'api') return { stdout: JSON.stringify({ id: 'prj_1', link: { type: 'github', productionBranch: 'main' } }) }
    if (call.argv[2] === 'env' && call.argv[3] === 'ls') return { stdout: `Retrieving project…\n${lsOutput}\n` }
    return {}
  })
  const adapter = createVercelCliEnv({ project: PROJECT, scope: SCOPE, branch: BRANCH, spawn: fake.spawn, env: CHILD_ENV })

  assert.equal(await adapter.productionBranch(), 'main')
  assert.deepEqual(fake.calls[0].argv, ['-y', 'vercel@latest', 'api', `/v9/projects/${PROJECT}`, '--raw', '--scope', SCOPE, '--non-interactive', '--no-color'])

  const listed = await adapter.listEnv(['STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY'])
  assert.deepEqual(fake.calls[1].argv, ['-y', 'vercel@latest', 'env', 'ls', 'preview', BRANCH, '--format', 'json', ...COMMON])
  assert.equal(fake.calls[1].stdin, '')
  assert.deepEqual([...listed], [
    ['STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY', { value: 'price_123', sensitive: false }],
    ['STRIPE_WEBHOOK_SECRET', { value: undefined, sensitive: true }],
  ])

  const failing = createVercelCliEnv({ project: PROJECT, scope: SCOPE, branch: BRANCH, spawn: fakeSpawn(() => ({ code: 1, stderr: 'Error: not logged in' })).spawn, env: CHILD_ENV })
  await assert.rejects(failing.listEnv(['X']), /vercel env ls failed \(exit 1\): Error: not logged in/)
  await assert.rejects(failing.productionBranch(), /vercel api failed/)
})

test('parseVercelEnvList keeps only Preview overrides of this branch and the requested names', () => {
  const stdout = JSON.stringify({
    envs: [
      { key: 'A', value: 'branch-value', type: 'encrypted', target: ['preview'], gitBranch: BRANCH },
      { key: 'A', value: 'all-previews', type: 'encrypted', target: ['preview'] },
      { key: 'B', value: 'other-branch', type: 'encrypted', target: ['preview'], gitBranch: 'feat/other' },
      { key: 'C', value: 'production', type: 'encrypted', target: ['production'], gitBranch: BRANCH },
      { key: 'D', value: 'secret', type: 'encrypted', visibility: 'secret', target: 'preview', gitBranch: BRANCH },
      { key: 'UNRELATED', value: 'postgres://user:pw@host/db', type: 'plain', target: ['preview'], gitBranch: BRANCH },
    ],
  })
  const parsed = parseVercelEnvList(stdout, BRANCH, ['A', 'B', 'C', 'D'])
  assert.deepEqual([...parsed], [
    ['A', { value: 'branch-value', sensitive: false }],
    ['D', { value: 'secret', sensitive: true }],
  ])
  assert.throws(() => parseVercelEnvList('no json here', BRANCH, ['A']), /unexpected Vercel CLI output/)
  assert.throws(() => parseVercelEnvList('{"foo":1}', BRANCH, ['A']), /no envs/)
})

test('end to end with the CLI adapter: the signing secret appears in exactly one child stdin and in no argv or log line', async () => {
  const fake = fakeStripe()
  let vercelEnvs = []
  const spawned = fakeSpawn(call => {
    if (call.argv[2] === 'api') return { stdout: JSON.stringify({ link: { productionBranch: 'main' } }) }
    if (call.argv[3] === 'ls') return { stdout: JSON.stringify({ envs: vercelEnvs }) }
    if (call.argv[3] === 'add') {
      const name = call.argv[4]
      const sensitive = call.argv.includes('--sensitive')
      vercelEnvs = vercelEnvs.filter(env => env.key !== name)
      vercelEnvs.push({ key: name, value: sensitive ? undefined : call.stdin, type: sensitive ? 'sensitive' : 'encrypted', target: ['preview'], gitBranch: BRANCH })
      return { stdout: `Added Environment Variable ${name} to Project ${PROJECT}` }
    }
    return { code: 1, stderr: 'unexpected command' }
  })
  const adapter = createVercelCliEnv({ project: PROJECT, scope: SCOPE, branch: BRANCH, spawn: spawned.spawn, env: CHILD_ENV })
  const lines = []
  const result = await runResearchStripeSetup({ stripe: fake.stripe, args: argsFor(withBranch()), vercel: adapter, log: line => lines.push(line) })

  const [secret] = fake.secrets
  const adds = spawned.calls.filter(call => call.argv[3] === 'add')
  assert.equal(adds.length, 13)
  assert.equal(spawned.calls.every(call => !call.argv.join(' ').includes(secret)), true)
  assert.deepEqual(spawned.calls.filter(call => call.stdin.includes(secret)).map(call => call.argv[4]), ['STRIPE_WEBHOOK_SECRET'])
  assert.ok(result.vercelEnv.every(entry => entry.status === 'written'))
  assertSecretsHidden(fake.secrets, lines, result)

  // Zweiter Lauf: Vercel meldet die IDs als gesetzt → unchanged, kein env add, Secret übersprungen.
  const before = spawned.calls.length
  const again = await runResearchStripeSetup({ stripe: fake.stripe, args: argsFor(withBranch()), vercel: adapter, log: () => {} })
  assert.deepEqual(spawned.calls.slice(before).map(call => call.argv.slice(2, 4).join(' ')), ['api /v9/projects/pat-mentorship-25-webpage', 'env ls'])
  assert.equal(again.vercelEnv[0].status, 'skipped')
  assert.ok(again.vercelEnv.slice(1).every(entry => entry.status === 'unchanged'))
})
