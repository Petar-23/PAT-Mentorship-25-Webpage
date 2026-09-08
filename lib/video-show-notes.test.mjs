import test from 'node:test'
import assert from 'node:assert/strict'
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
const normalization = loadTs('./video-show-notes.ts')
function scenario({ role = 'admin', userId = 'petar', updateError, lookupError, current = { showNotes: 'Neuere Fassung' } } = {}) {
  const calls = []
  const authz = loadTs('./authz.ts', {
    'server-only': {}, react: { cache: fn => fn },
    '@clerk/nextjs/server': {
      auth: async () => ({ userId, sessionClaims: { org_role: `org:${role}` } }),
      clerkClient: async () => ({ users: { getOrganizationMembershipList: async () => ({ data: [{ role: `org:${role}` }] }) } }),
    },
  })
  const route = loadTs('../app/api/videos/[id]/show-notes/route.ts', {
    '@/lib/authz': authz,
    '@/lib/agent-upload-auth': loadTs('./agent-upload-auth.ts', { 'server-only': {} }),
    '@/lib/video-show-notes': normalization,
    '@/lib/prisma': { prisma: { video: {
      update: async args => { calls.push(args); if (updateError) throw updateError; return { id: args.where.id, showNotes: args.data.showNotes, updatedAt: new Date().toISOString() } },
      findUnique: async () => { if (lookupError) throw lookupError; return current },
    } } },
  })
  const request = (body, headers = {}) => route.PATCH(new Request('http://localhost/api/videos/lesson/show-notes', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }), { params: Promise.resolve({ id: 'lesson' }) })
  return { calls, request }
}

test('signed-out users and ordinary members cannot change notes, even with malformed bodies', async () => {
  for (const [options, status] of [[{ userId: null }, 401], [{ role: 'member' }, 403]]) {
    const s = scenario(options)
    assert.equal((await s.request('invalid json')).status, status)
    assert.equal(s.calls.length, 0)
  }
})
test('admin saves normalize pasted text and update only the requested notes', async () => {
  const s = scenario()
  const response = await s.request({ showNotes: '  ## Thema\r\n\r\n- Ängste & Gier  ', expectedShowNotes: null, title: 'do not change', bunnyGuid: 'do not change' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).showNotes, '## Thema\n\n- Ängste & Gier')
  assert.deepEqual(s.calls[0].where, { id: 'lesson', showNotes: null })
  assert.deepEqual(s.calls[0].data, { showNotes: '## Thema\n\n- Ängste & Gier' })
})
test('missing, malformed and oversized notes never reach the database', async () => {
  for (const body of ['bad json', null, [], {}, { showNotes: 42 }, { showNotes: false }, { showNotes: {} }, { showNotes: 'x'.repeat(30_001) }, { showNotes: 'ok', expectedShowNotes: 42 }]) {
    const s = scenario()
    assert.equal((await s.request(body)).status, 400)
    assert.equal(s.calls.length, 0)
  }
})
test('empty or null notes remove the summary; the maximum length is accepted', async () => {
  for (const showNotes of ['', ' \r\n ', null]) {
    const response = await scenario().request({ showNotes })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).showNotes, null)
  }
  assert.equal((await scenario().request({ showNotes: 'x'.repeat(30_000) })).status, 200)
})
test('a stale editor gets a conflict and the current notes without a second write', async () => {
  const s = scenario({ updateError: { code: 'P2025' } })
  const response = await s.request({ showNotes: 'Mein Entwurf', expectedShowNotes: 'Alte Fassung' })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).showNotes, 'Neuere Fassung')
  assert.equal(s.calls.length, 1)
})
test('a deleted lesson returns 404', async () => {
  const s = scenario({ updateError: { code: 'P2025' }, current: null })
  assert.equal((await s.request({ showNotes: 'Text' })).status, 404)
})
test('database failures, including a failed conflict lookup, return a retryable error', async t => {
  t.mock.method(console, 'error', () => {})
  for (const options of [{ updateError: new Error('offline') }, { updateError: { code: 'P2025' }, lookupError: new Error('offline') }]) {
    const response = await scenario(options).request({ showNotes: 'Entwurf' })
    assert.equal(response.status, 500)
    assert.match((await response.json()).error, /erneut versuchen/)
  }
})
test('only a valid agent token authorizes the production helper; invalid credentials cannot fall back to an admin session', async () => {
  const previous = process.env.AGENT_UPLOAD_TOKEN
  process.env.AGENT_UPLOAD_TOKEN = 'test-agent-token'
  try {
    for (const headers of [{ Authorization: 'Bearer test-agent-token' }, { 'x-agent-upload-token': 'test-agent-token' }]) {
      assert.equal((await scenario({ userId: null }).request({ showNotes: 'Aus der Produktion' }, headers)).status, 200)
    }
    const s = scenario()
    assert.equal((await s.request({ showNotes: 'Text' }, { Authorization: 'Bearer wrong-token' })).status, 401)
    assert.equal(s.calls.length, 0)
  } finally {
    if (previous === undefined) delete process.env.AGENT_UPLOAD_TOKEN
    else process.env.AGENT_UPLOAD_TOKEN = previous
  }
})
