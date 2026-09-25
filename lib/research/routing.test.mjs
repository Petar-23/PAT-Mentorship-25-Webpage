import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import * as routing from './routing.mjs'

const {
  getResearchHosts,
  getResearchPublicOrigin,
  isResearchBrowserHostname,
  isResearchHostname,
  isResearchPathModeAllowed,
  isResearchPathname,
  isResearchServedOnHost,
  logicalResearchPath,
  researchBasePathForHost,
  researchHref,
  resolveResearchRequestContext,
  resolveResearchRoute,
} = routing

// Lädt ein TS/TSX-Modul als CommonJS; jeder Import muss explizit ersetzt werden.
function loadTs(relativePath, replacements) {
  const url = new URL(relativePath, import.meta.url)
  const { outputText } = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    fileName: url.pathname,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const compiledModule = { exports: {} }
  const load = (id) => {
    if (id in replacements) return replacements[id]
    throw new Error(`unexpected import in test: ${id}`)
  }
  new Function('require', 'module', 'exports', outputText)(load, compiledModule, compiledModule.exports)
  return compiledModule.exports
}

const RESEARCH_HOST = 'research.price-action-trader.de'
const RESEARCH_ORIGIN = `https://${RESEARCH_HOST}`
const MAIN_HOST = 'www.price-action-trader.de'

const ENVS = {
  test: {},
  development: { NODE_ENV: 'development' },
  preview: { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
  previewStaging: {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    RESEARCH_PUBLIC_HOST: 'research-staging.price-action-trader.de',
  },
  production: { NODE_ENV: 'production', VERCEL_ENV: 'production', RESEARCH_PUBLIC_HOST: RESEARCH_HOST },
  productionKilled: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
  selfHosted: { NODE_ENV: 'production', RESEARCH_PUBLIC_HOST: RESEARCH_HOST },
  selfHostedPathMode: { NODE_ENV: 'production', RESEARCH_ALLOW_PATH_MODE: '1' },
}

// Kodierte Trenner: Next routet sie wie die Klartext-Form (Abgleich auch auf dem
// dekodierten Pfad), sie dürfen Kill-Switch und Host-Regeln nicht umgehen.
const ENCODED_RESEARCH_PAGE_PATHS = [
  '/research%2Fpricing',
  '/research%2F',
  '/research%2fpricing',
  '/%72esearch%2Fpricing',
  '/research%252Fpricing',
  '/research%25252Fpricing',
  '/research%5Cpricing',
  '/research%2F%2Fevil.com',
  '/%2Fresearch',
  '/%2Fresearch%2Fpricing',
  '/research%2Fsign-in%2Fa.png',
]
const ENCODED_RESEARCH_API_PATHS = [
  '/api/research%2Fcheckout',
  '/api%2Fresearch%2Fcheckout',
  '/api%2fresearch%2fportal',
  '/%61pi%2Fresearch%2Fcheckout',
  '/api%252Fresearch%252Fcheckout',
  '/api%5Cresearch%5Ccheckout',
]
const ENCODED_RESEARCH_PATHS = [...ENCODED_RESEARCH_PAGE_PATHS, ...ENCODED_RESEARCH_API_PATHS]

const NEXT = { type: 'next' }
const NOT_FOUND = { type: 'not_found' }
const rewrite = (pathname) => ({ type: 'rewrite', pathname })
const redirect = (location) => ({ type: 'redirect', location, status: 308 })

function route(host, pathname, env, search = '') {
  return resolveResearchRoute({ host, pathname, search, env })
}

test('path mode is only allowed outside production', () => {
  const cases = [
    [{}, true],
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'test' }, true],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'preview' }, true],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'development' }, true],
    [{ NODE_ENV: 'development', VERCEL_ENV: 'development' }, true],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', VERCEL_ENV: ' production ' }, false],
    [{ VERCEL_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'production', RESEARCH_ALLOW_PATH_MODE: '1' }, false],
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', VERCEL_ENV: '' }, false],
    [{ NODE_ENV: 'production', RESEARCH_ALLOW_PATH_MODE: '1' }, true],
    [{ NODE_ENV: 'production', RESEARCH_ALLOW_PATH_MODE: 'true' }, false],
    [{ NODE_ENV: 'production', RESEARCH_ALLOW_PATH_MODE: '0' }, false],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'staging' }, false],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'staging', RESEARCH_ALLOW_PATH_MODE: '1' }, true],
    [{ NODE_ENV: 'development', VERCEL_ENV: 'custom' }, true],
  ]
  for (const [env, expected] of cases) {
    assert.equal(isResearchPathModeAllowed(env), expected, JSON.stringify(env))
  }
})

