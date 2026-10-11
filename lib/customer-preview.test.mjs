import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'

const require = createRequire(import.meta.url)
function load(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const mod = { exports: {} }
  const safeRequire = id => {
    if (id in dependencies) return dependencies[id]
    if (['react', 'react/jsx-runtime', 'next/server'].includes(id)) return require(id)
    throw new Error(`Unexpected dependency: ${id}`)
  }
  new Function('require', 'module', 'exports', compiled)(safeRequire, mod, mod.exports)
  return mod.exports
}

const policy = load('./customer-preview-policy.ts')
const targetId = 'user_customer1'
const moduleId = '41e160b4-26fb-42b1-bde7-7b6fb25aa334'
const primary = { id: 'email_customer', emailAddress: 'customer@example.test', verification: { status: 'verified' } }
const customer = { id: targetId, firstName: 'Kunde', lastName: 'Test', primaryEmailAddressId: primary.id, emailAddresses: [primary], banned: false, locked: false }
const member = (id, role) => ({ organization: { id }, role })

test('preview capability belongs only to admins of the configured PAT organization', () => {
  assert.equal(policy.isPlatformPreviewAdmin([member('org_pat', 'org:admin')], 'org_pat'), true)
  assert.equal(policy.isPlatformPreviewAdmin([member('org_other', 'org:admin')], 'org_pat'), false)
  assert.equal(policy.isPlatformPreviewAdmin([member('org_pat', 'org:member')], 'org_pat'), false)
  assert.equal(policy.isPlatformPreviewAdmin([member('org_pat', 'org:admin')], undefined), false)
  assert.equal(policy.isPlatformPreviewAdmin([member('org_pat', 'org:admin')], ' '), false)
})

test('only supported curriculum links stay in preview, including selected lesson queries', () => {
  assert.equal(policy.customerPreviewHref(`/mentorship/modul/${moduleId}?video=lesson&view=player`, targetId),
    `/owner/customer-preview/${targetId}/modul/${moduleId}?video=lesson&view=player`)
  assert.equal(policy.customerPreviewHref('/mentorship', targetId), `/owner/customer-preview/${targetId}`)
  assert.equal(policy.customerPreviewHref(`https://www.price-action-trader.de/mentorship/modul/${moduleId}`, targetId),
    `/owner/customer-preview/${targetId}/modul/${moduleId}`)
  for (const href of ['/dashboard', '/kuendigen', '/widerrufen', '/mentorship/indicators', '/mentorship/discord',
    '/mentorship/page/test', '/mentorship/../owner', 'https://evil.test/mentorship', '//evil.test', '/api/billing',
    'https://', 'https://www.price-action-trader.de.evil.test/mentorship', 'https://www.price-action-trader.de/dashboard']) {
    assert.equal(policy.customerPreviewHref(href, targetId), null, href)
  }
})

function loadAccess({ subscribed = () => false, accessible = true, admin = true } = {}) {
  const calls = []
  const lib = load('./mentorship-access.ts', {
    'server-only': {},
    '@clerk/nextjs/server': { currentUser: async () => { calls.push('currentUser'); return { primaryEmailAddress: { emailAddress: 'admin@example.test' } } } },
    '@/lib/authz': { isMentorshipAccessible: () => accessible, getIsAdmin: async () => { calls.push('admin'); return admin } },
    '@/lib/clerk-claims': { getEmailFromSessionClaims: claims => claims?.email ?? null },
    '@/lib/mentorship-access-overrides': { isMentorshipAccessOverrideEmail: email => email === 'admin@example.test' },
    '@/lib/stripe': { hasActiveSubscription: async (...args) => { calls.push(args); return subscribed(...args) } },
  })
  return { lib, calls }
}

test('customer preview cannot inherit admin access or admin-email fallback', async () => {
  const { lib, calls } = loadAccess()
  const result = await lib.getMentorshipAccessState(targetId, { email: 'admin@example.test' }, { customerPreview: { verifiedEmail: null } })
  assert.equal(result.allowed, false)
  assert.deepEqual(calls, [[targetId, undefined, { readOnly: true }]])
})

