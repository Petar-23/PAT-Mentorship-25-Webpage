import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { LEGAL_ROUTES, legalPathRedirect } from './legal-path-aliases.mjs'

test('lowercase legal paths redirect to the real routes', () => {
  assert.equal(legalPathRedirect('/agb'), '/AGB')
  assert.equal(legalPathRedirect('/widerruf'), '/Widerruf')
})

test('other spellings redirect as well', () => {
  assert.equal(legalPathRedirect('/Agb'), '/AGB')
  assert.equal(legalPathRedirect('/WIDERRUF'), '/Widerruf')
  assert.equal(legalPathRedirect('/agb/'), '/AGB')
})

test('the real routes never redirect to themselves', () => {
  assert.equal(legalPathRedirect('/AGB'), null)
  assert.equal(legalPathRedirect('/Widerruf'), null)
})

test('unrelated paths are left alone', () => {
  for (const path of ['/', '/widerrufen', '/agb/extra', '/impressum', '/datenschutz', '/kuendigen', '']) {
    assert.equal(legalPathRedirect(path), null, path)
  }
})

test('next.config.ts has no case-insensitive redirect for the legal routes', async () => {
  // Next vergleicht redirect-Quellen ohne Groß- und Kleinschreibung.
  // Eine Regel für /agb oder /widerruf dort würde /AGB bzw. /Widerruf endlos umleiten.
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(config, /source:\s*['"]\/(agb|widerruf)['"]/i)
})

test('every redirect target is an app route in exactly this spelling', async () => {
  // Wird ein Ordner umbenannt (z. B. app/Widerruf -> app/widerruf), würde die
  // Weiterleitung sonst auf eine 404-Seite zeigen. readdir liefert die echte
  // Schreibweise, auch auf Dateisystemen ohne Groß-/Kleinschreibung (macOS).
  const appDir = new URL('../app/', import.meta.url)
  const entries = await readdir(appDir)
  for (const route of LEGAL_ROUTES) {
    const segment = route.slice(1)
    assert.ok(entries.includes(segment), `app/${segment} fehlt`)
    const others = entries.filter((name) => name !== segment && name.toLowerCase() === segment.toLowerCase())
    assert.deepEqual(others, [], `zweiter Ordner für ${route}`)
    const files = await readdir(new URL(`${segment}/`, appDir))
    assert.ok(files.includes('page.tsx'), `app/${segment}/page.tsx fehlt`)
  }
})

test('middleware uses the legal path redirect', async () => {
  const middleware = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8')
  assert.match(middleware, /legalPathRedirect\(/)
})
