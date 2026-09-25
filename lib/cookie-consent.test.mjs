import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

// Einwilligungslogik (TDDDG § 25): reine Funktionen, Google-Tag-Reihenfolge, Widerruf und Banner-Markup.
// Läuft komplett lokal mit Test-Doubles für window, document und localStorage. Keine Anfragen an Google oder Microsoft.

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source, {
  compilerOptions: { module, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText

const pureSource = await read('./cookie-consent.ts')
const consent = await import(`data:text/javascript;base64,${Buffer.from(compile(pureSource, ts.ModuleKind.ESNext)).toString('base64')}`)
const {
  ACCEPT_ALL_CONSENT, REJECT_ALL_CONSENT, COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_VERSION,
  parseStoredConsent, serializeConsent, revokedCategories, deniedCategories, googleConsentState, clarityConsentState,
  googleTagDestinations, googleTagScriptId, trackingCookieNames, cookieDeletionStrings, categoriesToStop,
} = consent

const sources = {
  pure: compile(pureSource),
  publicEnv: compile(await read('./public-env.ts')),
  client: compile(await read('./cookie-consent-client.ts')),
  googleTag: compile(await read('../components/analytics/google-tag.ts')),
  gtm: compile(await read('../components/analytics/google-tag-manager.tsx')),
  clarity: compile(await read('../components/analytics/microsoft-clarity.tsx')),
  banner: compile(await read('../components/ui/cookie-banner.tsx')),
}

const plain = value => JSON.parse(JSON.stringify(value))
const ids = { analyticsId: 'G-TEST', adsId: 'AW-TEST' }

function load(source, deps, globals = {}) {
  const exports = {}
  runInNewContext(source, { ...globals, exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`)
    return deps[name]
  } })
  return exports
}

function createBrowser({ stored = null, cookies = [], env = {}, failWrites = false } = {}) {
  const storage = new Map(stored ? [[COOKIE_CONSENT_STORAGE_KEY, stored]] : [])
  const listeners = new Map()
  const cookieWrites = []
  const calls = { reload: 0, clarity: [] }
  const window = {
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => {
        if (failWrites) throw new Error('QuotaExceededError')
        storage.set(key, String(value))
      },
      removeItem: key => storage.delete(key),
    },
    location: { hostname: 'www.price-action-trader.de', reload: () => { calls.reload += 1 } },
    addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: (type, listener) => listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== listener)),
    dispatchEvent: event => { for (const listener of listeners.get(event.type) ?? []) listener(event); return true },
  }
  const document = {
    get cookie() { return cookies.join('; ') },
    set cookie(value) { cookieWrites.push(value) },
  }
  class CustomEvent { constructor(type) { this.type = type } }
  const globals = { window, document, CustomEvent, process: { env: { NEXT_PUBLIC_GA_ID: 'G-TEST', NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-TEST', ...env } } }

  const pure = load(sources.pure, {})
  const publicEnv = load(sources.publicEnv, {})
  const client = load(sources.client, {
    react: { useSyncExternalStore: () => undefined },
    '@/lib/public-env': publicEnv,
    '@/lib/cookie-consent': pure,
  }, globals)
  const googleTag = load(sources.googleTag, { '@/lib/cookie-consent': pure, '@/lib/cookie-consent-client': client }, globals)
  // window.dataLayer stammt aus dem vm-Kontext: für deepStrictEqual in Objekte dieses Kontexts umwandeln.
  const dataLayer = () => plain(Array.from(window.dataLayer ?? [], entry => Array.from(entry)))
  const storeDecision = decision => storage.set(COOKIE_CONSENT_STORAGE_KEY, serializeConsent(decision, new Date('2026-09-25T10:00:00Z')))
  const fire = (type, event) => { for (const listener of listeners.get(type) ?? []) listener(event) }
  return { window, client, googleTag, dataLayer, storeDecision, cookieWrites, calls, listeners, storage, fire }
}

test('stored decisions are only valid in the current version and normalize to strict booleans', () => {
  assert.equal(parseStoredConsent(null), null)
  assert.equal(parseStoredConsent('kaputt'), null)
  // Alte Entscheidungen aus dem Banner ohne "Alle ablehnen" (ohne Version) zählen nicht mehr.
  assert.equal(parseStoredConsent(JSON.stringify({ necessary: true, analytics: true, marketing: true })), null)
  assert.equal(parseStoredConsent(JSON.stringify({ version: COOKIE_CONSENT_VERSION - 1, analytics: true })), null)
  assert.deepEqual(parseStoredConsent(JSON.stringify({ version: COOKIE_CONSENT_VERSION, analytics: 'yes', marketing: 1 })), REJECT_ALL_CONSENT)

  const serialized = JSON.parse(serializeConsent({ necessary: true, analytics: true, marketing: false }, new Date('2026-09-25T10:00:00Z')))
  assert.deepEqual(serialized, { necessary: true, analytics: true, marketing: false, version: COOKIE_CONSENT_VERSION, updatedAt: '2026-09-25T10:00:00.000Z' })
  assert.deepEqual(parseStoredConsent(JSON.stringify(serialized)), { necessary: true, analytics: true, marketing: false })
})

test('a revocation is a category that was granted before and is not granted now', () => {
  assert.deepEqual(revokedCategories(ACCEPT_ALL_CONSENT, REJECT_ALL_CONSENT), ['analytics', 'marketing'])
  assert.deepEqual(revokedCategories(ACCEPT_ALL_CONSENT, { necessary: true, analytics: true, marketing: false }), ['marketing'])
  assert.deepEqual(revokedCategories(null, REJECT_ALL_CONSENT), [])
  assert.deepEqual(revokedCategories(REJECT_ALL_CONSENT, ACCEPT_ALL_CONSENT), [])
  assert.deepEqual(deniedCategories(null), ['analytics', 'marketing'])
  assert.deepEqual(deniedCategories({ necessary: true, analytics: true, marketing: false }), ['marketing'])
})

test('everything running without consent is stopped, not only a visible change from granted to denied', () => {
  assert.deepEqual(categoriesToStop(ACCEPT_ALL_CONSENT, REJECT_ALL_CONSENT, []), ['analytics', 'marketing'])
  // Anderer Tab hat schon abgelehnt: Vorher und nachher sind gleich, die Dienste hier laufen aber noch.
  assert.deepEqual(categoriesToStop(REJECT_ALL_CONSENT, REJECT_ALL_CONSENT, ['analytics']), ['analytics'])
  assert.deepEqual(categoriesToStop(null, null, ['analytics', 'marketing']), ['analytics', 'marketing'])
  assert.deepEqual(categoriesToStop(REJECT_ALL_CONSENT, ACCEPT_ALL_CONSENT, ['analytics']), [])
  assert.deepEqual(categoriesToStop(ACCEPT_ALL_CONSENT, { necessary: true, analytics: true, marketing: false }, ['analytics']), ['marketing'])
})

test('consent maps to Google Consent Mode v2 and Clarity without ever granting Microsoft ad storage', () => {
  assert.deepEqual(googleConsentState(null), { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })
  assert.deepEqual(googleConsentState({ necessary: true, analytics: true, marketing: false }), { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' })
  assert.deepEqual(googleConsentState(ACCEPT_ALL_CONSENT), { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' })
  assert.deepEqual(clarityConsentState(ACCEPT_ALL_CONSENT), { ad_Storage: 'denied', analytics_Storage: 'granted' })
  assert.deepEqual(clarityConsentState(REJECT_ALL_CONSENT), { ad_Storage: 'denied', analytics_Storage: 'denied' })
})

test('only destinations with consent are configured, and gtag.js is not loaded without any', () => {
  assert.deepEqual(googleTagDestinations(null, ids), [])
  assert.deepEqual(googleTagDestinations(REJECT_ALL_CONSENT, ids), [])
  assert.deepEqual(googleTagDestinations({ necessary: true, analytics: true, marketing: false }, ids), ['G-TEST'])
  assert.deepEqual(googleTagDestinations({ necessary: true, analytics: false, marketing: true }, ids), ['AW-TEST'])
  assert.deepEqual(googleTagDestinations(ACCEPT_ALL_CONSENT, { adsId: 'AW-TEST' }), ['AW-TEST'])
  assert.equal(googleTagScriptId(REJECT_ALL_CONSENT, ids), null)
  assert.equal(googleTagScriptId({ necessary: true, analytics: false, marketing: true }, ids), 'AW-TEST')
  assert.equal(googleTagScriptId(ACCEPT_ALL_CONSENT, ids), 'G-TEST')
})

test('tracking cookies are matched per category and deleted on host and parent domains', () => {
  const header = 'theme=dark; _ga=GA1.1.1; _ga_ABC123=GS1; _gid=1; _gcl_au=1.1; _clck=x; _clsk=y; __client_uat=0; _galaxy=keep'
  assert.deepEqual(trackingCookieNames(header, ['analytics']), ['_ga', '_ga_ABC123', '_gid', '_clck', '_clsk'])
  assert.deepEqual(trackingCookieNames(header, ['marketing']), ['_gcl_au'])
  assert.deepEqual(trackingCookieNames(header, []), [])

  const deletions = cookieDeletionStrings('_ga', 'www.price-action-trader.de')
  assert.equal(deletions.length, 3)
  assert.ok(deletions.every(value => value.startsWith('_ga=; Max-Age=0;') && value.includes('Path=/')))
  assert.ok(deletions.some(value => value.endsWith('Domain=price-action-trader.de')))
  assert.ok(deletions.some(value => value.endsWith('Domain=www.price-action-trader.de')))
  assert.equal(cookieDeletionStrings('_ga', 'localhost').length, 1)
  assert.equal(cookieDeletionStrings('_ga', '127.0.0.1').length, 1)
})

test('before any decision tracking calls are a no-op: no gtag, no dataLayer, nothing queued', () => {
  const browser = createBrowser()
  assert.equal(browser.googleTag.sendGoogleEvent('cta_click', { cta_source: 'hero' }), false)
  assert.equal(browser.googleTag.sendGoogleAdsConversion('label', { value: 150 }), false)
  assert.deepEqual(plain(browser.googleTag.prepareGoogleTag(null)), [])
  assert.equal(browser.window.gtag, undefined)
  assert.equal(browser.window.dataLayer, undefined)
})

test('rejecting everything keeps Google completely unloaded', () => {
  const browser = createBrowser()
  browser.storeDecision(REJECT_ALL_CONSENT)
  assert.equal(browser.googleTag.sendGoogleEvent('begin_checkout'), false)
  assert.equal(browser.window.gtag, undefined)
})

test('analytics consent sets defaults first, then the update, then configures GA4 only', () => {
  const browser = createBrowser()
  browser.storeDecision({ necessary: true, analytics: true, marketing: false })
  assert.equal(browser.googleTag.sendGoogleEvent('cta_click', { cta_source: 'hero' }), true)
  assert.equal(browser.googleTag.sendGoogleAdsConversion('label', { value: 150 }), false)

  const commands = browser.dataLayer()
  assert.deepEqual(commands[0], ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
  assert.equal(commands[1][0], 'js')
  assert.deepEqual(commands.slice(2), [
    ['set', 'ads_data_redaction', true],
    ['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }],
    ['config', 'G-TEST'],
    ['event', 'cta_click', { cta_source: 'hero', send_to: ['G-TEST'] }],
  ])
})

test('marketing consent enables the Google Ads conversion and configures each destination once', () => {
  const browser = createBrowser()
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  assert.equal(browser.googleTag.sendGoogleAdsConversion('purchase-label', { value: 150, currency: 'EUR' }), true)

  const commands = browser.dataLayer()
  assert.equal(commands.filter(command => command[0] === 'consent' && command[1] === 'default').length, 1)
  assert.deepEqual(commands.filter(command => command[0] === 'config'), [['config', 'G-TEST'], ['config', 'AW-TEST']])
  assert.deepEqual(commands.at(-1), ['event', 'conversion', { value: 150, currency: 'EUR', send_to: 'AW-TEST/purchase-label' }])
})

test('revoking loaded tracking denies consent, disables the tags, deletes cookies and asks for a reload', () => {
  const browser = createBrowser({ cookies: ['_ga=GA1.1.1', '_gcl_au=1.1', '__client_uat=0'] })
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  browser.window.clarity = (...args) => browser.calls.clarity.push(plain(args))

  let changeEvents = 0
  browser.window.addEventListener('cookieConsentChanged', () => { changeEvents += 1 })
  const { needsReload } = browser.client.saveCookieConsent(REJECT_ALL_CONSENT)

  assert.equal(needsReload, true)
  assert.equal(changeEvents, 1)
  assert.deepEqual(browser.dataLayer().at(-1), ['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
  assert.equal(browser.window['ga-disable-G-TEST'], true)
  assert.equal(browser.window['ga-disable-AW-TEST'], true)
  assert.deepEqual(browser.calls.clarity, [['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }], ['consent', false]])
  assert.ok(browser.cookieWrites.some(value => value.startsWith('_ga=;')))
  assert.ok(browser.cookieWrites.some(value => value.startsWith('_gcl_au=;')))
  assert.ok(!browser.cookieWrites.some(value => value.startsWith('__client_uat')))

  // Nach dem Widerruf sendet auch der Helfer nichts mehr.
  const before = browser.dataLayer().length
  assert.equal(browser.googleTag.sendGoogleEvent('cta_click'), false)
  assert.equal(browser.dataLayer().length, before)
})

test('granting consent or revoking something that never loaded does not reload the page', () => {
  const browser = createBrowser()
  assert.deepEqual(plain(browser.client.saveCookieConsent(ACCEPT_ALL_CONSENT)), { needsReload: false })
  assert.deepEqual(plain(browser.client.readCookieConsent()), ACCEPT_ALL_CONSENT)
  assert.deepEqual(plain(browser.client.saveCookieConsent(REJECT_ALL_CONSENT)), { needsReload: false })
})

test('a decision in another tab reaches subscribers and stops loaded tags there without a reload', () => {
  const browser = createBrowser()
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  const seen = []
  browser.client.subscribeToCookieConsent((next, previous) => seen.push(plain([next, previous])))
  assert.deepEqual(plain(browser.client.readCookieConsent()), ACCEPT_ALL_CONSENT)

  browser.storeDecision({ necessary: true, analytics: true, marketing: false })
  // Ein Render liest den neuen Stand schon, bevor das storage-Event ankommt.
  assert.deepEqual(plain(browser.client.readCookieConsent()), { necessary: true, analytics: true, marketing: false })
  for (const listener of browser.listeners.get('storage')) listener({ key: COOKIE_CONSENT_STORAGE_KEY })

  assert.deepEqual(seen, [[{ necessary: true, analytics: true, marketing: false }, ACCEPT_ALL_CONSENT]])
  assert.equal(browser.window['ga-disable-AW-TEST'], true)
  assert.notEqual(browser.window['ga-disable-G-TEST'], true)
  assert.equal(browser.calls.reload, 0)
})

function renderWithConsent(source, exportName, state, extraDeps = {}, env = {}) {
  const exports = load(source, {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/dynamic': { default: () => () => null },
    'next/link': { default: ({ href, className, children }) => React.createElement('a', { href, className }, children) },
    'next/script': { default: ({ id, src, dangerouslySetInnerHTML }) => React.createElement('script', { id, src, dangerouslySetInnerHTML }) },
    '@/components/ui/button': { Button: ({ className, children, variant, type }) => React.createElement('button', { type, className, 'data-variant': variant ?? 'default' }, children) },
    '@/lib/cookie-consent': load(sources.pure, {}),
    '@/lib/public-env': load(sources.publicEnv, {}),
    '@/lib/cookie-consent-client': {
      useCookieConsent: () => state,
      getGoogleTagIds: () => ids,
      saveCookieConsent: () => ({ needsReload: false }),
      clearCookiesWithoutConsent: () => {},
      markTrackingActive: () => {},
    },
    '@/components/analytics/google-tag': { prepareGoogleTag: () => [] },
    ...extraDeps,
  }, { process: { env } })
  return renderToStaticMarkup(React.createElement(exports[exportName]))
}

test('the first banner layer offers "Alle ablehnen" with exactly the same look as "Alle akzeptieren"', () => {
  const html = renderWithConsent(sources.banner, 'CookieBanner', null)
  const buttons = [...html.matchAll(/<button type="button" class="([^"]*)" data-variant="([^"]*)">([^<]*)<\/button>/g)]
    .map(([, className, variant, label]) => ({ className, variant, label }))
  const reject = buttons.find(button => button.label === 'Alle ablehnen')
  const accept = buttons.find(button => button.label === 'Alle akzeptieren')
  assert.ok(reject && accept, 'Beide Entscheidungen müssen auf der ersten Ebene stehen')
  assert.equal(reject.className, accept.className)
  assert.equal(reject.variant, accept.variant)
  assert.ok(buttons.some(button => button.label === 'Einstellungen'))
  assert.match(html, /Google Analytics/)
  assert.match(html, /Microsoft Clarity/)
  assert.match(html, /Google Ads/)
  assert.match(html, /href="\/datenschutz"/)
})

test('the banner stays hidden until storage was read and after a decision', () => {
  assert.equal(renderWithConsent(sources.banner, 'CookieBanner', undefined), '')
  assert.equal(renderWithConsent(sources.banner, 'CookieBanner', REJECT_ALL_CONSENT), '')
  assert.equal(renderWithConsent(sources.banner, 'CookieBanner', ACCEPT_ALL_CONSENT), '')
})

test('gtag.js is only rendered after consent and with the consented destination', () => {
  assert.equal(renderWithConsent(sources.gtm, 'GoogleTagManager', null), '')
  assert.equal(renderWithConsent(sources.gtm, 'GoogleTagManager', REJECT_ALL_CONSENT), '')
  assert.match(renderWithConsent(sources.gtm, 'GoogleTagManager', { necessary: true, analytics: false, marketing: true }), /gtag\/js\?id=AW-TEST/)
  assert.match(renderWithConsent(sources.gtm, 'GoogleTagManager', ACCEPT_ALL_CONSENT), /gtag\/js\?id=G-TEST/)
})

test('Clarity is only rendered with analytics consent and passes consentv2 before the tag loads', () => {
  const env = { NEXT_PUBLIC_CLARITY_ID: 'clarity-test' }
  assert.equal(renderWithConsent(sources.clarity, 'MicrosoftClarity', null, {}, env), '')
  assert.equal(renderWithConsent(sources.clarity, 'MicrosoftClarity', { necessary: true, analytics: false, marketing: true }, {}, env), '')
  const html = renderWithConsent(sources.clarity, 'MicrosoftClarity', { necessary: true, analytics: true, marketing: false }, {}, env)
  assert.match(html, /"clarity-test"/)
  assert.match(html, /window\.clarity\("consentv2", \{"ad_Storage":"denied","analytics_Storage":"granted"\}\)/)
})

test('visible consent texts contain no en or em dashes', async () => {
  for (const path of ['../components/ui/cookie-banner.tsx', '../components/ui/cookie-settings-dialog.tsx', '../components/layout/footer-cookie-settings-button.tsx', '../components/blog/mdx-components.tsx']) {
    assert.doesNotMatch(await read(path), /[\u2013\u2014]/, path)
  }
})

test('a revocation after another tab already stopped the tags still reloads this page', () => {
  const browser = createBrowser()
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  browser.client.subscribeToCookieConsent(() => {})
  browser.client.readCookieConsent()

  browser.storeDecision(REJECT_ALL_CONSENT)
  browser.fire('storage', { key: COOKIE_CONSENT_STORAGE_KEY })
  assert.equal(browser.window['ga-disable-G-TEST'], true)
  assert.equal(browser.calls.reload, 0)

  // gtag.js läuft hier noch im Speicher. Speichert die Person jetzt selbst "Alle ablehnen", wird neu geladen.
  assert.deepEqual(plain(browser.client.saveCookieConsent(REJECT_ALL_CONSENT)), { needsReload: true })
})

test('returning from the back-forward cache re-checks the decision and stops tags that lost consent', () => {
  const browser = createBrowser()
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  browser.googleTag.prepareGoogleTag(ACCEPT_ALL_CONSENT)
  browser.window.clarity = (...args) => browser.calls.clarity.push(plain(args))
  browser.client.subscribeToCookieConsent(() => {})
  browser.client.readCookieConsent()

  // Widerruf in einem anderen Dokument, während diese Seite im Back-Forward-Cache lag: kein storage-Event.
  browser.storeDecision(REJECT_ALL_CONSENT)
  browser.fire('pageshow', { persisted: false })
  assert.notEqual(browser.window['ga-disable-G-TEST'], true)

  browser.fire('pageshow', { persisted: true })
  assert.equal(browser.window['ga-disable-G-TEST'], true)
  assert.equal(browser.window['ga-disable-AW-TEST'], true)
  assert.deepEqual(browser.calls.clarity.at(-1), ['consent', false])
})

test('a decision that cannot be stored still wins over an older stored one', () => {
  const stored = serializeConsent(ACCEPT_ALL_CONSENT, new Date('2026-09-01T10:00:00Z'))
  const browser = createBrowser({ stored, failWrites: true })
  assert.deepEqual(plain(browser.client.readCookieConsent()), ACCEPT_ALL_CONSENT)

  browser.client.saveCookieConsent(REJECT_ALL_CONSENT)
  assert.deepEqual(plain(browser.client.readCookieConsent()), REJECT_ALL_CONSENT)
  // Die alte Einwilligung darf nach dem Neuladen nicht wieder gelten.
  assert.equal(browser.storage.has(COOKIE_CONSENT_STORAGE_KEY), false)
  assert.equal(browser.googleTag.sendGoogleEvent('cta_click'), false)
})

test('a destination granted later is configured before the first event is sent to it', () => {
  const browser = createBrowser()
  browser.storeDecision({ necessary: true, analytics: true, marketing: false })
  assert.equal(browser.googleTag.sendGoogleEvent('cta_click'), true)

  // Marketing kommt aus einem anderen Tab dazu, bevor diese Seite neu gerendert hat.
  browser.storeDecision(ACCEPT_ALL_CONSENT)
  assert.equal(browser.googleTag.sendGoogleAdsConversion('purchase-label', { value: 150 }), true)

  const commands = browser.dataLayer()
  const configIndex = commands.findIndex(command => command[0] === 'config' && command[1] === 'AW-TEST')
  const conversionIndex = commands.findIndex(command => command[0] === 'event' && command[1] === 'conversion')
  assert.ok(configIndex !== -1 && configIndex < conversionIndex)
})

test('blog YouTube embeds load nothing from YouTube until the play button is clicked', async () => {
  const lazyEmbed = load(compile(await read('../components/ui/lazy-youtube-embed.tsx')), {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
    '@phosphor-icons/react/Play': { Play: () => null },
    '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
  })
  const mdx = load(compile(await read('../components/blog/mdx-components.tsx')), {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/image': { default: () => null },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/ui/lazy-youtube-embed': lazyEmbed,
  })
  const html = renderToStaticMarkup(React.createElement(mdx.customComponents.YouTubeEmbed, { videoId: 'F6Ha0V3bm2w' }))
  assert.doesNotMatch(html, /<iframe/)
  assert.doesNotMatch(html, /youtube\.com\/embed/)
  assert.match(html, /<button type="button"/)
})
