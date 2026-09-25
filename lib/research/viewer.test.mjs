// Tests für die serverseitigen Zugangs-Module von PAT Research:
// test-mode.ts, access.ts, viewer.ts (inkl. require*-Guards) und die
// Validierung von consent.ts. Alle externen Abhängigkeiten (Clerk, Prisma,
// next/navigation) sind Stubs; kein Netzwerk, keine DB.
// Am Ende: Laufzeit-Oberfläche rund um den Viewer (Segment-Grenzen, Error-
// Boundary, Skip-Link, mobile Navigation), serverseitig gerendert.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const config = await import('./config.mjs')
const accessRules = await import('./access-rules.mjs')

const NOW = Date.parse('2026-09-25T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const TEST_ENV_KEYS = ['NODE_ENV', 'RESEARCH_TEST_MODE', 'RESEARCH_TEST_ACCESS', 'RESEARCH_TEST_TIER', 'RESEARCH_TEST_INTERVAL']

async function withEnv(vars, fn) {
  const saved = Object.fromEntries(TEST_ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of TEST_ENV_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value
  }
  try {
    return await fn()
  } finally {
    for (const key of TEST_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

function loadTestMode() {
  return loadTs('./test-mode.ts', { 'server-only': {}, '@/lib/research/config.mjs': config })
}

function loadAccess({ row = null, findError } = {}) {
  const calls = []
  const prisma = {
    researchSubscription: {
      findUnique: async (args) => {
        calls.push(args)
        if (findError) throw findError
        return row
      },
    },
  }
  const access = loadTs('./access.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma, withPrismaRetry: (operation) => operation() },
    '@/lib/research/access-rules.mjs': accessRules,
    '@/lib/research/test-mode': loadTestMode(),
  })
  return { access, calls }
}

class RedirectSignal extends Error {
  constructor(url) {
    super(`NEXT_REDIRECT ${url}`)
    this.url = url
  }
}

function subscriptionRow(overrides = {}) {
  return {
    status: 'active',
    tier: 'member',
    billingInterval: 'month',
    cancelAtPeriodEnd: false,
    cancelAt: null,
    currentPeriodEnd: new Date(Date.now() + 20 * DAY),
    pastDueSince: null,
    updatedAt: new Date(Date.now() - DAY),
    ...overrides,
  }
}

function loadViewer({
  userId = 'user_member',
  sessionClaims = { email: 'member@example.com', first_name: 'Mia' },
  isAdmin = false,
  adminError,
  row = null,
  findError,
  currentUserResult = null,
  currentUserError,
  basePath = '/research',
  contextError,
} = {}) {
  const calls = { auth: 0, isAdmin: [], currentUser: 0, findUnique: [], context: 0, redirects: [], order: [] }
  const { access, calls: findCalls } = loadAccess({ row, findError })
  calls.findUnique = findCalls

  const viewer = loadTs('./viewer.ts', {
    'server-only': {},
    react: { cache: (fn) => fn },
    'next/navigation': {
      redirect: (url) => {
        calls.redirects.push(url)
        throw new RedirectSignal(url)
      },
    },
    '@clerk/nextjs/server': {
      auth: async () => {
        calls.auth += 1
        calls.order.push('auth')
        return { userId, sessionClaims: userId ? sessionClaims : null }
      },
      currentUser: async () => {
        calls.currentUser += 1
        if (currentUserError) throw currentUserError
        return currentUserResult
      },
    },
    '@/lib/authz': {
      getIsAdmin: async (id, claims) => {
        calls.isAdmin.push([id, claims])
        if (adminError) throw adminError
        return isAdmin
      },
    },
    '@/lib/clerk-claims': loadTs('../clerk-claims.ts', { 'server-only': {} }),
    '@/lib/research/access': access,
    '@/lib/research/request-context': {
      getResearchRequestContext: async () => {
        calls.context += 1
        calls.order.push('context')
        if (contextError) throw contextError
        return { basePath, origin: 'https://example.test', isResearchHost: basePath === '' }
      },
    },
  })
  return { viewer, calls }
}

async function captureRedirect(promise) {
  try {
    await promise
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url
    throw error
  }
  assert.fail('expected a redirect')
}

// ---------------------------------------------------------------------------
// test-mode.ts
// ---------------------------------------------------------------------------

test('test mode is off unless RESEARCH_TEST_MODE=1 outside production', async () => {
  const testMode = loadTestMode()
  await withEnv({}, () => {
    assert.equal(testMode.isResearchTestMode(), false)
    assert.equal(testMode.getResearchTestAccessOverride(NOW), null)
  })
  await withEnv({ RESEARCH_TEST_MODE: 'true', RESEARCH_TEST_ACCESS: 'active' }, () => {
    assert.equal(testMode.isResearchTestMode(), false)
    assert.equal(testMode.getResearchTestAccessOverride(NOW), null)
  })
  await withEnv({ NODE_ENV: 'development', RESEARCH_TEST_MODE: '1' }, () => {
    assert.equal(testMode.isResearchTestMode(), true)
  })
})

test('test mode is always off in production, even when explicitly enabled', async () => {
  const testMode = loadTestMode()
  await withEnv({ NODE_ENV: 'production', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'active' }, () => {
    assert.equal(testMode.isResearchTestMode(), false)
    assert.equal(testMode.getResearchTestAccessOverride(NOW), null)
  })
})

test('without a valid RESEARCH_TEST_ACCESS the real state is used', async () => {
  const testMode = loadTestMode()
  for (const value of [undefined, '', 'trialing', 'ACTIVE', 'yes']) {
    await withEnv({ NODE_ENV: 'development', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: value }, () => {
      assert.equal(testMode.getResearchTestAccessOverride(NOW), null, String(value))
    })
  }
})

test('each simulated state maps to the expected access decision', async () => {
  const testMode = loadTestMode()
  const expectations = {
    active: { hasAccess: true, reason: 'active', cancelAtPeriodEnd: false },
    canceling: { hasAccess: true, reason: 'active', cancelAtPeriodEnd: true },
    renewal_pending: { hasAccess: true, reason: 'renewal_pending', cancelAtPeriodEnd: false },
    past_due: { hasAccess: true, reason: 'past_due_grace', cancelAtPeriodEnd: false },
    past_due_expired: { hasAccess: false, reason: 'past_due_expired', cancelAtPeriodEnd: false },
    expired: { hasAccess: false, reason: 'period_ended', cancelAtPeriodEnd: false },
    none: { hasAccess: false, reason: 'none', cancelAtPeriodEnd: false },
  }
  assert.deepEqual([...testMode.RESEARCH_TEST_ACCESS_VALUES].sort(), Object.keys(expectations).sort())
  for (const [value, expected] of Object.entries(expectations)) {
    await withEnv({ NODE_ENV: 'test', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: value }, () => {
      const override = testMode.getResearchTestAccessOverride(NOW)
      assert.equal(override.access, value)
      const result = accessRules.computeResearchAccess(override.row, NOW)
      assert.equal(result.hasAccess, expected.hasAccess, value)
      assert.equal(result.reason, expected.reason, value)
      assert.equal(result.cancelAtPeriodEnd, expected.cancelAtPeriodEnd, value)
    })
  }
})

test('simulated past_due is inside the grace window and reports its end', async () => {
  const testMode = loadTestMode()
  await withEnv({ RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'past_due' }, () => {
    const result = accessRules.computeResearchAccess(testMode.getResearchTestAccessOverride(NOW).row, NOW)
    assert.equal(result.graceEndsAt, new Date(NOW + 48 * HOUR).toISOString())
  })
})

test('simulated tier and interval follow the env, with safe defaults', async () => {
  const testMode = loadTestMode()
  await withEnv({ RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'active', RESEARCH_TEST_TIER: 'supporter', RESEARCH_TEST_INTERVAL: 'year' }, () => {
    const result = accessRules.computeResearchAccess(testMode.getResearchTestAccessOverride(NOW).row, NOW)
    assert.equal(result.tier, 'supporter')
    assert.equal(result.interval, 'year')
    assert.equal(result.currentPeriodEnd, new Date(NOW + 365 * DAY).toISOString())
  })
  await withEnv({ RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'active', RESEARCH_TEST_TIER: 'gold', RESEARCH_TEST_INTERVAL: 'week' }, () => {
    const result = accessRules.computeResearchAccess(testMode.getResearchTestAccessOverride(NOW).row, NOW)
    assert.equal(result.tier, config.RESEARCH_DEFAULT_TIER)
    assert.equal(result.interval, config.RESEARCH_DEFAULT_INTERVAL)
    assert.equal(result.currentPeriodEnd, new Date(NOW + 30 * DAY).toISOString())
  })
})

// ---------------------------------------------------------------------------
// access.ts
// ---------------------------------------------------------------------------

test('getResearchAccessState reads the subscription row by userId', async () => {
  await withEnv({}, async () => {
    const { access, calls } = loadAccess({ row: subscriptionRow({ currentPeriodEnd: new Date(NOW + DAY), updatedAt: new Date(NOW - DAY) }) })
    const state = await access.getResearchAccessState('user_1', NOW)
    assert.equal(state.hasAccess, true)
    assert.equal(state.reason, 'active')
    assert.equal(state.source, 'subscription')
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].where, { userId: 'user_1' })
    assert.deepEqual(Object.keys(calls[0].select).sort(), [
      'billingInterval',
      'cancelAt',
      'cancelAtPeriodEnd',
      'currentPeriodEnd',
      'pastDueSince',
      'status',
      'tier',
      'updatedAt',
    ])
  })
})

test('getResearchAccessState without a row returns reason none', async () => {
  await withEnv({}, async () => {
    const { access } = loadAccess({ row: null })
    const state = await access.getResearchAccessState('user_1', NOW)
    assert.deepEqual(state, { ...accessRules.computeResearchAccess(null, NOW), source: 'subscription' })
  })
})

test('getResearchAccessState applies the access rules (ended period, renewal leeway, past_due grace)', async () => {
  await withEnv({}, async () => {
    const ended = await loadAccess({ row: subscriptionRow({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(NOW - 1) }) }).access.getResearchAccessState('user_1', NOW)
    assert.equal(ended.hasAccess, false)
    assert.equal(ended.reason, 'period_ended')

    const renewing = await loadAccess({ row: subscriptionRow({ currentPeriodEnd: new Date(NOW - 1) }) }).access.getResearchAccessState('user_1', NOW)
    assert.equal(renewing.hasAccess, true)
    assert.equal(renewing.reason, 'renewal_pending')

    const stale = await loadAccess({ row: subscriptionRow({ currentPeriodEnd: new Date(NOW - 2 * DAY) }) }).access.getResearchAccessState('user_1', NOW)
    assert.equal(stale.hasAccess, false)
    assert.equal(stale.reason, 'period_ended')

    const grace = await loadAccess({
      row: subscriptionRow({ status: 'past_due', pastDueSince: new Date(NOW - HOUR), currentPeriodEnd: new Date(NOW + DAY) }),
    }).access.getResearchAccessState('user_1', NOW)
    assert.equal(grace.hasAccess, true)
    assert.equal(grace.reason, 'past_due_grace')
  })
})

test('getResearchAccessState uses the test override without touching the DB', async () => {
  await withEnv({ NODE_ENV: 'development', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'active' }, async () => {
    const { access, calls } = loadAccess({ findError: new Error('DB must not be called') })
    const state = await access.getResearchAccessState('user_1', NOW)
    assert.equal(state.hasAccess, true)
    assert.equal(state.source, 'test')
    assert.equal(calls.length, 0)
  })
  await withEnv({ NODE_ENV: 'production', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'active' }, async () => {
    const { access, calls } = loadAccess({ row: null })
    const state = await access.getResearchAccessState('user_1', NOW)
    assert.equal(state.hasAccess, false)
    assert.equal(state.source, 'subscription')
    assert.equal(calls.length, 1)
  })
})

test('getResearchAccessState rejects a missing userId and propagates DB errors', async () => {
  await withEnv({}, async () => {
    const { access, calls } = loadAccess()
    for (const userId of ['', null, undefined]) {
      await assert.rejects(access.getResearchAccessState(userId, NOW), /requires a userId/)
    }
    assert.equal(calls.length, 0)
    await assert.rejects(loadAccess({ findError: new Error('db down') }).access.getResearchAccessState('user_1', NOW), /db down/)
  })
})

test('unavailableResearchAccessState is a fail-closed, data-free state', async () => {
  const { access } = loadAccess()
  assert.deepEqual(access.unavailableResearchAccessState(NOW), { ...accessRules.computeResearchAccess(null, NOW), source: 'subscription' })
  assert.equal(access.unavailableResearchAccessState().hasAccess, false)
})

test('withResearchAdminAccess grants access and keeps the real subscription data', async () => {
  const { access } = loadAccess()
  const base = { ...accessRules.computeResearchAccess(null, NOW), source: 'subscription' }
  assert.deepEqual(access.withResearchAdminAccess(base), { ...base, hasAccess: true, source: 'admin' })
})

// ---------------------------------------------------------------------------
// viewer.ts
// ---------------------------------------------------------------------------

test('signed-out visitors get an anonymous viewer without DB or Clerk lookups', async () => {
  await withEnv({}, async () => {
    const { viewer, calls } = loadViewer({ userId: null })
    assert.deepEqual(await viewer.getResearchViewer(), {
      userId: null,
      email: null,
      firstName: null,
      isAdmin: false,
      access: null,
      isMember: false,
      accessUnavailable: false,
    })
    assert.equal(calls.findUnique.length, 0)
    assert.equal(calls.isAdmin.length, 0)
    assert.equal(calls.currentUser, 0)
  })
})

// Layout und Seiten rendern parallel; auch eine Seite, die den Viewer allein lädt,
// darf Clerk auth() erst nach der Host-/Middleware-Prüfung aufrufen (sonst 500 statt 404).
test('getResearchViewer checks the request context before calling Clerk auth()', async () => {
  await withEnv({}, async () => {
    const { viewer, calls } = loadViewer({ row: subscriptionRow() })
    await viewer.getResearchViewer()
    assert.deepEqual(calls.order, ['context', 'auth'])

    class NotFoundSignal extends Error {}
    const skipped = loadViewer({ contextError: new NotFoundSignal('NEXT_NOT_FOUND') })
    await assert.rejects(skipped.viewer.getResearchViewer(), NotFoundSignal)
    await assert.rejects(skipped.viewer.requireResearchSignedIn('/account'), NotFoundSignal)
    assert.equal(skipped.calls.auth, 0)
    assert.equal(skipped.calls.findUnique.length, 0)
  })
})

test('members get email and first name from the session claims (no currentUser call)', async () => {
  await withEnv({}, async () => {
    const claims = { email: 'member@example.com', first_name: 'Mia' }
    const { viewer, calls } = loadViewer({ row: subscriptionRow(), sessionClaims: claims })
    const result = await viewer.getResearchViewer()
    assert.equal(result.userId, 'user_member')
    assert.equal(result.email, 'member@example.com')
    assert.equal(result.firstName, 'Mia')
    assert.equal(result.isAdmin, false)
    assert.equal(result.isMember, true)
    assert.equal(result.accessUnavailable, false)
    assert.equal(result.access.source, 'subscription')
    assert.equal(result.access.reason, 'active')
    assert.equal(calls.currentUser, 0)
    assert.deepEqual(calls.isAdmin, [['user_member', claims]])
    assert.deepEqual(calls.findUnique[0].where, { userId: 'user_member' })
  })
})

test('missing email claim falls back to currentUser()', async () => {
  await withEnv({}, async () => {
    const user = {
      firstName: '  Lena ',
      primaryEmailAddressId: 'idn_2',
      primaryEmailAddress: null,
      emailAddresses: [
        { id: 'idn_1', emailAddress: 'old@example.com' },
        { id: 'idn_2', emailAddress: 'primary@example.com' },
      ],
    }
    const { viewer, calls } = loadViewer({ sessionClaims: {}, currentUserResult: user })
    const result = await viewer.getResearchViewer()
    assert.equal(calls.currentUser, 1)
    assert.equal(result.email, 'primary@example.com')
    assert.equal(result.firstName, 'Lena')

    const withClaimName = loadViewer({ sessionClaims: { first_name: 'Claim' }, currentUserResult: { ...user, primaryEmailAddress: { emailAddress: 'direct@example.com' } } })
    const second = await withClaimName.viewer.getResearchViewer()
    assert.equal(second.email, 'direct@example.com')
    assert.equal(second.firstName, 'Claim')
  })
})

test('a failing currentUser() lookup does not break the viewer', async (t) => {
  t.mock.method(console, 'warn', () => {})
  await withEnv({}, async () => {
    const { viewer } = loadViewer({ sessionClaims: {}, currentUserError: new Error('clerk down'), row: subscriptionRow() })
    const result = await viewer.getResearchViewer()
    assert.equal(result.email, null)
    assert.equal(result.isMember, true)
  })
})

test('signed-in users without a subscription are not members', async () => {
  await withEnv({}, async () => {
    const { viewer } = loadViewer({ row: null })
    const result = await viewer.getResearchViewer()
    assert.equal(result.isMember, false)
    assert.equal(result.access.hasAccess, false)
    assert.equal(result.access.reason, 'none')
  })
})

test('canceled, expired and past_due-expired subscriptions are not members; grace is', async () => {
  await withEnv({}, async () => {
    const cases = [
      [subscriptionRow({ status: 'canceled' }), false],
      [subscriptionRow({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() - 1000) }), false],
      [subscriptionRow({ currentPeriodEnd: new Date(Date.now() - 2 * DAY) }), false],
      [subscriptionRow({ currentPeriodEnd: new Date(Date.now() - 1000) }), true], // Verlängerungs-Webhook ausstehend
      [subscriptionRow({ status: 'past_due', pastDueSince: new Date(Date.now() - 73 * HOUR) }), false],
      [subscriptionRow({ status: 'past_due', pastDueSince: new Date(Date.now() - HOUR) }), true],
      [subscriptionRow({ tier: 'monthly' }), false],
    ]
    for (const [row, isMember] of cases) {
      const result = await loadViewer({ row }).viewer.getResearchViewer()
      assert.equal(result.isMember, isMember, JSON.stringify(row))
    }
  })
})

