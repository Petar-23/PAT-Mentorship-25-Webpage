import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => id in replacements ? replacements[id] : require(id), compiled, compiled.exports)
  return compiled.exports
}
const client = loadTs('./pdf-upload-client.ts')
const protectedPdf = loadTs('./protected-pdf.ts')
const pathname = 'pdfs/lesson/12345678-1234-1234-1234-123456789abc.pdf'
const prepare = { action: 'prepare', videoId: 'lesson', filename: 'NYPM - Protokoll.pdf', size: 5_739_687, expectedPdfUrl: null }
const complete = { action: 'complete', videoId: 'lesson', filename: prepare.filename, pathname, expectedPdfUrl: null }

const previousEnv = { BLOB_PRIVATE_READ_WRITE_TOKEN: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN, AGENT_UPLOAD_TOKEN: process.env.AGENT_UPLOAD_TOKEN }
test.beforeEach(() => {
  process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = 'private-test-token'
  process.env.AGENT_UPLOAD_TOKEN = 'agent-test-token'
})
test.afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function scenario({ role = 'admin', userId = 'petar', current = { pdfUrl: null }, updateError, lookupError, blobError, blobSize = 5_739_687, contentType = 'application/pdf', header = '%PDF-', afterConflict } = {}) {
  const calls = { token: [], reads: [], writes: [], legacyPuts: [], cancels: 0, lookups: 0 }
  const authz = loadTs('./authz.ts', {
    'server-only': {}, react: { cache: fn => fn },
    '@clerk/nextjs/server': {
      auth: async () => ({ userId, sessionClaims: { org_role: `org:${role}` } }),
      clerkClient: async () => ({ users: { getOrganizationMembershipList: async () => ({ data: [{ role: `org:${role}` }] }) } }),
    },
  })
  const route = loadTs('../app/api/upload/pdf/route.ts', {
    '@/lib/authz': authz,
    '@/lib/agent-upload-auth': loadTs('./agent-upload-auth.ts', { 'server-only': {} }),
    '@/lib/protected-pdf': protectedPdf,
    '@vercel/blob/client': { generateClientTokenFromReadWriteToken: async args => { calls.token.push(args); return 'scoped-client-token' } },
    '@vercel/blob': {
      get: async (path, options) => {
        calls.reads.push({ path, options })
        if (blobError) throw blobError
        return { statusCode: 200, blob: { size: blobSize, contentType }, stream: new ReadableStream({
          start(controller) { controller.enqueue(new TextEncoder().encode(header.slice(0, 2))); controller.enqueue(new TextEncoder().encode(header.slice(2) + 'test PDF body')) },
          cancel() { calls.cancels++ },
        }) }
      },
      put: async (...args) => { calls.legacyPuts.push(args); return { pathname } },
    },
    '@/lib/prisma': { prisma: { video: {
      findUnique: async () => { calls.lookups++; if (lookupError) throw lookupError; return calls.lookups > 1 && afterConflict !== undefined ? afterConflict : current },
      update: async args => { calls.writes.push(args); if (updateError) throw updateError; return { id: args.where.id } },
    } } },
  })
  const request = (body, headers = {}) => route.POST(new Request('http://localhost/api/upload/pdf', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }))
  return { calls, request, route }
}

test('signed-out visitors and members cannot prepare a PDF upload', async () => {
  for (const [options, status] of [[{ userId: null }, 401], [{ role: 'member' }, 403]]) {
    const s = scenario(options)
    assert.equal((await s.request('malformed')).status, status)
    assert.equal(s.calls.lookups, 0)
    assert.equal(s.calls.token.length, 0)
  }
})

test('an admin can prepare a 5.74 MB PDF with an exact-path, short-lived, size-limited token', async () => {
  const s = scenario()
  const response = await s.request(prepare)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.expectedPdfUrl, null)
  assert.equal(body.filename, 'NYPM - Protokoll.pdf')
  assert.match(body.pathname, /^pdfs\/lesson\/[a-f0-9-]+\.pdf$/)
  const token = s.calls.token[0]
  assert.equal(token.pathname, body.pathname)
  assert.equal(token.maximumSizeInBytes, 5_739_687)
  assert.deepEqual(token.allowedContentTypes, ['application/pdf'])
  assert.equal(token.allowOverwrite, false)
  assert.equal(token.addRandomSuffix, false)
  assert.ok(token.validUntil > Date.now() && token.validUntil <= Date.now() + 15 * 60 * 1000)
  assert.equal(s.calls.writes.length, 0)
  assert.equal(s.calls.legacyPuts.length, 0)
})

