import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Landingpage /lp-v3: Regeln für Texte und Einbindung, die sonst nur beim Lesen auffallen würden.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LANDING_DIRS = ['components/landing-v3', 'app/lp-v3']

function listFiles(dir) {
  const abs = join(ROOT, dir)
  return readdirSync(abs).flatMap((name) => {
    const path = join(abs, name)
    return statSync(path).isDirectory() ? listFiles(relative(ROOT, path)) : [path]
  })
}

const files = LANDING_DIRS.flatMap(listFiles).filter((path) => /\.(tsx?|css|mjs)$/.test(path))
const read = (path) => readFileSync(path, 'utf8')

test('Landingpage: Dateien gefunden', () => {
  assert.ok(files.length >= 10, `nur ${files.length} Dateien`)
})

test('Landingpage: keine Gedankenstriche (U+2013, U+2014), auch nicht in Zeichnungen', () => {
  for (const path of files) {
    const text = read(path)
    for (const dash of ['–', '—']) {
      const index = text.indexOf(dash)
      assert.equal(index, -1, `${relative(ROOT, path)} enthält U+${dash.codePointAt(0).toString(16).toUpperCase()} bei Zeichen ${index}`)
    }
  }
})

test('Landingpage: keine Entwurfs-Reste (Test-Schnittstellen, Farbschema per Hash, Entwurfs-Hinweis, Platzhalter)', () => {
  for (const path of files) {
    const text = read(path)
    for (const pattern of [/__warum(Seek|Progress)/, /__lehrplan(Seek|Progress)/, /#nacht|#tag\b/, /Entwurf\. Farbschema/, /\{\{[\w-]+\}\}/, /window\.__patTheme|window\.PATTheme/]) {
      assert.doesNotMatch(text, pattern, `${relative(ROOT, path)} enthält ${pattern}`)
    }
  }
})

test('Landingpage: jeder Kaufbutton zeigt auf den Checkout mit passender Quelle', () => {
  let buttons = 0
  for (const path of files.filter((p) => p.endsWith('.tsx'))) {
    const text = read(path)
    assert.doesNotMatch(text, /price-action-trader\.de\/(sign-in|checkout)/, `${relative(ROOT, path)}: absolute Kauf- oder Login-Adresse`)
    for (const match of text.matchAll(/<a\b[^>]*data-cta=\{ctaSource\('(\w+)'\)\}[^>]*>/g)) {
      buttons += 1
      assert.match(match[0], new RegExp(`href=\\{checkoutHref\\('${match[1]}'\\)\\}`), `${relative(ROOT, path)}: Quelle und Ziel passen nicht: ${match[0]}`)
    }
  }
  // Kopfzeile, Hero, Preis, Schluss (die mobile Kaufleiste bekommt Ziel und Quelle als Props)
  assert.equal(buttons, 4)
  const content = read(join(ROOT, 'components/landing-v3/content.ts'))
  assert.match(content, /export const CHECKOUT_URL = '\/checkout'/)
  assert.match(content, /\$\{CHECKOUT_URL\}\?src=\$\{ctaSource\(position\)\}/)
  assert.match(content, /`lp3-\$\{position\}`/)
})

// Next lädt das CSS einer Route beim Weiternavigieren nicht wieder ab: jede Regel muss an .pat-lf hängen.
function splitSelectors(selector) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of selector) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += char
  }
  parts.push(current.trim())
  return parts
}

test('Landingpage: CSS ist vollständig unter .pat-lf gekapselt', () => {
  const css = read(join(ROOT, 'components/landing-v3/landing-v3.css')).replace(/\/\*[\s\S]*?\*\//g, '')
  const withoutKeyframes = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  assert.match(css, /@keyframes lf-/, 'Keyframes tragen das Präfix lf-')
  assert.doesNotMatch(css, /@keyframes (?!lf-)/, 'Keyframes ohne Präfix lf- könnten globale Namen überschreiben')
  const leaks = []
  for (const match of withoutKeyframes.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].trim()
    if (selector.startsWith('@')) continue
    for (const part of splitSelectors(selector)) {
      if (!part.startsWith('.pat-lf') && !part.startsWith('html:has(.pat-lf')) leaks.push(part)
    }
  }
  assert.deepEqual(leaks, [])
})

test('Landingpage: Seite ist nicht indexierbar und verweist per Canonical auf die Startseite', () => {
  const page = read(join(ROOT, 'app/lp-v3/page.tsx'))
  assert.match(page, /robots: \{ index: false/)
  assert.match(page, /canonical: '\/'/)
  const sitemap = read(join(ROOT, 'app/sitemap.ts'))
  assert.doesNotMatch(sitemap, /lp-v3/)
})

test('Landingpage: Trailer liegt unter versioniertem Namen (lange Cache-Dauer in next.config.ts)', () => {
  const trailers = readdirSync(join(ROOT, 'public/landing')).filter((name) => name.endsWith('.mp4'))
  assert.ok(trailers.length > 0)
  for (const name of trailers) assert.match(name, /^trailer-v\d+\.mp4$/)
  const source = read(join(ROOT, 'components/landing-v3/client/trailer.tsx'))
  assert.ok(trailers.some((name) => source.includes(`/landing/${name}`)), 'trailer.tsx verweist auf keine vorhandene Datei')
})