test('admins are members with access source admin', async () => {
  await withEnv({}, async () => {
    const { viewer } = loadViewer({ isAdmin: true, row: null })
    const result = await viewer.getResearchViewer()
    assert.equal(result.isAdmin, true)
    assert.equal(result.isMember, true)
    assert.equal(result.access.source, 'admin')
    assert.equal(result.access.hasAccess, true)
    assert.equal(result.access.reason, 'none')
  })
})

test('a failing admin check fails closed', async (t) => {
  t.mock.method(console, 'warn', () => {})
  await withEnv({}, async () => {
    const { viewer } = loadViewer({ adminError: new Error('clerk down'), row: null })
    const result = await viewer.getResearchViewer()
    assert.equal(result.isAdmin, false)
    assert.equal(result.isMember, false)
  })
})

test('an explicit dev test state wins over admin elevation', async () => {
  await withEnv({ NODE_ENV: 'development', RESEARCH_TEST_MODE: '1', RESEARCH_TEST_ACCESS: 'none' }, async () => {
    const { viewer, calls } = loadViewer({ isAdmin: true })
    const result = await viewer.getResearchViewer()
    assert.equal(result.isAdmin, true)
    assert.equal(result.isMember, false)
    assert.equal(result.access.source, 'test')
    assert.equal(calls.findUnique.length, 0)
  })
})

