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

const { isSameOriginRequest, jsonError } = loadTs('./request-guards.ts')

// request.url bewusst anders als der Host-Header: nach dem Middleware-Rewrite
// zählt nur der sichtbare Host.
function request(headers) {
  return new Request('http://internal.invalid/api/research/checkout', { method: 'POST', headers })
}

test('same-origin Origin header is accepted', () => {
  const cases = [
    ['research.price-action-trader.de', 'https://research.price-action-trader.de'],
    ['www.price-action-trader.de', 'https://www.price-action-trader.de'],
    ['localhost:3000', 'http://localhost:3000'],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['[::1]:3000', 'http://[::1]:3000'],
    ['my-branch-pat.vercel.app', 'https://my-branch-pat.vercel.app'],
  ]
  for (const [host, origin] of cases) {
    assert.equal(isSameOriginRequest(request({ host, origin })), true, `${host} ← ${origin}`)
  }
})

test('host comparison is case-insensitive', () => {
  assert.equal(isSameOriginRequest(request({ host: 'Research.Price-Action-Trader.DE', origin: 'https://research.price-action-trader.de' })), true)
  assert.equal(isSameOriginRequest(request({ host: 'research.price-action-trader.de', origin: 'HTTPS://RESEARCH.PRICE-ACTION-TRADER.DE' })), true)
})

test('ports must match; default ports are normalised', () => {
  assert.equal(isSameOriginRequest(request({ host: 'localhost:3000', origin: 'http://localhost:3001' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'localhost:3000', origin: 'http://localhost' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'localhost', origin: 'http://localhost:3000' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'example.com:8443', origin: 'https://example.com' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'example.com', origin: 'https://example.com:8443' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'example.com:443', origin: 'https://example.com' })), true)
  assert.equal(isSameOriginRequest(request({ host: 'example.com', origin: 'https://example.com:443' })), true)
  assert.equal(isSameOriginRequest(request({ host: 'example.com:80', origin: 'http://example.com' })), true)
  // :443 is not the default port for http
  assert.equal(isSameOriginRequest(request({ host: 'example.com:443', origin: 'http://example.com' })), false)
})

test('cross-origin requests are rejected', () => {
  const host = 'research.price-action-trader.de'
  for (const origin of [
    'https://evil.example',
    'https://www.price-action-trader.de',
    'https://price-action-trader.de',
    'https://research.price-action-trader.de.evil.example',
    'https://evilresearch.price-action-trader.de',
    'https://sub.research.price-action-trader.de',
  ]) {
    assert.equal(isSameOriginRequest(request({ host, origin })), false, origin)
  }
})

test('null, empty and malformed origins are rejected (no Referer fallback)', () => {
  const host = 'research.price-action-trader.de'
  const referer = 'https://research.price-action-trader.de/pricing'
  for (const origin of [
    'null',
    'NULL',
    ' null ',
    '',
    '   ',
    'research.price-action-trader.de',
    '//research.price-action-trader.de',
    'ftp://research.price-action-trader.de',
    'file://research.price-action-trader.de',
    'javascript:alert(1)',
    'https://user:pass@research.price-action-trader.de',
    'https://research.price-action-trader.de/pricing',
    'https://research.price-action-trader.de?x=1',
  ]) {
    assert.equal(isSameOriginRequest(request({ host, origin, referer })), false, JSON.stringify(origin))
  }
})

test('Referer is used only when Origin is absent', () => {
  const host = 'research.price-action-trader.de'
  assert.equal(isSameOriginRequest(request({ host, referer: 'https://research.price-action-trader.de/pricing?tier=member' })), true)
  assert.equal(isSameOriginRequest(request({ host, referer: 'https://evil.example/research.price-action-trader.de' })), false)
  assert.equal(isSameOriginRequest(request({ host, referer: 'https://research.price-action-trader.de.evil.example/' })), false)
  assert.equal(isSameOriginRequest(request({ host, referer: 'https://user@research.price-action-trader.de/' })), false)
  assert.equal(isSameOriginRequest(request({ host, referer: '/pricing' })), false)
  assert.equal(isSameOriginRequest(request({ host, referer: 'not a url' })), false)
  // A matching Referer never rescues a cross-site Origin.
  assert.equal(isSameOriginRequest(request({ host, origin: 'https://evil.example', referer: 'https://research.price-action-trader.de/pricing' })), false)
})

test('requests without Origin and Referer are rejected', () => {
  assert.equal(isSameOriginRequest(request({ host: 'research.price-action-trader.de' })), false)
  assert.equal(isSameOriginRequest(request({ host: 'research.price-action-trader.de', referer: '' })), false)
})

test('missing or malformed Host header is rejected', () => {
  const origin = 'https://research.price-action-trader.de'
  assert.equal(isSameOriginRequest(new Request('https://research.price-action-trader.de/api/research/checkout', { method: 'POST', headers: { origin } })), false)
  for (const host of ['', ' ', 'research.price-action-trader.de/evil', 'evil.example@research.price-action-trader.de', 'research.price-action-trader.de:abc', 'research price-action-trader.de', 'research.price-action-trader.de:99999']) {
    assert.equal(isSameOriginRequest(request({ host, origin })), false, JSON.stringify(host))
  }
})

test('Sec-Fetch-Site: cross-site is rejected even with a matching Origin', () => {
  const headers = { host: 'research.price-action-trader.de', origin: 'https://research.price-action-trader.de' }
  assert.equal(isSameOriginRequest(request({ ...headers, 'sec-fetch-site': 'cross-site' })), false)
  assert.equal(isSameOriginRequest(request({ ...headers, 'sec-fetch-site': 'same-origin' })), true)
  assert.equal(isSameOriginRequest(request({ ...headers, 'sec-fetch-site': 'same-site' })), true)
  assert.equal(isSameOriginRequest(request({ ...headers, 'sec-fetch-site': 'none' })), true)
})

test('jsonError returns { code, message } with the given status and headers', async () => {
  const response = jsonError(429, 'rate_limited', 'Too many requests. Please try again later.', { headers: { 'Retry-After': '120' } })
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '120')
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  assert.deepEqual(await response.json(), { code: 'rate_limited', message: 'Too many requests. Please try again later.' })

  const plain = jsonError(403, 'bad_origin', 'Request origin not allowed.')
  assert.equal(plain.status, 403)
  assert.deepEqual(await plain.json(), { code: 'bad_origin', message: 'Request origin not allowed.' })
})
