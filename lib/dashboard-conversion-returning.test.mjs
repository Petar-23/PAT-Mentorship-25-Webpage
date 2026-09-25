import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

// Rendert die echte Kaufansicht mit lokalen Doubles. Kein Stripe, kein Clerk.
const { outputText } = ts.transpileModule(
  await readFile(new URL('../app/(dashboard)/dashboard/dashboard-conversion-client.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }
)

const icon = () => null
function passthrough(tag) {
  function Passthrough({ children, className }) {
    return React.createElement(tag, { className }, children)
  }
  return Passthrough
}

function renderConversion(previousSubscription) {
  const exports = {}
  const deps = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
    'next/dynamic': { default: () => props => React.createElement('button', { 'data-checkout': true }, props.label) },
    '@/components/ui/button': { Button: ({ asChild, children }) => asChild ? React.Children.only(children) : React.createElement('button', null, children) },
    '@/components/ui/card': {
      Card: passthrough('section'),
      CardContent: passthrough('div'),
      CardHeader: passthrough('div'),
      CardTitle: passthrough('h2'),
    },
    '@phosphor-icons/react/ArrowClockwise': { ArrowClockwise: icon },
    '@phosphor-icons/react/BookOpen': { BookOpen: icon },
    '@phosphor-icons/react/CalendarCheck': { CalendarCheck: icon },
    '@phosphor-icons/react/CheckCircle': { CheckCircle: icon },
    '@phosphor-icons/react/Lock': { LockIcon: icon },
    '@phosphor-icons/react/SpinnerGap': { SpinnerGap: icon },
    '@/lib/config': {
      MENTORSHIP_CONFIG: {
        programName: 'PAT Mentorship 2026',
        priceFormatted: '€150',
        startDateFormatted: '01.03.2026',
        paymentNote: 'Monatlich kündbar.',
      },
      MENTORSHIP_IS_UPCOMING: false,
    },
  }
  runInNewContext(outputText, { exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`)
    return deps[name]
  } })

  return renderToStaticMarkup(React.createElement(exports.default, {
    firstName: 'Test',
    previousSubscription,
    viewFlags: {
      showCheckoutSuccess: false,
      showCheckoutCanceled: false,
      showCoursesPaywall: false,
      showMentorshipNotStarted: false,
    },
  }))
}

test('former members whose subscription ended are welcomed back and can book again', () => {
  const html = renderConversion('ended')
  assert.match(html, /Willkommen zurück, Test/)
  assert.match(html, /Dein bisheriges Abo ist beendet/)
  assert.match(html, /data-checkout/)
})

test('an expired first payment offers a new booking without the returning member wording', () => {
  const html = renderConversion('payment-expired')
  assert.doesNotMatch(html, /Willkommen zurück|bisheriges Abo/)
  assert.match(html, /Deine letzte Zahlung wurde nicht abgeschlossen/)
  assert.match(html, /data-checkout/)
})

test('new customers see the plain welcome', () => {
  const html = renderConversion(null)
  assert.doesNotMatch(html, /Willkommen zurück|bisheriges Abo|nicht abgeschlossen\. Du kannst/)
  assert.match(html, /Willkommen, Test/)
})

test('new returning texts contain no dashes as sentence separators', () => {
  for (const state of ['ended', 'payment-expired']) {
    const html = renderConversion(state)
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
    assert.doesNotMatch(header, /[–—]/)
  }
})