// ---------------------------------------------------------------------------
// viewer.ts: DB-Ausfall beim Abo-Status (degraded mode)
// ---------------------------------------------------------------------------

function captureConsoleError(t) {
  const logged = []
  t.mock.method(console, 'error', (...args) => {
    logged.push(args)
  })
  return logged
}

function dbError() {
  // Prisma-ähnlicher Fehler, dessen Text die userId und eine E-Mail enthält.
  const error = new Error('Timed out fetching a connection for where: { userId: "user_member" } (member@example.com)')
  error.name = 'PrismaClientKnownRequestError'
  error.code = 'P2024'
  return error
}

test('a failing subscription lookup does not break the viewer (public pages keep rendering)', async (t) => {
  const logged = captureConsoleError(t)
  await withEnv({}, async () => {
    const { viewer, calls } = loadViewer({ findError: dbError() })
    const result = await viewer.getResearchViewer()
    assert.equal(result.userId, 'user_member')
    assert.equal(result.email, 'member@example.com')
    assert.equal(result.accessUnavailable, true)
    assert.equal(result.isMember, false)
    assert.equal(result.isAdmin, false)
    assert.deepEqual(result.access, { ...accessRules.computeResearchAccess(null), source: 'subscription' })
    assert.equal(calls.findUnique.length, 1)
  })

  assert.equal(logged.length, 1)
  const serialized = JSON.stringify(logged[0])
  assert.match(serialized, /subscription state unavailable/)
  assert.match(serialized, /P2024/)
  assert.doesNotMatch(serialized, /user_member/)
  assert.doesNotMatch(serialized, /member@example\.com/)
})