test('research hosts are normalised, validated, deduplicated and respect the kill switch', () => {
  const cases = [
    [ENVS.production, [RESEARCH_HOST]],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: ' Research.Price-Action-Trader.DE:443 ' }, [RESEARCH_HOST]],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: 'https://research.price-action-trader.de/' }, [RESEARCH_HOST]],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: 'research.price-action-trader.de.' }, [RESEARCH_HOST]],
    [
      {
        ...ENVS.production,
        RESEARCH_EXTRA_HOSTS:
          'research-staging.price-action-trader.de, RESEARCH.example.com:8443,,not a host,evil.com/path,user@evil.com,research.price-action-trader.de',
      },
      [RESEARCH_HOST, 'research-staging.price-action-trader.de', 'research.example.com'],
    ],
    [ENVS.productionKilled, []],
    [{ ...ENVS.productionKilled, RESEARCH_EXTRA_HOSTS: 'research-staging.price-action-trader.de' }, []],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: 'research.price-action-trader.de/evil' }, []],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: 'evil.com@research.price-action-trader.de' }, []],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: 'research.price-action-trader.de:0' }, []],
    [{ ...ENVS.production, RESEARCH_PUBLIC_HOST: '   ' }, []],
    [ENVS.selfHosted, [RESEARCH_HOST]],
    [ENVS.selfHostedPathMode, ['research.localhost']],
    [ENVS.development, ['research.localhost']],
    [ENVS.test, ['research.localhost']],
    [ENVS.previewStaging, ['research-staging.price-action-trader.de', 'research.localhost']],
    [{ ...ENVS.development, RESEARCH_EXTRA_HOSTS: 'Research.Localhost:3000' }, ['research.localhost']],
  ]
  for (const [env, expected] of cases) {
    assert.deepEqual(getResearchHosts(env), expected, JSON.stringify(env))
  }
})

test('the public research origin is always https on the configured host', () => {
  assert.equal(getResearchPublicOrigin(ENVS.production), RESEARCH_ORIGIN)
  assert.equal(getResearchPublicOrigin({ RESEARCH_PUBLIC_HOST: 'http://Research.Example.com:8443/' }), 'https://research.example.com:8443')
  assert.equal(getResearchPublicOrigin(ENVS.productionKilled), null)
  assert.equal(getResearchPublicOrigin({ RESEARCH_PUBLIC_HOST: 'evil.com/@research' }), null)
  assert.equal(getResearchPublicOrigin({ RESEARCH_PUBLIC_HOST: 'javascript:alert(1)' }), null)
})

test('research hostnames match case-insensitively, with or without port', () => {
  const cases = [
    [RESEARCH_HOST, ENVS.production, true],
    ['RESEARCH.Price-Action-Trader.DE', ENVS.production, true],
    [`${RESEARCH_HOST}:443`, ENVS.production, true],
    [`${RESEARCH_HOST}.`, ENVS.production, true],
    [` ${RESEARCH_HOST} `, ENVS.production, true],
    [MAIN_HOST, ENVS.production, false],
    ['price-action-trader.de', ENVS.production, false],
    [`${RESEARCH_HOST}.evil.com`, ENVS.production, false],
    [`evil.${RESEARCH_HOST}`, ENVS.production, false],
    ['evil.com', ENVS.production, false],
    [`${RESEARCH_HOST}:abc`, ENVS.production, false],
    [`${RESEARCH_HOST}:`, ENVS.production, false],
    [`${RESEARCH_HOST}:99999`, ENVS.production, false],
    [`${RESEARCH_HOST}/x`, ENVS.production, false],
    [`user@${RESEARCH_HOST}`, ENVS.production, false],
    ['', ENVS.production, false],
    [null, ENVS.production, false],
    [undefined, ENVS.production, false],
    ['research.localhost:3000', ENVS.production, false],
    ['research.localhost:3000', ENVS.development, true],
    ['research.localhost', ENVS.preview, true],
    ['localhost:3000', ENVS.development, false],
    ['[::1]:3000', ENVS.development, false],
    [RESEARCH_HOST, ENVS.productionKilled, false],
    [RESEARCH_HOST, ENVS.development, false],
    ['research-staging.price-action-trader.de', ENVS.previewStaging, true],
  ]
  for (const [host, env, expected] of cases) {
    assert.equal(isResearchHostname(host, env), expected, `${host} ${JSON.stringify(env)}`)
  }
})

test('base path is empty on research hosts and /research everywhere else', () => {
  assert.equal(researchBasePathForHost(RESEARCH_HOST, ENVS.production), '')
  assert.equal(researchBasePathForHost(`${RESEARCH_HOST.toUpperCase()}:443`, ENVS.production), '')
  assert.equal(researchBasePathForHost(MAIN_HOST, ENVS.production), '/research')
  assert.equal(researchBasePathForHost('research.localhost:3000', ENVS.development), '')
  assert.equal(researchBasePathForHost('localhost:3000', ENVS.development), '/research')
  assert.equal(researchBasePathForHost('pat-git-feat.vercel.app', ENVS.preview), '/research')
  assert.equal(researchBasePathForHost(null, ENVS.development), '/research')
  assert.equal(researchBasePathForHost(RESEARCH_HOST, ENVS.productionKilled), '/research')
})

test('research is served on research hosts and in path mode, never on the main host in production', () => {
  const cases = [
    [RESEARCH_HOST, ENVS.production, true],
    [`${RESEARCH_HOST.toUpperCase()}:443`, ENVS.production, true],
    [MAIN_HOST, ENVS.production, false],
    ['price-action-trader.de', ENVS.production, false],
    [null, ENVS.production, false],
    ['', ENVS.production, false],
    [RESEARCH_HOST, ENVS.selfHosted, true],
    [MAIN_HOST, ENVS.selfHosted, false],
    // Kill-Switch: nirgends, auch nicht auf den (nicht mehr gültigen) Research-Hosts.
    [RESEARCH_HOST, ENVS.productionKilled, false],
    [MAIN_HOST, ENVS.productionKilled, false],
    ['research.localhost:3000', ENVS.productionKilled, false],
    [RESEARCH_HOST, { ...ENVS.productionKilled, RESEARCH_EXTRA_HOSTS: RESEARCH_HOST }, false],
    [MAIN_HOST, { NODE_ENV: 'production' }, false],
    // Pfad-Modus (Preview, lokal, next start mit RESEARCH_ALLOW_PATH_MODE=1): überall.
    [MAIN_HOST, ENVS.preview, true],
    ['pat-git-feat.vercel.app', ENVS.previewStaging, true],
    ['localhost:3000', ENVS.development, true],
    [null, ENVS.development, true],
    ['localhost:3000', ENVS.test, true],
    [MAIN_HOST, ENVS.selfHostedPathMode, true],
  ]
  for (const [host, env, expected] of cases) {
    assert.equal(isResearchServedOnHost(host, env), expected, `${host} ${JSON.stringify(env)}`)
  }
})