test('the maximum 25 MB size is accepted; invalid metadata and larger files are rejected', async () => {
  assert.equal((await scenario().request({ ...prepare, size: 25 * 1024 * 1024 })).status, 200)
  for (const body of [null, [], {}, 'bad json', { ...prepare, size: 25 * 1024 * 1024 + 1 }, { ...prepare, size: 0 }, { ...prepare, size: 1.5 }, { ...prepare, videoId: 42 }, { ...prepare, videoId: '../lesson' }, { ...prepare, filename: 'x.html' }, { ...prepare, expectedPdfUrl: 42 }]) {
    const s = scenario()
    assert.equal((await s.request(body)).status, 400)
    assert.equal(s.calls.token.length, 0)
    assert.equal(s.calls.writes.length, 0)
  }
})

test('missing lessons and stale attachment state cannot issue upload tokens', async () => {
  assert.equal((await scenario({ current: null }).request(prepare)).status, 404)
  const s = scenario({ current: { pdfUrl: '/newer.pdf' } })
  assert.equal((await s.request(prepare)).status, 409)
  assert.equal(s.calls.token.length, 0)
})

test('valid agent credentials authorize the helper; invalid explicit credentials never fall back to the admin session', async () => {
  assert.equal((await scenario({ userId: null }).request(prepare, { Authorization: 'Bearer agent-test-token' })).status, 200)
  const s = scenario()
  assert.equal((await s.request(prepare, { Authorization: 'Bearer wrong' })).status, 401)
  assert.equal(s.calls.lookups, 0)
})

test('completion reads the private PDF signature and updates only this lesson with optimistic concurrency', async () => {
  const s = scenario()
  const response = await s.request(complete)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.pdfUrl, protectedPdf.buildProtectedPdfUrl('lesson', prepare.filename, pathname))
  assert.deepEqual(s.calls.writes[0], { where: { id: 'lesson', pdfUrl: null }, data: { pdfUrl: body.pdfUrl }, select: { id: true } })
  assert.deepEqual(s.calls.reads[0], { path: pathname, options: { access: 'private', token: 'private-test-token', useCache: false } })
  assert.equal(s.calls.cancels, 1)
})

test('completion rejects missing state, paths from other lessons, URLs, traversal, and corrupt files without a write', async () => {
  for (const body of [
    { ...complete, expectedPdfUrl: undefined }, { ...complete, pathname: null },
    { ...complete, pathname: pathname.replace('/lesson/', '/other/') },
    { ...complete, pathname: 'https://example.test/file.pdf' },
    { ...complete, pathname: 'pdfs/lesson/../file.pdf' },
  ]) {
    const s = scenario()
    assert.equal((await s.request(body)).status, 400)
    assert.equal(s.calls.reads.length, 0)
    assert.equal(s.calls.writes.length, 0)
  }
  for (const options of [{ header: 'HTML!' }, { contentType: 'text/html' }, { blobSize: 0 }, { blobSize: 25 * 1024 * 1024 + 1 }]) {
    const s = scenario(options)
    assert.equal((await s.request(complete)).status, 400)
    assert.equal(s.calls.writes.length, 0)
    assert.equal(s.calls.cancels, 1)
  }
})

test('database races preserve newer attachments; repeated completion is idempotent', async () => {
  const s = scenario({ updateError: { code: 'P2025' }, afterConflict: { pdfUrl: '/newer.pdf' } })
  assert.equal((await s.request(complete)).status, 409)
  const pdfUrl = protectedPdf.buildProtectedPdfUrl('lesson', prepare.filename, pathname)
  const retry = scenario({ current: { pdfUrl } })
  assert.equal((await retry.request(complete)).status, 200)
  assert.equal(retry.calls.writes.length, 0)
  assert.equal((await scenario({ updateError: { code: 'P2025' }, afterConflict: null }).request(complete)).status, 404)
})