test('admins keep access when the subscription lookup fails', async (t) => {
  captureConsoleError(t)
  await withEnv({}, async () => {
    const result = await loadViewer({ isAdmin: true, findError: dbError() }).viewer.getResearchViewer()
    assert.equal(result.isAdmin, true)
    assert.equal(result.isMember, true)
    assert.equal(result.accessUnavailable, true)
    assert.equal(result.access.source, 'admin')
    assert.equal(result.access.hasAccess, true)
  })
})

test('signed-out visitors are unaffected by DB failures (no lookup)', async () => {
  await withEnv({}, async () => {
    const { viewer, calls } = loadViewer({ userId: null, findError: dbError() })
    const result = await viewer.getResearchViewer()
    assert.equal(result.accessUnavailable, false)
    assert.equal(calls.findUnique.length, 0)
  })
})

test('guards fail closed when the subscription state is unavailable (no misleading redirect)', async (t) => {
  captureConsoleError(t)
  await withEnv({}, async () => {
    for (const guard of ['requireResearchSignedIn', 'requireResearchMember']) {
      const { viewer, calls } = loadViewer({ findError: dbError() })
      await assert.rejects(viewer[guard]('/account'), (error) => {
        assert.ok(viewer.isResearchAccessUnavailableError(error), guard)
        assert.ok(error instanceof viewer.ResearchAccessUnavailableError)
        assert.equal(error.code, 'access_unavailable')
        assert.equal(error.name, 'ResearchAccessUnavailableError')
        assert.doesNotMatch(error.message, /user_|@/)
        return true
      })
      assert.deepEqual(calls.redirects, [], `${guard} must not redirect`)
    }
    assert.equal(loadViewer().viewer.isResearchAccessUnavailableError(new Error('x')), false)

    // Ausgeloggte werden trotzdem zur Anmeldung geschickt.
    assert.equal(
      await captureRedirect(loadViewer({ userId: null, basePath: '', findError: dbError() }).viewer.requireResearchMember('/notes/x')),
      '/sign-in?redirect_url=%2Fnotes%2Fx'
    )
  })
})

