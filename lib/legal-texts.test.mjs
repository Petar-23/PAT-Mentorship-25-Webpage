import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// /AGB und /Widerruf rendern aus lib/legal-texts.ts, derselben Quelle wie die Vertragsbestätigung.
// Hier wird geprüft, dass jeder Text der Quelle auf der Seite steht (und damit Seite und Mail gleich sind).

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)((id) => (id in replacements ? replacements[id] : require(id)), compiled, compiled.exports)
  return compiled.exports
}

const legal = loadTs('./legal-texts.ts')
const blocks = loadTs('../components/legal/legal-blocks.tsx', { '@/lib/legal-texts': legal })
const replacements = {
  '@/components/ui/card': { Card: ({ className, children }) => React.createElement('div', { className }, children) },
  '@/components/legal/legal-blocks': blocks,
  '@/lib/legal-texts': legal,
}

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

function textsOf(document) {
  const texts = [document.title, document.stand, document.closing]
  for (const section of document.sections) {
    texts.push(section.heading)
    for (const block of section.blocks) {
      const parts = block.type === 'paragraph' ? [block.content] : block.items
      for (const part of parts.flat()) texts.push(typeof part === 'string' ? part : part.text)
    }
  }
  return texts.map((text) => text.trim()).filter(Boolean)
}

function render(path) {
  const Page = loadTs(path, replacements).default
  return renderToStaticMarkup(React.createElement(Page))
}

test('/AGB renders every text of the shared source', () => {
  const html = render('../app/AGB/page.tsx')
  for (const text of textsOf(legal.AGB)) assert.ok(html.includes(escape(text)), text.slice(0, 60))
  assert.match(html, /<a href="https:\/\/price-action-trader\.de\/Widerruf" target="_blank" rel="noopener noreferrer"/)
  assert.equal((html.match(/<section/g) ?? []).length, legal.AGB.sections.length)
})

test('/Widerruf renders every text of the shared source including the model withdrawal form', () => {
  const html = render('../app/Widerruf/page.tsx')
  const form = legal.WIDERRUFSBELEHRUNG.form
  const texts = [...textsOf(legal.WIDERRUFSBELEHRUNG), form.heading, form.hint, form.statement, form.footnote, ...form.recipientLines]
  for (const text of texts) assert.ok(html.includes(escape(text)), text.slice(0, 60))
  for (const field of form.fields) assert.ok(html.includes(`<p>- ${escape(field)}</p>`), field)
  assert.match(html, /<a href="mailto:kontakt@price-action-trader\.de" class="text-blue-600 underline hover:text-blue-700">E-Mail: kontakt@price-action-trader\.de<\/a>/)
})

test('plain-text version for the mail keeps headings, list numbering and link targets', () => {
  const agb = legal.legalDocumentToText(legal.AGB)
  assert.match(agb, /^Allgemeine Geschäftsbedingungen \(AGB\)\nder Maric Capital GmbH, Stand: Januar 2026/)
  assert.match(agb, /§ 3 Vertragsschluss und Preisangabe\n1\. Der Vertrag kommt/)
  assert.match(agb, /• keine Mindestlaufzeit/)
  assert.match(agb, /price-action-trader\.de\/Widerruf \(https:\/\/price-action-trader\.de\/Widerruf\) abrufbar/)

  const widerruf = legal.legalDocumentToText(legal.WIDERRUFSBELEHRUNG)
  assert.match(widerruf, /Muster-Widerrufsformular\n\(Wenn Sie den Vertrag widerrufen wollen/)
  assert.match(widerruf, /An:\nMaric Capital GmbH\nKarolinenstraße 13\n64342 Seeheim-Jugenheim\nE-Mail: kontakt@price-action-trader\.de\n/)
  assert.match(widerruf, /- Datum\n\n\(\*\) Unzutreffendes streichen/)
})