test('customer email fallback uses only the verified target address and is read-only in both passes', async () => {
  const { lib, calls } = loadAccess({ subscribed: (id, email) => id === targetId && email === primary.emailAddress })
  const result = await lib.getMentorshipAccessState(targetId, undefined, { customerPreview: { verifiedEmail: primary.emailAddress } })
  assert.equal(result.allowed, true)
  assert.deepEqual(calls, [[targetId, undefined, { readOnly: true }], [targetId, primary.emailAddress, { readOnly: true }]])
})

test('scheduled access still blocks a subscribed customer and ordinary admin access still works', async () => {
  const { lib } = loadAccess({ subscribed: () => true, accessible: false })
  assert.equal((await lib.getMentorshipAccessState(targetId, undefined, { customerPreview: { verifiedEmail: null } })).allowed, false)
  const normal = loadAccess()
  assert.equal((await normal.lib.getMentorshipAccessState('user_admin')).allowed, true)
  assert.ok(normal.calls.includes('admin'))
})

const previousOrg = process.env.CLERK_ADMIN_ORGANIZATION_ID
test.beforeEach(() => { process.env.CLERK_ADMIN_ORGANIZATION_ID = 'org_pat' })
test.afterEach(() => {
  if (previousOrg === undefined) delete process.env.CLERK_ADMIN_ORGANIZATION_ID
  else process.env.CLERK_ADMIN_ORGANIZATION_ID = previousOrg
})

function previewFixture({ actor = 'user_admin', memberships = [member('org_pat', 'org:admin')], target = customer, failMembership = false } = {}) {
  const calls = []
  const lib = load('./customer-preview.ts', {
    'server-only': {}, react: { cache: fn => fn },
    '@clerk/nextjs/server': {
      auth: async () => ({ userId: actor, sessionClaims: { org_role: 'org:admin' } }),
      clerkClient: async () => ({ users: {
        getOrganizationMembershipList: async args => { calls.push(['memberships', args]); if (failMembership) throw new Error('Clerk unavailable'); return { data: memberships } },
        getUser: async id => { calls.push(['target', id]); if (!target) throw { status: 404 }; return target },
      } }),
    },
    '@/lib/customer-preview-policy': policy,
    '@/lib/mentorship-access': { getMentorshipAccessState: async (...args) => { calls.push(['access', ...args]); return { hasSubscription: true, allowed: true } } },
  })
  return { lib, calls }
}

test('unauthenticated, non-admin and foreign-org callers cannot load a target', async () => {
  for (const args of [{ actor: null }, { memberships: [] }, { memberships: [member('org_other', 'org:admin')] }]) {
    const { lib, calls } = previewFixture(args)
    assert.equal((await lib.getCustomerPreview(targetId)).ok, false)
    assert.equal(calls.some(([kind]) => kind === 'target' || kind === 'access'), false)
  }
})

test('missing config, forged target ids and provider failure fail closed', async () => {
  delete process.env.CLERK_ADMIN_ORGANIZATION_ID
  const missing = previewFixture()
  assert.equal((await missing.lib.getCustomerPreview(targetId)).status, 503)
  assert.deepEqual(missing.calls, [])
  process.env.CLERK_ADMIN_ORGANIZATION_ID = 'org_pat'
  const invalid = previewFixture()
  assert.equal((await invalid.lib.getCustomerPreview('../user_other')).status, 404)
  assert.equal(invalid.calls.length, 1)
  await assert.rejects(previewFixture({ failMembership: true }).lib.getCustomerPreview(targetId), /Clerk unavailable/)
})

test('target lookup passes verified primary email only; blocked accounts cannot preview content', async t => {
  t.mock.method(console, 'info', () => {})
  for (const [status, banned, locked] of [['verified', false, false], ['unverified', false, false], ['verified', true, false], ['verified', false, true]]) {
    const { lib, calls } = previewFixture({ target: { ...customer, banned, locked, emailAddresses: [{ ...primary, verification: { status } }] } })
    const result = await lib.getCustomerPreview(targetId)
    assert.equal(result.access.allowed, !banned && !locked)
    assert.deepEqual(calls.find(([kind]) => kind === 'access'), ['access', targetId, undefined,
      { customerPreview: { verifiedEmail: status === 'verified' ? primary.emailAddress : null } }])
  }
})