test('admins pass the guards even when the subscription state is unavailable', async (t) => {
  captureConsoleError(t)
  await withEnv({}, async () => {
    const signedIn = await loadViewer({ isAdmin: true, findError: dbError() }).viewer.requireResearchSignedIn('/account')
    assert.equal(signedIn.access.source, 'admin')
    const member = await loadViewer({ isAdmin: true, findError: dbError() }).viewer.requireResearchMember('/')
    assert.equal(member.isMember, true)
    assert.equal(member.accessUnavailable, true)
  })
})

test('requireResearchSignedIn redirects signed-out visitors to the research sign-in', async () => {
  await withEnv({}, async () => {
    const pathMode = loadViewer({ userId: null, basePath: '/research' })
    assert.equal(
      await captureRedirect(pathMode.viewer.requireResearchSignedIn('/account')),
      '/research/sign-in?redirect_url=%2Fresearch%2Faccount'
    )

    const hostMode = loadViewer({ userId: null, basePath: '' })
    assert.equal(await captureRedirect(hostMode.viewer.requireResearchSignedIn('/account')), '/sign-in?redirect_url=%2Faccount')
    assert.equal(
      await captureRedirect(hostMode.viewer.requireResearchSignedIn('/welcome?session_id=cs_test_1&x=a b')),
      `/sign-in?redirect_url=${encodeURIComponent('/welcome?session_id=cs_test_1&x=a b')}`
    )
  })
})

test('requireResearchSignedIn never builds an open redirect from the return path', async () => {
  await withEnv({}, async () => {
    for (const returnPath of ['//evil.example', 'https://evil.example/x', '/\\evil.example', 'evil', '', '/ok\nSet-Cookie: x', null]) {
      const { viewer } = loadViewer({ userId: null, basePath: '' })
      assert.equal(await captureRedirect(viewer.requireResearchSignedIn(returnPath)), '/sign-in?redirect_url=%2F', JSON.stringify(returnPath))
    }
  })
})

