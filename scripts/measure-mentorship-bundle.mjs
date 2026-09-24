import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

// Run after `npm run build`. Counts each referenced JS file once per route.
// This is a build-size comparison, not a measurement of navigation or network timing.
const result = { build: (await readFile('.next/BUILD_ID', 'utf8')).trim(), routes: {}, homeFontPreloads: [] }

for (const route of ['home', 'page', '[id]/page', 'modul/[id]/page', 'indicators/page']) {
  const context = {}
  const manifestPath = route === 'home' ? 'page' : `mentorship/${route}`
  const source = await readFile(`.next/server/app/${manifestPath}_client-reference-manifest.js`, 'utf8')
  runInNewContext(source, context, { timeout: 1000 })
  const manifest = Object.values(context.__RSC_MANIFEST)[0]
  const files = new Set(Object.values(manifest.clientModules)
    .flatMap(module => module.chunks).filter(file => file.endsWith('.js')))
  const chunks = await Promise.all([...files].map(file => readFile(`.next/${decodeURIComponent(file)}`)))
  result.routes[route] = {
    bytes: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    gzipBytes: chunks.reduce((sum, chunk) => sum + gzipSync(chunk).length, 0),
    files: files.size,
  }
}

// Preloads compete with the first visible content, even when the font is unused.
const home = await readFile('.next/server/app/index.html', 'utf8')
for (const [tag] of home.matchAll(/<link\b[^>]*>/g)) {
  if (!tag.includes('rel="preload"') || !tag.includes('as="font"')) continue
  const href = tag.match(/href="([^"]+)"/)?.[1]
  if (!href?.startsWith('/_next/static/media/')) throw new Error('Unexpected font preload URL')
  const data = await readFile(`.next/${href.slice('/_next/'.length)}`)
  result.homeFontPreloads.push({ href, bytes: data.length })
}

console.log(JSON.stringify(result, null, 2))
