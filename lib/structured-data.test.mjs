import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ORGANIZATION_ID,
  PERSON_ID,
  SOCIAL_PROFILES,
  articleGraph,
  homeGraph,
  serializeJsonLd,
  siteGraph,
} from './structured-data.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

const FAQ = [
  { q: 'Wie funktioniert das Abo?', a: 'Monatlich kündbar.' },
  { q: 'Bekomme ich Signale?', a: 'Nein.' },
]

test('siteGraph: nur eigene Profile in sameAs, nicht der fremde Kanal @PriceActionTrader', () => {
  const graph = siteGraph()['@graph']
  for (const node of graph) {
    for (const url of node.sameAs ?? []) {
      assert.ok(Object.values(SOCIAL_PROFILES).includes(url), `unbekanntes Profil ${url}`)
      assert.doesNotMatch(url, /@PriceActionTrader$/)
    }
  }
})

test('siteGraph: keine Kurs-, FAQ- oder Bewertungsdaten auf jeder Seite', () => {
  const types = siteGraph()['@graph'].map((node) => node['@type'])
  assert.deepEqual(types.sort(), ['EducationalOrganization', 'Person', 'WebSite'])
  assert.doesNotMatch(JSON.stringify(siteGraph()), /aggregateRating|FAQPage|Course/)
})

test('homeGraph: Preis, FAQ und Bewertung kommen aus den übergebenen, sichtbaren Werten', () => {
  const data = homeGraph({ name: 'PAT Mentorship 2026', description: 'x', price: 150, currency: 'EUR', faq: FAQ, reviews: { count: 58, average: 5 } })
  const [course, faqPage] = data['@graph']
  assert.equal(course.offers.price, '150.00')
  assert.equal(course.offers.priceSpecification.valueAddedTaxIncluded, true)
  assert.equal(course.aggregateRating.reviewCount, 58)
  assert.equal(course.aggregateRating.ratingValue, '5.0')
  assert.equal(course.provider['@id'], ORGANIZATION_ID)
  assert.equal(course.hasCourseInstance.instructor['@id'], PERSON_ID)
  assert.deepEqual(
    faqPage.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
    FAQ.map((item) => [item.q, item.a]),
  )
})

test('homeGraph: ohne Bewertungen keine aggregateRating', () => {
  const data = homeGraph({ name: 'n', description: 'd', price: 150, currency: 'EUR', faq: FAQ, reviews: { count: 0, average: 0 } })
  assert.equal(data['@graph'][0].aggregateRating, undefined)
})

test('articleGraph: Autor und Verlag verweisen auf Person und Organisation, dateModified fällt auf date zurück', () => {
  const data = articleGraph({ slug: 'fvg', title: 'T', description: 'D', date: '2026-02-23' })
  const [article, breadcrumb] = data['@graph']
  assert.equal(article.author['@id'], PERSON_ID)
  assert.equal(article.publisher['@id'], ORGANIZATION_ID)
  assert.equal(article.dateModified, '2026-02-23')
  assert.equal(article.mainEntityOfPage, 'https://www.price-action-trader.de/blog/fvg')
  assert.equal(breadcrumb.itemListElement.at(-1).item, 'https://www.price-action-trader.de/blog/fvg')
})

test('serializeJsonLd: "<" wird maskiert, damit Inhalte das Skript nicht schließen', () => {
  const json = serializeJsonLd({ text: '</script><b>' })
  assert.doesNotMatch(json, /</)
  assert.deepEqual(JSON.parse(json), { text: '</script><b>' })
})

test('Root-Layout: kein Canonical, den alle Seiten erben würden', () => {
  const layout = read('app/layout.tsx')
  assert.doesNotMatch(layout, /canonical:\s*'\/'/)
  assert.doesNotMatch(layout, /130\+/)
})

test('Alte Landingpages und Funktionsseiten stehen auf noindex', () => {
  for (const path of ['app/lp-v1/page.tsx', 'app/lp-v2/page.tsx', 'app/quick-guide/page.tsx', 'app/sign-in/[[...sign-in]]/page.tsx', 'app/claim/paypal/page.tsx', 'app/checkout/page.tsx']) {
    assert.match(read(path), /robots:\s*\{\s*index:\s*false/, path)
  }
})

test('Sitemap: nur indexierbare Seiten, www-Host', () => {
  const sitemap = read('app/sitemap.ts')
  for (const path of ['/lp-v1', '/lp-v2', '/quick-guide', '/checkout', '/willkommen']) {
    assert.ok(!sitemap.includes(`\${baseUrl}${path}`), `${path} steht in der Sitemap`)
  }
  assert.match(sitemap, /https:\/\/www\.price-action-trader\.de/)
})

test('robots.txt: KI-Crawler erlaubt, Sitemap auf www, noindex-Seiten nicht gesperrt', () => {
  const robots = read('public/robots.txt')
  for (const agent of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended']) {
    assert.match(robots, new RegExp(`^User-agent: ${agent}$`, 'm'), agent)
  }
  assert.match(robots, /^Sitemap: https:\/\/www\.price-action-trader\.de\/sitemap\.xml$/m)
  assert.doesNotMatch(robots, /^Disallow: \/$/m)
  for (const path of ['/sign-in', '/checkout', '/willkommen', '/lp-v2', '/quick-guide']) {
    assert.doesNotMatch(robots, new RegExp(`^Disallow: ${path}`, 'm'), path)
  }
})