test('requireResearchSignedIn returns the viewer for signed-in users', async () => {
  await withEnv({}, async () => {
    const { viewer, calls } = loadViewer({ row: null })
    const result = await viewer.requireResearchSignedIn('/account')
    assert.equal(result.userId, 'user_member')
    assert.equal(result.isMember, false)
    assert.deepEqual(calls.redirects, [])
  })
})

test('requireResearchMember sends non-members to pricing and signed-out visitors to sign-in', async () => {
  await withEnv({}, async () => {
    assert.equal(await captureRedirect(loadViewer({ row: null, basePath: '/research' }).viewer.requireResearchMember('/notes/x')), '/research/pricing')
    assert.equal(await captureRedirect(loadViewer({ row: null, basePath: '' }).viewer.requireResearchMember('/notes/x')), '/pricing')
    assert.equal(
      await captureRedirect(loadViewer({ userId: null, basePath: '' }).viewer.requireResearchMember('/notes/x')),
      '/sign-in?redirect_url=%2Fnotes%2Fx'
    )
  })
})

test('requireResearchMember lets members and admins through', async () => {
  await withEnv({}, async () => {
    const member = await loadViewer({ row: subscriptionRow() }).viewer.requireResearchMember('/')
    assert.equal(member.isMember, true)
    assert.equal(member.access.source, 'subscription')

    const admin = await loadViewer({ isAdmin: true, row: null }).viewer.requireResearchMember('/')
    assert.equal(admin.isMember, true)
    assert.equal(admin.access.source, 'admin')
  })
})

test('researchSignInPath and normalizeResearchReturnPath', () => {
  const { viewer } = loadViewer()
  assert.equal(viewer.researchSignInPath('/research', '/pricing?tier=member&interval=year'), `/research/sign-in?redirect_url=${encodeURIComponent('/research/pricing?tier=member&interval=year')}`)
  assert.equal(viewer.normalizeResearchReturnPath('/account'), '/account')
  assert.equal(viewer.normalizeResearchReturnPath('/'), '/')
  assert.equal(viewer.normalizeResearchReturnPath('//evil'), '/')
  assert.equal(viewer.normalizeResearchReturnPath('/a\\b'), '/')
  assert.equal(viewer.normalizeResearchReturnPath('/a\u0000b'), '/')
})

// ---------------------------------------------------------------------------
// consent.ts (Validierung und Transaktionsform; DB-Test siehe
// rate-limit.integration.test.mjs)
// ---------------------------------------------------------------------------

function loadConsent() {
  const creates = []
  let transactions = 0
  const prisma = {
    researchConsentEvent: {
      create: (args) => {
        creates.push(args)
        return Promise.resolve({ id: `evt_${creates.length}` })
      },
    },
    $transaction: async (operations) => {
      transactions += 1
      assert.ok(Array.isArray(operations))
      return Promise.all(operations)
    },
  }
  const consent = loadTs('./consent.ts', {
    'server-only': {},
    '@/lib/prisma': { prisma, withPrismaRetry: (operation) => operation() },
    '@/lib/research/config.mjs': config,
  })
  return { consent, creates, transactions: () => transactions }
}

test('recordResearchConsent appends one row with the default text version per kind', async () => {
  const { consent, creates } = loadConsent()
  const combined = `${config.RESEARCH_CONSENT_VERSIONS.terms}+${config.RESEARCH_CONSENT_VERSIONS.withdrawalWaiver}`
  const expectedVersions = {
    terms_accepted: config.RESEARCH_CONSENT_VERSIONS.terms,
    withdrawal_waiver: config.RESEARCH_CONSENT_VERSIONS.withdrawalWaiver,
    checkout_session_created: combined,
    checkout_completed: combined,
  }
  assert.deepEqual([...consent.RESEARCH_CONSENT_KINDS].sort(), Object.keys(expectedVersions).sort())
  for (const [kind, textVersion] of Object.entries(expectedVersions)) {
    assert.equal(consent.researchConsentTextVersion(kind), textVersion)
  }

  const result = await consent.recordResearchConsent({ userId: 'user_1', kind: 'checkout_session_created', reference: 'ref-1', metadata: { sessionId: 'cs_1' } })
  assert.deepEqual(result, { id: 'evt_1' })
  assert.deepEqual(creates[0], {
    data: { userId: 'user_1', kind: 'checkout_session_created', textVersion: combined, reference: 'ref-1', metadata: { sessionId: 'cs_1' } },
    select: { id: true },
  })

  await consent.recordResearchConsent({ userId: null, kind: 'checkout_completed', textVersion: 'explicit-v2' })
  assert.deepEqual(creates[1].data, { userId: null, kind: 'checkout_completed', textVersion: 'explicit-v2', reference: null })
})

test('recordResearchConsent rejects invalid input before writing', async () => {
  const { consent, creates } = loadConsent()
  const valid = { userId: 'user_1', kind: 'terms_accepted', reference: 'ref' }
  const invalid = [
    { ...valid, kind: 'email_opt_in' },
    { ...valid, kind: undefined },
    { ...valid, userId: '' },
    { ...valid, userId: 'x'.repeat(256) },
    { ...valid, userId: undefined },
    { ...valid, textVersion: '' },
    { ...valid, textVersion: 'v'.repeat(201) },
    { ...valid, reference: '' },
    { ...valid, reference: 'r'.repeat(256) },
    { ...valid, metadata: ['a'] },
    { ...valid, metadata: 'text' },
    null,
  ]
  for (const input of invalid) {
    await assert.rejects(consent.recordResearchConsent(input), /Invalid research consent/, JSON.stringify(input))
  }
  assert.equal(creates.length, 0)
})