test('storage and database failures produce retryable errors, never a successful attachment', async () => {
  for (const options of [{ lookupError: Error('offline') }, { blobError: Error('offline') }, { updateError: Error('offline') }]) {
    const response = await scenario(options).request(complete)
    assert.equal(response.status, 500)
    assert.match((await response.json()).error, /erneut versuchen/)
  }
})

function file(size = 5_739_687, name = 'NYPM - Protokoll.pdf', type = 'application/pdf') {
  return new File(['%PDF-', new Uint8Array(size - 5)], name, { type })
}
function clientServices({ putError, saveStatus = 200, abort } = {}) {
  const calls = { metadata: [], blobs: [], stages: [], progress: [] }
  return { calls, services: {
    request: async function (url, init) {
      assert.equal(this, undefined, 'Browser fetch must not be bound to the services object')
      calls.metadata.push({ url, init, body: JSON.parse(init.body) })
      if (calls.metadata.length === 1) return Response.json({ pathname, token: 'scoped', filename: prepare.filename })
      return Response.json(saveStatus === 200 ? { pdfUrl: '/api/download/pdf/lesson/NYPM.pdf' } : { error: 'Bitte die Lektion neu laden.' }, { status: saveStatus })
    },
    put: async (path, body, options) => {
      calls.blobs.push({ path, body, options })
      options.onUploadProgress({ percentage: 64 })
      if (abort) abort.abort()
      if (putError) throw putError
      return { pathname: path }
    },
  } }
}

test('a real 5.74 MB File goes directly to Blob; both Function requests contain only small JSON metadata', async () => {
  const s = clientServices()
  const pdf = file()
  const url = await client.uploadLessonPdf(pdf, { videoId: 'lesson', expectedPdfUrl: null, onStage: stage => s.calls.stages.push(stage), onProgress: value => s.calls.progress.push(value) }, s.services)
  assert.equal(url, '/api/download/pdf/lesson/NYPM.pdf')
  assert.equal(s.calls.blobs[0].body, pdf)
  assert.equal(s.calls.blobs[0].options.access, 'private')
  assert.equal(s.calls.blobs[0].options.multipart, true)
  assert.deepEqual(s.calls.stages, ['uploading', 'saving'])
  assert.deepEqual(s.calls.progress, [64])
  assert.equal(s.calls.metadata.length, 2)
  for (const call of s.calls.metadata) {
    assert.equal(call.init.headers['Content-Type'], 'application/json')
    assert.ok(Buffer.byteLength(call.init.body) < 1024)
    assert.equal(call.url, '/api/upload/pdf')
  }
  assert.equal(s.calls.metadata[1].body.expectedPdfUrl, null)
})

test('client rejects invalid PDFs before requesting permission or sending any file', async () => {
  for (const pdf of [new File(['not-pdf'], 'test.pdf', { type: 'application/pdf' }), file(5, 'x.html'), file(5, 'x.pdf', 'text/html'), file(25 * 1024 * 1024 + 1), new File([], 'x.pdf')]) {
    const s = clientServices()
    await assert.rejects(client.uploadLessonPdf(pdf, { videoId: 'lesson', expectedPdfUrl: null }, s.services))
    assert.equal(s.calls.metadata.length, 0)
    assert.equal(s.calls.blobs.length, 0)
  }
})

test('failed upload and cancellation never send the completion request', async () => {
  for (const failure of ['error', 'cancel']) {
    const abort = new AbortController()
    const s = clientServices(failure === 'error' ? { putError: Error('Verbindung unterbrochen') } : { abort })
    await assert.rejects(client.uploadLessonPdf(file(20), { videoId: 'lesson', expectedPdfUrl: null, signal: abort.signal }, s.services))
    assert.equal(s.calls.metadata.length, 1)
    assert.equal(s.calls.blobs[0].options.abortSignal, abort.signal)
  }
})

test('a failed save never reports success; a non-JSON server error remains understandable', async () => {
  const s = clientServices({ saveStatus: 409 })
  await assert.rejects(client.uploadLessonPdf(file(20), { videoId: 'lesson', expectedPdfUrl: '/old.pdf' }, s.services), /neu laden/)
  await assert.rejects(client.uploadLessonPdf(file(20), { videoId: 'lesson', expectedPdfUrl: null }, {
    request: async () => new Response('<html>413</html>', { status: 413 }), put: async () => assert.fail('must not upload'),
  }), /erneut versuchen/)
})