test('researchHref prefixes app-relative paths with the base path', () => {
  const cases = [
    ['', '/', '/'],
    ['/research', '/', '/research'],
    ['', '/pricing', '/pricing'],
    ['/research', '/pricing', '/research/pricing'],
    ['/research', '/pricing?x=1', '/research/pricing?x=1'],
    ['', '/pricing?x=1', '/pricing?x=1'],
    ['/research', '/?checkout=cancelled', '/research?checkout=cancelled'],
    ['/research', '/#top', '/research#top'],
    ['/research', '/account/', '/research/account/'],
    ['/research', '/sign-in?redirect_url=%2Fresearch%2Fpricing', '/research/sign-in?redirect_url=%2Fresearch%2Fpricing'],
  ]
  for (const [basePath, path, expected] of cases) {
    assert.equal(researchHref(basePath, path), expected, `${basePath} ${path}`)
  }
})

test('researchHref rejects absolute, protocol-relative and malformed paths', () => {
  const badPaths = ['', 'pricing', ' /pricing', '//evil.com', '//evil.com/research', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/\t/evil.com', '/x\ny', null, undefined, 42]
  for (const basePath of ['', '/research']) {
    for (const path of badPaths) {
      assert.throws(() => researchHref(basePath, path), TypeError, `${basePath} ${JSON.stringify(path)}`)
    }
  }
  for (const basePath of ['/research/', 'research', '/Research', '/other', null, undefined]) {
    assert.throws(() => researchHref(basePath, '/'), TypeError, String(basePath))
  }
})

test('logicalResearchPath strips the base and normalises slashes', () => {
  const cases = [
    ['/research', '/research', '/'],
    ['/research', '/research/', '/'],
    ['/research', '/research/pricing', '/pricing'],
    ['/research', '/research/pricing/', '/pricing'],
    ['/research', '/research/notes/a-b', '/notes/a-b'],
    ['/research', '//research//pricing', '/pricing'],
    ['/research', '/researcher', '/researcher'],
    ['/research', '/', '/'],
    ['', '/', '/'],
    ['', '/pricing', '/pricing'],
    ['', '/account/', '/account'],
    // Server-Rendering auf dem Research-Host kann den umgeschriebenen Pfad liefern.
    ['', '/research', '/'],
    ['', '/research/pricing', '/pricing'],
    ['', '', '/'],
    ['', null, '/'],
    ['/research', undefined, '/'],
  ]
  for (const [basePath, pathname, expected] of cases) {
    assert.equal(logicalResearchPath(basePath, pathname), expected, `${basePath} ${pathname}`)
  }
  assert.throws(() => logicalResearchPath('/other', '/research'), TypeError)
})

test('research host: pages are rewritten into app/research, APIs and MCP into app/api/research', () => {
  const cases = [
    ['/', rewrite('/research')],
    ['/pricing', rewrite('/research/pricing')],
    ['/pricing/', rewrite('/research/pricing')],
    ['/notes/abc', rewrite('/research/notes/abc')],
    ['/notes/%C3%A4', rewrite('/research/notes/%C3%A4')],
    ['/sign-in', rewrite('/research/sign-in')],
    ['/sign-in/factor-one', rewrite('/research/sign-in/factor-one')],
    ['/feed.xml', rewrite('/research/feed.xml')],
    ['/researcher', rewrite('/research/researcher')],
    ['/mentorship', rewrite('/research/mentorship')],
    ['/dashboard', rewrite('/research/dashboard')],
    ['/api/v1', rewrite('/api/research/v1')],
    ['/api/v1/', rewrite('/api/research/v1')],
    ['/api/v1/notes', rewrite('/api/research/v1/notes')],
    ['/api/v1/notes/my-slug', rewrite('/api/research/v1/notes/my-slug')],
    ['/api/v10', NEXT],
    ['/api/research/checkout', NEXT],
    ['/api/research/portal', NEXT],
    ['/api/webhooks/stripe', NEXT],
    ['/api/mentorship-status', NEXT],
    ['/api', NEXT],
    ['/mcp', rewrite('/api/research/mcp')],
    ['/mcp/', rewrite('/api/research/mcp')],
    ['/mcp/extra', rewrite('/research/mcp/extra')],
    ['/mcpx', rewrite('/research/mcpx')],
    ['/.well-known/oauth-protected-resource', rewrite('/api/research/oauth-protected-resource')],
    ['/.well-known/oauth-protected-resource/mcp', rewrite('/api/research/oauth-protected-resource/mcp')],
    ['/.well-known/oauth-protected-resourcex', rewrite('/research/.well-known/oauth-protected-resourcex')],
    ['/.well-known/oauth-authorization-server', rewrite('/research/.well-known/oauth-authorization-server')],
    ['/_next/static/chunks/app.js', NEXT],
    ['/_vercel/insights/view', NEXT],
    ['/__nextjs_original-stack-frames', NEXT],
  ]
  for (const host of [RESEARCH_HOST, 'RESEARCH.Price-Action-Trader.DE', `${RESEARCH_HOST}:443`]) {
    for (const [pathname, expected] of cases) {
      assert.deepEqual(route(host, pathname, ENVS.production, '?q=1'), expected, `${host}${pathname}`)
    }
  }
  // Lokal im Host-Modus und auf der Staging-Domain gelten dieselben Regeln.
  assert.deepEqual(route('research.localhost:3000', '/pricing', ENVS.development), rewrite('/research/pricing'))
  assert.deepEqual(route('research.localhost:3000', '/api/v1/topics', ENVS.development), rewrite('/api/research/v1/topics'))
  assert.deepEqual(route('research-staging.price-action-trader.de', '/', ENVS.previewStaging), rewrite('/research'))
})

test('research host: a visible /research prefix redirects (308) to the canonical path, keeping the query', () => {
  const cases = [
    ['/research', '?a=1', redirect('/?a=1')],
    ['/research/', '', redirect('/')],
    ['/research/pricing', '?tier=member&interval=year', redirect('/pricing?tier=member&interval=year')],
    ['/research/pricing/', '', redirect('/pricing')],
    ['/research/notes/abc', 'x=1', redirect('/notes/abc?x=1')],
    ['/research/pricing', '?', redirect('/pricing')],
    ['/research/pricing', undefined, redirect('/pricing')],
    ['/research/pricing', null, redirect('/pricing')],
    ['/%72esearch/pricing', '', redirect('/pricing')],
    ['/research/research', '', redirect('/research')],
  ]
  for (const [pathname, search, expected] of cases) {
    assert.deepEqual(route(RESEARCH_HOST, pathname, ENVS.production, search), expected, `${pathname}${search}`)
    assert.deepEqual(route('research.localhost:3000', pathname, ENVS.development, search), expected, `local ${pathname}${search}`)
  }
})

test('main host: main-site paths are never touched in any environment', () => {
  const paths = [
    '/',
    '/mentorship',
    '/mentorship/lesson/abc',
    '/raid-map',
    '/raid-map/de',
    '/raid-map/docs/de',
    '/api/webhooks/stripe',
    '/api/webhooks/paypal',
    '/api/mentorship-status',
    '/sign-in',
    '/sign-in/factor-one',
    '/sign-up',
    '/dashboard',
    '/owner',
    '/owner/blog',
    '/blog/research',
    '/researcher',
    '/research-notes',
    '/api/researchers',
    '/api/research-x',
    '/api/v1/notes',
    '/mcp',
    '/.well-known/oauth-protected-resource',
    '/robots.txt',
    // Kodierte Trenner außerhalb von Research bleiben ebenfalls unangetastet.
    '/mentorship%2Flesson%2Fabc',
    '/api%2Fwebhooks%2Fstripe',
    '/researcher%2Fx',
    '/blog%2Fresearch',
    '/api%2Fresearchers',
    '/%72esearcher',
    '/research-notes%2Fx',
    '/%E2%82%AC%2Fresearch',
    '/%ZZresearch',
  ]
  const hosts = [MAIN_HOST, 'price-action-trader.de', 'localhost:3000', 'pat-git-feat-research.vercel.app', null, '']
  for (const env of Object.values(ENVS)) {
    for (const host of hosts) {
      for (const pathname of paths) {
        assert.deepEqual(route(host, pathname, env, '?success=true'), NEXT, `${host}${pathname} ${JSON.stringify(env)}`)
      }
    }
  }
})

test('main host: /research is served in path mode (preview, development)', () => {
  for (const env of [ENVS.test, ENVS.development, ENVS.preview, ENVS.previewStaging, ENVS.selfHostedPathMode]) {
    for (const host of [MAIN_HOST, 'localhost:3000', 'pat-git-feat-research.vercel.app']) {
      for (const pathname of ['/research', '/research/', '/research/pricing', '/api/research/checkout', '/api/research', ...ENCODED_RESEARCH_PATHS]) {
        assert.deepEqual(route(host, pathname, env), NEXT, `${host}${pathname} ${JSON.stringify(env)}`)
      }
    }
  }
})

test('main host in production: research pages move to the research host, research APIs are not served', () => {
  for (const env of [ENVS.production, ENVS.selfHosted]) {
    assert.deepEqual(route(MAIN_HOST, '/research', env), redirect(`${RESEARCH_ORIGIN}/`))
    assert.deepEqual(route(MAIN_HOST, '/research/', env), redirect(`${RESEARCH_ORIGIN}/`))
    assert.deepEqual(route(MAIN_HOST, '/research/pricing', env, '?tier=member'), redirect(`${RESEARCH_ORIGIN}/pricing?tier=member`))
    assert.deepEqual(route('PRICE-ACTION-TRADER.DE:443', '/research/notes/a/', env), redirect(`${RESEARCH_ORIGIN}/notes/a`))
    assert.deepEqual(route(null, '/research/pricing', env), redirect(`${RESEARCH_ORIGIN}/pricing`))
    assert.deepEqual(route(MAIN_HOST, '/%72esearch/pricing', env), redirect(`${RESEARCH_ORIGIN}/pricing`))
    assert.deepEqual(route(MAIN_HOST, '/api/research/checkout', env), NOT_FOUND)
    assert.deepEqual(route(MAIN_HOST, '/api/research', env), NOT_FOUND)
    assert.deepEqual(route(MAIN_HOST, '/api/%72esearch/portal', env), NOT_FOUND)
  }
  const withPort = { ...ENVS.production, RESEARCH_PUBLIC_HOST: 'research.example.com:8443' }
  assert.deepEqual(route(MAIN_HOST, '/research/pricing', withPort), redirect('https://research.example.com:8443/pricing'))
})

test('main host in production: encoded separators are not served (404, never a redirect built from decoded input)', () => {
  for (const env of [ENVS.production, ENVS.selfHosted, ENVS.productionKilled]) {
    for (const host of [MAIN_HOST, 'PRICE-ACTION-TRADER.DE:443', null]) {
      for (const pathname of ENCODED_RESEARCH_PATHS) {
        for (const search of ['', '?tier=member']) {
          assert.deepEqual(route(host, pathname, env, search), NOT_FOUND, `${host}${pathname}${search} ${JSON.stringify(env)}`)
        }
      }
    }
  }
})

test('kill switch: production without RESEARCH_PUBLIC_HOST makes research unreachable on every host', () => {
  const killed = [ENVS.productionKilled, { ...ENVS.productionKilled, RESEARCH_EXTRA_HOSTS: `${RESEARCH_HOST},research-staging.price-action-trader.de` }, { ...ENVS.production, RESEARCH_PUBLIC_HOST: 'not a host' }, { NODE_ENV: 'production' }]
  const hosts = [MAIN_HOST, RESEARCH_HOST, 'research-staging.price-action-trader.de', 'research.localhost:3000', null]
  for (const env of killed) {
    for (const host of hosts) {
      for (const pathname of ['/research', '/research/pricing', '/api/research/checkout', '/api/research/portal', ...ENCODED_RESEARCH_PATHS]) {
        assert.deepEqual(route(host, pathname, env), NOT_FOUND, `${host}${pathname} ${JSON.stringify(env)}`)
      }
      // Ohne Research-Host wird nichts umgeschrieben: die Haupt-Seite bleibt, wie sie ist.
      for (const pathname of ['/', '/pricing', '/api/v1/notes', '/mcp']) {
        assert.deepEqual(route(host, pathname, env), NEXT, `${host}${pathname} ${JSON.stringify(env)}`)
      }
    }
  }
})

test('redirects never leave the request host or the configured research host', () => {
  const nastyPaths = [
    '/research//evil.com',
    '/research///evil.com',
    '/research/\\evil.com',
    '/research/\\\\evil.com',
    '/research/%2F%2Fevil.com',
    '/research/%5C%5Cevil.com',
    '/research/\t/evil.com',
    '/research/\n//evil.com',
    '/research/\r\n/\\evil.com',
    '/research/@evil.com',
    '/research/..//evil.com',
    '/research//',
    '/research/https://evil.com',
    '/research/https:/evil.com',
    '/%72esearch//evil.com',
    '//research//evil.com',
    '/research\\/evil.com',
  ]
  // Kodierte Varianten dürfen nie zu einem Redirect führen, der den Host verlässt.
  const encodedPaths = [...ENCODED_RESEARCH_PAGE_PATHS, '/research%2F%5Cevil.com', '/research%2F%2F%2Fevil.com%3F', '/research%2F%40evil.com', '/%72esearch/%2F%2Fevil.com']
  const searches = ['', '?next=//evil.com', '\n//evil.com', '?a=1#//evil.com']
  const scenarios = [
    [RESEARCH_HOST, ENVS.production],
    [MAIN_HOST, ENVS.production],
    [MAIN_HOST, ENVS.selfHosted],
    ['research.localhost:3000', ENVS.development],
    [MAIN_HOST, ENVS.preview],
  ]
  let redirects = 0
  for (const [host, env] of scenarios) {
    for (const pathname of [...nastyPaths, ...encodedPaths]) {
      for (const search of searches) {
        const result = route(host, pathname, env, search)
        if (result.type !== 'redirect') continue
        redirects += 1
        const label = `${host} ${JSON.stringify(pathname)} ${JSON.stringify(search)} → ${result.location}`
        assert.equal(result.status, 308, label)
        const relative = result.location.startsWith('/') && !/^\/[/\\]/.test(result.location)
        assert.ok(relative || result.location.startsWith(`${RESEARCH_ORIGIN}/`), label)
        assert.ok(!/[\u0000-\u001F\u007F]/.test(result.location), label)
        const resolved = new URL(result.location, `https://${host}/research/pricing`)
        assert.ok([new URL(`https://${host}`).host, RESEARCH_HOST].includes(resolved.host), label)
      }
    }
  }
  assert.ok(redirects >= nastyPaths.length * searches.length * 3, `expected the redirect branches to be exercised (${redirects})`)
})

test('research host rewrites always stay inside the research route trees', () => {
  const paths = [
    '/',
    '/x',
    '/../api/webhooks/stripe',
    '/%2e%2e/api/webhooks/stripe',
    '//api/webhooks/stripe',
    '/\\mentorship',
    '/owner',
    '/sign-in',
    '/.env',
    '/api/v1/../../owner',
    ...ENCODED_RESEARCH_PATHS,
    '/api%2Fwebhooks%2Fstripe',
    '/%2E%2E%2Fapi%2Fwebhooks%2Fstripe',
    '/_next%2F..%2Fmentorship',
    '/_nextfoo',
    '/_vercel%2F..%2Fowner',
    '/mentorship%2Flesson',
  ]
  for (const pathname of paths) {
    const result = route(RESEARCH_HOST, pathname, ENVS.production)
    if (result.type === 'next') {
      // Nur echte API- und Framework-Pfade (ganzes erstes Segment) laufen unverändert.
      assert.match(pathname, /^[/\\]*(api|%61pi|_next|_vercel|__nextjs[\w-]*)(?:[/\\]|$)/, pathname)
      continue
    }
    assert.equal(result.type, 'rewrite', pathname)
    assert.match(result.pathname, /^\/(research|api\/research)(\/|$)/, pathname)
  }
})

test('request context: base path, origin and protocol come from the Host header', () => {
  const cases = [
    [{ host: RESEARCH_HOST, forwardedProto: 'https', env: ENVS.production }, { basePath: '', origin: RESEARCH_ORIGIN, isResearchHost: true }],
    [{ host: RESEARCH_HOST, forwardedProto: null, env: ENVS.production }, { basePath: '', origin: RESEARCH_ORIGIN, isResearchHost: true }],
    [{ host: 'RESEARCH.price-action-trader.de:443', env: ENVS.production }, { basePath: '', origin: `${RESEARCH_ORIGIN}:443`, isResearchHost: true }],
    [{ host: MAIN_HOST, forwardedProto: 'https', env: ENVS.production }, { basePath: '/research', origin: `https://${MAIN_HOST}`, isResearchHost: false }],
    [{ host: 'localhost:3000', env: ENVS.development }, { basePath: '/research', origin: 'http://localhost:3000', isResearchHost: false }],
    [{ host: 'research.localhost:3000', env: ENVS.development }, { basePath: '', origin: 'http://research.localhost:3000', isResearchHost: true }],
    [{ host: '127.0.0.1:3000', env: ENVS.development }, { basePath: '/research', origin: 'http://127.0.0.1:3000', isResearchHost: false }],
    [{ host: '[::1]:3000', env: ENVS.development }, { basePath: '/research', origin: 'http://[::1]:3000', isResearchHost: false }],
    [{ host: 'pat-git-feat.vercel.app', forwardedProto: 'https', env: ENVS.preview }, { basePath: '/research', origin: 'https://pat-git-feat.vercel.app', isResearchHost: false }],
    [{ host: 'localhost:3000', forwardedProto: 'https', env: ENVS.development }, { basePath: '/research', origin: 'https://localhost:3000', isResearchHost: false }],
    [{ host: 'localhost:3000', forwardedProto: 'HTTP', env: ENVS.development }, { basePath: '/research', origin: 'http://localhost:3000', isResearchHost: false }],
    [{ host: 'example.com', forwardedProto: 'https, http', env: ENVS.development }, { basePath: '/research', origin: 'https://example.com', isResearchHost: false }],
    [{ host: 'example.com', forwardedProto: 'ftp', env: ENVS.development }, { basePath: '/research', origin: 'https://example.com', isResearchHost: false }],
    [{ host: RESEARCH_HOST, forwardedProto: 'https', env: ENVS.productionKilled }, { basePath: '/research', origin: RESEARCH_ORIGIN, isResearchHost: false }],
    // Ohne brauchbaren Host: Pfad-Modus mit NEXT_PUBLIC_APP_URL bzw. der Haupt-Domain.
    [{ host: null, env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000/some/path' } }, { basePath: '/research', origin: 'http://localhost:3000', isResearchHost: false }],
    [{ host: 'evil.com/x', env: {} }, { basePath: '/research', origin: `https://${MAIN_HOST}`, isResearchHost: false }],
    [{ host: '', env: { NEXT_PUBLIC_APP_URL: 'not a url' } }, { basePath: '/research', origin: `https://${MAIN_HOST}`, isResearchHost: false }],
    [{ host: undefined, env: { NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' } }, { basePath: '/research', origin: `https://${MAIN_HOST}`, isResearchHost: false }],
  ]
  for (const [input, expected] of cases) {
    assert.deepEqual(resolveResearchRequestContext(input), expected, JSON.stringify(input))
  }
})

test('browser-side detection follows the research.* / research-staging.* naming convention', () => {
  for (const hostname of [RESEARCH_HOST, 'RESEARCH.price-action-trader.de:443', 'research-staging.price-action-trader.de', 'research.localhost', 'research.localhost:3000']) {
    assert.equal(isResearchBrowserHostname(hostname), true, hostname)
  }
  for (const hostname of [MAIN_HOST, 'price-action-trader.de', 'researchprice-action-trader.de', 'my-research.vercel.app', 'pat-git-feat-pat-research-platform.vercel.app', 'localhost', 'research', 'research.', '', null, undefined]) {
    assert.equal(isResearchBrowserHostname(hostname), false, String(hostname))
  }
  for (const pathname of ['/research', '/research/', '/research/pricing', '/%72esearch', ...ENCODED_RESEARCH_PAGE_PATHS]) {
    assert.equal(isResearchPathname(pathname), true, pathname)
  }
  for (const pathname of ['/', '/researcher', '/research-notes', '/blog/research', '/blog%2Fresearch', '/researcher%2Fx', '/api/research', '', null, undefined]) {
    assert.equal(isResearchPathname(pathname), false, String(pathname))
  }
})

async function withEnv(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  const apply = (entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  apply(values)
  try {
    return await fn()
  } finally {
    apply(previous)
  }
}

class NotFoundSignal extends Error {}

function loadRequestContext(headerValues = {}) {
  return loadTs('./request-context.ts', {
    'server-only': {},
    react: { cache: (fn) => fn },
    'next/headers': { headers: async () => new Headers(headerValues) },
    'next/navigation': {
      notFound: () => {
        throw new NotFoundSignal('NEXT_NOT_FOUND')
      },
    },
    '@/lib/research/routing.mjs': routing,
  })
}

const PRODUCTION_PROCESS_ENV = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  RESEARCH_PUBLIC_HOST: RESEARCH_HOST,
  RESEARCH_EXTRA_HOSTS: undefined,
  RESEARCH_ALLOW_PATH_MODE: undefined,
}

test('getResearchRequestContext reads host and x-forwarded-proto from next/headers', async () => {
  await withEnv(PRODUCTION_PROCESS_ENV, async () => {
    const onResearchHost = loadRequestContext({ host: RESEARCH_HOST, 'x-forwarded-proto': 'https' })
    assert.deepEqual(await onResearchHost.getResearchRequestContext(), { basePath: '', origin: RESEARCH_ORIGIN, isResearchHost: true })
  })
  await withEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview', RESEARCH_PUBLIC_HOST: undefined, RESEARCH_EXTRA_HOSTS: undefined }, async () => {
    const onPreview = loadRequestContext({ host: 'pat-git-feat.vercel.app', 'x-forwarded-proto': 'https' })
    assert.deepEqual(await onPreview.getResearchRequestContext(), { basePath: '/research', origin: 'https://pat-git-feat.vercel.app', isResearchHost: false })
  })
  await withEnv({ NODE_ENV: 'development', VERCEL_ENV: undefined, RESEARCH_PUBLIC_HOST: undefined, RESEARCH_EXTRA_HOSTS: undefined }, async () => {
    const local = loadRequestContext({ host: 'localhost:3000' })
    assert.deepEqual(await local.getResearchRequestContext(), { basePath: '/research', origin: 'http://localhost:3000', isResearchHost: false })
  })
})

// Der Middleware-Matcher überspringt Pfade mit Datei-Endung (/research/x.css,
// /research/sign-in/a.png); dann muss der Server selbst 404 liefern.
test('getResearchRequestContext calls notFound() where research must not be served', async () => {
  await withEnv(PRODUCTION_PROCESS_ENV, async () => {
    for (const host of [MAIN_HOST, 'price-action-trader.de', 'research.localhost:3000', undefined]) {
      const headerValues = host === undefined ? {} : { host }
      await assert.rejects(loadRequestContext(headerValues).getResearchRequestContext(), NotFoundSignal, String(host))
    }
  })
  await withEnv({ ...PRODUCTION_PROCESS_ENV, RESEARCH_PUBLIC_HOST: undefined, RESEARCH_EXTRA_HOSTS: RESEARCH_HOST }, async () => {
    for (const host of [MAIN_HOST, RESEARCH_HOST, 'research.localhost:3000']) {
      await assert.rejects(loadRequestContext({ host }).getResearchRequestContext(), NotFoundSignal, `killed ${host}`)
    }
  })
  await withEnv({ NODE_ENV: 'production', VERCEL_ENV: undefined, RESEARCH_PUBLIC_HOST: RESEARCH_HOST, RESEARCH_EXTRA_HOSTS: undefined, RESEARCH_ALLOW_PATH_MODE: undefined }, async () => {
    await assert.rejects(loadRequestContext({ host: 'localhost:3000' }).getResearchRequestContext(), NotFoundSignal, 'self-hosted main host')
    assert.equal((await loadRequestContext({ host: RESEARCH_HOST }).getResearchRequestContext()).isResearchHost, true)
  })
})

test('isResearchServedForRequest guards route handlers by the Host header', async () => {
  const post = (url, host) => new Request(url, { method: 'POST', headers: host ? { host } : {} })
  await withEnv(PRODUCTION_PROCESS_ENV, async () => {
    const { isResearchServedForRequest } = loadRequestContext()
    assert.equal(isResearchServedForRequest(post('http://internal.invalid/api/research/checkout', RESEARCH_HOST)), true)
    // request.url zählt nicht, nur der Host-Header.
    assert.equal(isResearchServedForRequest(post(`${RESEARCH_ORIGIN}/api/research/checkout`, MAIN_HOST)), false)
    assert.equal(isResearchServedForRequest(post(`${RESEARCH_ORIGIN}/api/research/checkout`)), false)
  })
  await withEnv({ ...PRODUCTION_PROCESS_ENV, RESEARCH_PUBLIC_HOST: undefined }, async () => {
    const { isResearchServedForRequest } = loadRequestContext()
    assert.equal(isResearchServedForRequest(post('http://internal.invalid/api/research/checkout', RESEARCH_HOST)), false)
    assert.equal(isResearchServedForRequest(post('http://internal.invalid/api/research/checkout', MAIN_HOST)), false)
  })
  await withEnv({ NODE_ENV: 'development', VERCEL_ENV: undefined, RESEARCH_PUBLIC_HOST: undefined, RESEARCH_EXTRA_HOSTS: undefined }, async () => {
    const { isResearchServedForRequest } = loadRequestContext()
    assert.equal(isResearchServedForRequest(post('http://localhost:3000/api/research/checkout', 'localhost:3000')), true)
  })
})

test('researchAbsoluteUrl builds base-prefixed absolute URLs and refuses foreign targets', () => {
  const { researchAbsoluteUrl } = loadRequestContext()
  const checkoutReturn = '/welcome?session_id={CHECKOUT_SESSION_ID}'
  assert.equal(researchAbsoluteUrl({ basePath: '', origin: RESEARCH_ORIGIN }, checkoutReturn), `${RESEARCH_ORIGIN}/welcome?session_id={CHECKOUT_SESSION_ID}`)
  assert.equal(researchAbsoluteUrl({ basePath: '/research', origin: 'http://localhost:3000' }, checkoutReturn), 'http://localhost:3000/research/welcome?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(researchAbsoluteUrl({ basePath: '/research', origin: 'http://localhost:3000' }, '/'), 'http://localhost:3000/research')
  assert.throws(() => researchAbsoluteUrl({ basePath: '', origin: RESEARCH_ORIGIN }, '//evil.com'), TypeError)
  assert.throws(() => researchAbsoluteUrl({ basePath: '', origin: RESEARCH_ORIGIN }, 'https://evil.com'), TypeError)
})

test('route-handler helpers use the Host header, not request.url', async () => {
  await withEnv(PRODUCTION_PROCESS_ENV, async () => {
    const { researchBasePathFromRequest, researchOriginFromRequest, researchRequestContextFromRequest } = loadRequestContext()
    // Nach dem Middleware-Rewrite zeigt request.url auf den internen Pfad/Host.
    const researchRequest = new Request('http://internal.invalid/api/research/checkout', {
      method: 'POST',
      headers: { host: RESEARCH_HOST, 'x-forwarded-proto': 'https' },
    })
    assert.equal(researchBasePathFromRequest(researchRequest), '')
    assert.equal(researchOriginFromRequest(researchRequest), RESEARCH_ORIGIN)
    assert.equal(researchRequestContextFromRequest(researchRequest).isResearchHost, true)

    const mainRequest = new Request(`${RESEARCH_ORIGIN}/api/research/checkout`, { method: 'POST', headers: { host: MAIN_HOST } })
    assert.equal(researchBasePathFromRequest(mainRequest), '/research')
    assert.equal(researchOriginFromRequest(mainRequest), `https://${MAIN_HOST}`)
  })
  await withEnv({ NODE_ENV: 'development', VERCEL_ENV: undefined, RESEARCH_PUBLIC_HOST: undefined, RESEARCH_EXTRA_HOSTS: undefined }, async () => {
    const { researchBasePathFromRequest, researchOriginFromRequest } = loadRequestContext()
    const localRequest = new Request('http://localhost:3000/api/research/portal', { method: 'POST', headers: { host: 'research.localhost:3000' } })
    assert.equal(researchBasePathFromRequest(localRequest), '')
    assert.equal(researchOriginFromRequest(localRequest), 'http://research.localhost:3000')
  })
})

// Minimaler React-Ersatz: Kontextwert, Pfad und Hydrations-Phase sind steuerbar.
function loadBasePath() {
  const state = { contextValue: undefined, pathname: '/', hydrating: false }
  const fakeReact = {
    createContext: (defaultValue) => ({ defaultValue, Provider: 'ResearchBasePathContext.Provider' }),
    useContext: (context) => (state.contextValue === undefined ? context.defaultValue : state.contextValue),
    useCallback: (fn) => fn,
    useSyncExternalStore: (subscribe, getSnapshot, getServerSnapshot) => {
      assert.equal(typeof subscribe(() => {}), 'function')
      return state.hydrating ? getServerSnapshot() : getSnapshot()
    },
  }
  const basePathModule = loadTs('../../components/research/base-path.tsx', {
    react: fakeReact,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/navigation': { usePathname: () => state.pathname },
    '@/lib/research/routing.mjs': routing,
  })
  return { hooks: basePathModule, state }
}

async function withBrowserHostname(hostname, fn) {
  const hadWindow = 'window' in globalThis
  const previous = globalThis.window
  globalThis.window = { location: { hostname } }
  try {
    return await fn()
  } finally {
    if (hadWindow) globalThis.window = previous
    else delete globalThis.window
  }
}

test('base-path hooks resolve hrefs and logical paths from the provider value', () => {
  const { hooks, state } = loadBasePath()
  const element = hooks.ResearchBasePathProvider({ basePath: '/research', children: 'content' })
  assert.deepEqual(element.props, { value: '/research', children: 'content' })

  assert.throws(() => hooks.useResearchBasePath(), /ResearchBasePathProvider/)

  state.contextValue = '/research'
  state.pathname = '/research/pricing'
  assert.equal(hooks.useResearchBasePath(), '/research')
  assert.equal(hooks.useResearchHref()('/account'), '/research/account')
  assert.equal(hooks.useResearchHref()('/'), '/research')
  assert.equal(hooks.useResearchLogicalPath(), '/pricing')
  assert.throws(() => hooks.useResearchHref()('//evil.com'), TypeError)

  state.contextValue = ''
  state.pathname = '/pricing'
  assert.equal(hooks.useResearchHref()('/account'), '/account')
  assert.equal(hooks.useResearchLogicalPath(), '/pricing')
  state.pathname = '/research/account'
  assert.equal(hooks.useResearchLogicalPath(), '/account')
})

test('root chrome treats research as unknown until the browser host is known', async () => {
  const { hooks, state } = loadBasePath()
  const cases = [
    // [hostname, pathname, hydrating, expected]
    [MAIN_HOST, '/', true, null],
    [MAIN_HOST, '/', false, false],
    [MAIN_HOST, '/mentorship', false, false],
    [MAIN_HOST, '/researcher', false, false],
    [MAIN_HOST, '/research/pricing', true, true],
    ['localhost', '/research', false, true],
    [RESEARCH_HOST, '/pricing', true, null],
    [RESEARCH_HOST, '/pricing', false, true],
    [RESEARCH_HOST, '/research/pricing', true, true],
    ['research-staging.price-action-trader.de', '/', false, true],
  ]
  for (const [hostname, pathname, hydrating, expected] of cases) {
    state.pathname = pathname
    state.hydrating = hydrating
    await withBrowserHostname(hostname, () => {
      assert.equal(hooks.useIsResearchSurface(), expected, `${hostname}${pathname} hydrating=${hydrating}`)
    })
  }
})