test('recordCheckoutConsents writes terms and waiver in one transaction', async () => {
  const { consent, creates, transactions } = loadConsent()
  const result = await consent.recordCheckoutConsents({ userId: 'user_1', reference: 'ref-9', tier: 'supporter', interval: 'year' })
  assert.deepEqual(result, { termsId: 'evt_1', withdrawalWaiverId: 'evt_2' })
  assert.equal(transactions(), 1)
  assert.equal(creates.length, 2)
  assert.deepEqual(creates.map((c) => c.data.kind), ['terms_accepted', 'withdrawal_waiver'])
  assert.deepEqual(creates.map((c) => c.data.textVersion), [config.RESEARCH_CONSENT_VERSIONS.terms, config.RESEARCH_CONSENT_VERSIONS.withdrawalWaiver])
  for (const create of creates) {
    assert.equal(create.data.userId, 'user_1')
    assert.equal(create.data.reference, 'ref-9')
    assert.equal(create.data.metadata.tier, 'supporter')
    assert.equal(create.data.metadata.interval, 'year')
    assert.match(create.data.metadata.textSha256, /^[0-9a-f]{64}$/)
  }
  assert.notEqual(creates[0].data.metadata.textSha256, creates[1].data.metadata.textSha256)
})

test('recordCheckoutConsents rejects invalid tier, interval, user or reference', async () => {
  const { consent, creates, transactions } = loadConsent()
  const valid = { userId: 'user_1', reference: 'ref', tier: 'member', interval: 'month' }
  for (const input of [
    { ...valid, tier: 'gold' },
    { ...valid, interval: 'week' },
    { ...valid, userId: '' },
    { ...valid, reference: '' },
    { ...valid, reference: undefined },
    null,
  ]) {
    await assert.rejects(consent.recordCheckoutConsents(input), /Invalid research consent/, JSON.stringify(input))
  }
  assert.equal(creates.length, 0)
  assert.equal(transactions(), 0)
})

// ---------------------------------------------------------------------------
// Research-Oberfläche: Segment-Grenzen, Error-Boundary, Skip-Link, mobile Navigation
// ---------------------------------------------------------------------------

// Lädt eine TSX-Datei als CommonJS; jeder Import muss explizit ersetzt werden.
function loadTsx(relativePath, deps) {
  const url = new URL(relativePath, import.meta.url)
  const { outputText } = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    fileName: url.pathname,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const compiledModule = { exports: {} }
  const load = (id) => {
    if (id in deps) return deps[id]
    throw new Error(`unexpected import in test: ${id}`)
  }
  new Function('require', 'module', 'exports', outputText)(load, compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const h = React.createElement
const iconStub = (name) => ({ className }) => h('svg', { 'data-icon': name, className })

function findElement(node, predicate) {
  if (node === null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate)
      if (found) return found
    }
    return null
  }
  if (predicate(node)) return node
  return findElement(node.props?.children, predicate)
}

// Ein loading.tsx legt die Seiten in eine Suspense-Grenze: notFound()/redirect()
// kämen dann als HTTP 200 mit Meta-Refresh statt als 404/307 an.
test('research route segments have no loading boundary', () => {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
      if (entry.isDirectory()) walk(url)
      else if (/^loading\.[jt]sx?$/.test(entry.name)) found.push(url.pathname)
    }
  }
  walk(new URL('../../app/research/', import.meta.url))
  assert.deepEqual(found, [])
})

function loadResearchError({ calls }) {
  const router = { refresh: () => calls.push('refresh') }
  return loadTsx('../../app/research/error.tsx', {
    'react/jsx-runtime': jsxRuntime,
    // Übergänge laufen im Test synchron, damit die Komponente auch ohne Renderer aufrufbar ist.
    react: { ...React, useTransition: () => [false, (callback) => callback()] },
    'next/link': { default: ({ href, prefetch, children, ...props }) => h('a', { href, ...props }, children) },
    'next/navigation': { useRouter: () => router },
    '@/components/research/base-path': { useResearchHref: () => (path) => (path === '/' ? '/research' : `/research${path}`) },
  })
}