test('member links render scoped URLs and billing links render disabled, with normal links unchanged', () => {
  let preview = { id: targetId }
  const { MentorshipLink } = load('../components/mentorship/navigation-link.tsx', {
    './customer-preview-context': { useCustomerPreview: () => preview },
    '@/lib/customer-preview-policy': policy,
    'next/navigation': { useRouter: () => ({ prefetch: () => { throw new Error('unexpected prefetch') } }) },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children), useLinkStatus: () => ({ pending: false }) },
  })
  const render = href => renderToStaticMarkup(React.createElement(MentorshipLink, { href }, 'Test'))
  assert.match(render('/mentorship'), new RegExp(`/owner/customer-preview/${targetId}`))
  assert.match(render('/dashboard'), /aria-disabled="true"/)
  assert.doesNotMatch(render('/dashboard'), /href=/)
  preview = null
  assert.match(render('/mentorship'), /href="\/mentorship"/)
})

test('search endpoint denies before querying Clerk and only returns exact primary-email matches', async () => {
  let allowed = false
  const calls = []
  const { POST } = load('../app/api/admin/customer-preview/search/route.ts', {
    '@/lib/customer-preview': { getCustomerPreviewAdmin: async () => allowed ? { ok: true, actorId: 'user_admin' } : { ok: false, status: 403 } },
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { getUserList: async args => { calls.push(args); return { data: [customer] } } } }) },
  })
  const request = email => new Request('https://pat.test/api/admin/customer-preview/search', {
    method: 'POST', headers: { origin: 'https://pat.test' }, body: JSON.stringify({ email }),
  })
  assert.equal((await POST(request(primary.emailAddress))).status, 403)
  assert.equal(calls.length, 0)
  allowed = true
  assert.equal((await POST(request('no-email'))).status, 400)
  assert.equal((await POST(request('different@example.test'))).status, 404)
  const response = await POST(request(' CUSTOMER@EXAMPLE.TEST '))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), { customer: { id: targetId, name: 'Kunde Test', email: primary.emailAddress } })
  assert.equal((await POST(new Request('https://pat.test/api/admin/customer-preview/search', {
    method: 'POST', headers: { origin: 'https://evil.test' }, body: JSON.stringify({ email: primary.emailAddress }),
  }))).status, 403)
})

test('real shownotes keep internal links scoped, block account links and tolerate malformed URLs', () => {
  let preview = { id: targetId }
  const context = { useCustomerPreview: () => preview }
  const navigation = load('../components/mentorship/navigation-link.tsx', {
    './customer-preview-context': context,
    '@/lib/customer-preview-policy': policy,
    'next/navigation': { useRouter: () => ({ prefetch() {} }) },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children), useLinkStatus: () => ({ pending: false }) },
  })
  const { LessonShowNotes } = load('../components/mentorship/lesson-show-notes.tsx', {
    './customer-preview-context': context, './navigation-link': navigation,
    'react-markdown': { __esModule: true, default: ReactMarkdown },
    '@/components/ui/button': { Button: () => null },
    '@/components/mentorship/action-feedback-icon': { ActionFeedbackIcon: () => null },
    '@/lib/video-show-notes': { MAX_SHOW_NOTES_LENGTH: 30000, normalizeShowNotes: text => text },
  })
  const showNotes = `[Lektion](/mentorship/modul/${moduleId})\n\n[Konto](/dashboard)\n\n[Defekt](https://)`
  const render = () => renderToStaticMarkup(React.createElement(LessonShowNotes, { videoId: 'lesson', showNotes, isAdmin: false, onSaved() {} }))
  const html = render()
  assert.match(html, new RegExp(`/owner/customer-preview/${targetId}/modul/${moduleId}`))
  assert.doesNotMatch(html, /href="\/dashboard"/)
  assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 2)
  preview = null
  assert.match(render(), /href="\/dashboard"/)
})
