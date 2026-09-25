import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Bundle-Grenzen zwischen PAT Research und der übrigen Website (gemessen am
// 25.09.2026 mit scripts/measure-mentorship-bundle.mjs):
// - Research-Code nutzt die Mentorship-Icon-Sammeldatei nicht. Sonst markiert
//   Webpacks Tree-Shaking Icons als benutzt, die nur Research im Browser braucht,
//   und sie landen im Mentorship-Bundle (+~4 KB gzip je Mentorship-Seite).
// - Das Root-Chrome (Teil JEDER Seite) importiert nur das importfreie Mini-Modul
//   lib/research/surface.mjs bzw. components/research/surface.tsx — nie Routing,
//   Konfiguration (Einwilligungstexte) oder den Base-Path-Provider.

const root = new URL('../../', import.meta.url)
const read = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')

function listFiles(relativeDir) {
  const dir = new URL(relativeDir, root)
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(`${rel}/`))
    else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(rel)
  }
  return out
}

test('research code never imports the mentorship icon barrel', () => {
  const offenders = [...listFiles('app/research/'), ...listFiles('components/research/')]
    .filter((file) => /from ['"]@\/components\/mentorship\/icons['"]/.test(read(file)))
  assert.deepEqual(offenders, [])
})

test('root chrome imports only the tiny research surface module', () => {
  const rootChrome = [
    'components/layout/localized-clerk-provider.tsx',
    'components/analytics/analytics-scripts-loader.tsx',
    'components/ui/cookie-banner-loader.tsx',
    'components/layout/navbar.tsx',
    'components/layout/footer.tsx',
    'app/layout.tsx',
  ]
  for (const file of rootChrome) {
    const imports = [...read(file).matchAll(/from ['"](@\/(?:lib|components)\/research\/[^'"]+)['"]/g)].map((m) => m[1])
    for (const specifier of imports) {
      assert.ok(
        specifier === '@/lib/research/surface.mjs' || specifier === '@/components/research/surface',
        `${file} imports ${specifier}; root chrome may only use the research surface module`
      )
    }
  }
  const surface = read('components/research/surface.tsx')
  const surfaceImports = [...surface.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]).sort()
  assert.deepEqual(surfaceImports, ['@/lib/research/surface.mjs', 'next/navigation', 'react'])
})