test('the research error boundary explains the outage in English and retries with refresh + reset', () => {
  const source = fs.readFileSync(new URL('../../app/research/error.tsx', import.meta.url), 'utf8')
  assert.match(source, /^'use client'/)

  const calls = []
  const { default: ResearchError } = loadResearchError({ calls })
  const reset = () => calls.push('reset')
  // In Production kommt vom Server nur ein generischer Fehler mit Digest an.
  const error = Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '4242' })

  const html = renderToStaticMarkup(h(ResearchError, { error, reset }))
  assert.match(html, /Your membership status is temporarily unavailable\. Please try again in a moment\./)
  assert.match(html, /<button type="button" class="r-button">Try again<\/button>/) // .r-button: min-height 44px
  assert.match(html, /<a href="\/research" class="r-button" data-variant="secondary">Go to the research home<\/a>/)
  assert.match(html, /Reference: 4242/)
  assert.doesNotMatch(html, /Server Components render/)
  assert.doesNotMatch(renderToStaticMarkup(h(ResearchError, { error: new Error('x'), reset })), /Reference:/)

  const tryAgain = findElement(ResearchError({ error, reset }), (element) => element.type === 'button')
  tryAgain.props.onClick()
  assert.deepEqual(calls, ['refresh', 'reset'])
})

test('research pages hide the German root skip link; the shell renders an English one first', async () => {
  const css = fs.readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /body:has\(\[data-hide-root-navbar="true"\]\) a\[href="#main-content"\]\s*\{\s*display:\s*none;\s*\}/)

  const { ResearchShell } = loadTsx('../../components/research/shell.tsx', {
    'react/jsx-runtime': jsxRuntime,
    react: React,
    '@/components/mentorship/icons': { Sun: iconStub('sun'), Moon: iconStub('moon'), SidebarSimple: iconStub('sidebar') },
    'next/link': { default: ({ href, prefetch, children, ...props }) => h('a', { href, ...props }, children) },
    'next/image': { default: () => h('img', { alt: '' }) },
    '@clerk/nextjs': { UserButton: () => null, useAuth: () => ({ isLoaded: false }) },
    '@/components/research/base-path': { useResearchHref: () => (path) => path, useResearchLogicalPath: () => '/' },
    '@/components/research/sign-in-link': { ResearchSignInLink: () => h('a', { href: '/sign-in' }, 'Sign in') },
    '@/lib/research/ui.mjs': await import('./ui.mjs'),
  })
  const html = renderToStaticMarkup(h(ResearchShell, { signedIn: false, headerNavigation: h('button', { type: 'button' }, 'Menu') }, h('p', null, 'Body')))

  const firstFocusable = html.match(/<(a|button|input|select|textarea)\b[^>]*>[^<]*/)?.[0]
  assert.equal(firstFocusable, '<a href="#research-content" class="sr-only focus:not-sr-only r-skip-link">Skip to content')
  const target = html.match(/<div[^>]*\bid="research-content"[^>]*>/)?.[0]
  assert.ok(target, 'skip target exists')
  assert.match(target, /tabindex="-1"/)
})

function loadMobileNavigation({ container, simulateMount }) {
  // SSR (und die Hydration) liest den Server-Snapshot. Für den Zustand "nach dem Mount"
  // liefert useSyncExternalStore den Client-Snapshot, wie React nach der Hydration.
  const react = simulateMount
    ? { ...React, useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot() }
    : React
  return loadTsx('../../components/research/mobile-navigation.tsx', {
    'react/jsx-runtime': jsxRuntime,
    react,
    '@/components/mentorship/icons': { List: iconStub('list'), X: iconStub('x') },
    'next/image': { default: () => h('img', { alt: '' }) },
    '@/components/research/shell': {
      useResearchMobileNavigation: () => ({ open: false, setOpen: () => {}, container }),
      useResearchTheme: () => 'light',
    },
    '@/components/research/sidebar': { ResearchSidebar: () => null },
    '@/components/ui/button': {
      Button: ({ variant, size, children, ...props }) => h('button', { ...props, 'data-variant': variant, 'data-size': size }, children),
    },
    // Stellvertreter für den Radix-Dialog (dessen Trigger bekommt eine useId-abhängige aria-controls).
    '@/components/ui/slide-over': {
      SlideOver: ({ children }) => h('div', { 'data-radix-dialog': '' }, children),
      SlideOverTrigger: ({ children }) => children,
      SlideOverContent: () => null,
    },
  }).ResearchMobileNavigation
}

test('the mobile navigation server-renders a plain disabled trigger and adds the dialog only after mount', () => {
  const props = { isMember: false, signedIn: false }
  const trigger = '<button class="m-menu-trigger" aria-label="Open research menu" title="Open research menu" disabled="" data-variant="ghost" data-size="icon"><svg data-icon="list" class="h-5 w-5"></svg></button>'

  // Server-HTML und Hydration: kein Dialog, also keine Radix-ids, die abweichen könnten.
  for (const container of [null, {}]) {
    const html = renderToStaticMarkup(h(loadMobileNavigation({ container, simulateMount: false }), props))
    assert.equal(html, trigger)
  }

  // Nach dem Mount: derselbe Trigger im Dialog, aktiv sobald der Portal-Container existiert.
  const mountedWithoutContainer = renderToStaticMarkup(h(loadMobileNavigation({ container: null, simulateMount: true }), props))
  assert.equal(mountedWithoutContainer, `<div data-radix-dialog="">${trigger}</div>`)
  const mounted = renderToStaticMarkup(h(loadMobileNavigation({ container: {}, simulateMount: true }), props))
  assert.equal(mounted, `<div data-radix-dialog="">${trigger.replace(' disabled=""', '')}</div>`)
})
