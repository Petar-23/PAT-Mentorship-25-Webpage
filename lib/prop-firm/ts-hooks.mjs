/**
 * Prop-Firm-Rechner: Modul-Hooks für Node (Tests und scripts/prop-firm-rueckwaerts.mjs).
 * Die TS-Module importieren einander ohne Dateiendung (wie im Next-Build); die Hooks lösen .ts/.tsx und '@/' auf,
 * übersetzen .tsx (für Render-Tests), laden JSON und CSS als Module und ersetzen next/image und next/link durch
 * schlichte <img> und <a>.
 */
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'

const WURZEL = new URL('../../', import.meta.url)

let registriert = false

/** Lädt .ts/.tsx, '@/'-Pfade, JSON und CSS als Module (Node-Test und Skripte, ohne Next-Build). */
export async function registriereTs() {
  if (registriert) return
  registriert = true
  const ts = (await import('typescript')).default
  registerHooks({
    resolve(spec, ctx, next) {
      // next/image und next/link brauchen die Next-Laufzeit; für den Server-Render reichen <img> und <a>
      if (spec === 'next/image' || spec === 'next/link') return { url: `pfr-stub:${spec}`, shortCircuit: true }
      const ziel = spec.startsWith('@/') ? new URL(spec.slice(2), WURZEL).href : spec
      try {
        return next(ziel, ctx)
      } catch (err) {
        // texte.de / texte.en: Punkt im Namen ist keine Dateiendung
        if ((ziel.startsWith('.') || ziel.startsWith('file:')) && !/\.(m?[jt]sx?|json|css)$/i.test(ziel)) {
          for (const endung of ['.ts', '.tsx']) {
            try {
              return next(`${ziel}${endung}`, ctx)
            } catch {
              // nächste Endung
            }
          }
        }
        throw err
      }
    },
    load(url, ctx, next) {
      if (url.startsWith('pfr-stub:')) {
        const react = new URL('node_modules/react/index.js', WURZEL).href
        const komponente = url === 'pfr-stub:next/image'
          ? "function Image({ src, alt, width, height }) { return React.createElement('img', { src, alt, width, height }) }"
          : "function Link({ href, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }) }"
        return { format: 'module', source: `import React from '${react}'\nexport default ${komponente}`, shortCircuit: true }
      }
      if (url.endsWith('.tsx')) {
        const quelle = readFileSync(new URL(url), 'utf8')
        const js = ts.transpileModule(quelle, {
          fileName: url,
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText
        return { format: 'module', source: js, shortCircuit: true }
      }
      if (url.endsWith('.json') && !ctx.importAttributes?.type) {
        return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true }
      }
      if (url.endsWith('.css')) return { format: 'module', source: 'export {}', shortCircuit: true }
      return next(url, ctx)
    },
  })
}
