import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

// Rendert die echte Mitgliederansicht mit lokalen Doubles. Kein Stripe, kein Clerk.
const { outputText } = ts.transpileModule(
  await readFile(new URL('../app/(dashboard)/dashboard/dashboard-member-client.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }
)

const icon = () => null
function passthrough(tag) {
  function Passthrough({ children, className }) {
    return React.createElement(tag, { className }, children)
  }
  return Passthrough
}

function renderMember({ status, hasSubscription = false, notice }) {
  const exports = {}
  const deps = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) },
    // dynamic(): Portal-Button als erkennbarer Platzhalter mit seinem Label rendern.
    'next/dynamic': { default: () => props => React.createElement('button', { 'data-portal': props.label ?? 'default' }, props.label ?? 'Abonnement Verwalten') },
    '@/components/ui/button': { Button: ({ asChild, children }) => asChild ? React.Children.only(children) : React.createElement('button', null, children) },
    '@/components/ui/card': {
      Card: passthrough('section'),
      CardContent: passthrough('div'),
      CardDescription: passthrough('p'),
      CardHeader: passthrough('div'),
      CardTitle: passthrough('h2'),
    },
    '@phosphor-icons/react/ArrowClockwise': { ArrowClockwise: icon },
    '@phosphor-icons/react/BookOpen': { BookOpen: icon },
    '@phosphor-icons/react/Clock': { Clock: icon },
    '@phosphor-icons/react/CreditCard': { CreditCard: icon },
    '@phosphor-icons/react/Lock': { LockIcon: icon },
    '@phosphor-icons/react/Warning': { Warning: icon },
    '@/components/analytics/tracking': { trackConversion: { purchase: () => {} } },
    '@/lib/config': { MENTORSHIP_CONFIG: { startDateFormatted: '01.03.2026', price: 150 }, MENTORSHIP_IS_UPCOMING: false },
  }
  runInNewContext(outputText, { exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`)
    return deps[name]
  } })

  return renderToStaticMarkup(React.createElement(exports.default, {
    initialData: {
      hasSubscription,
      subscriptionDetails: {
        status,
        startDate: '2026-03-01T00:00:00.000Z',
        isPending: status === 'incomplete',
        isCanceled: false,
        cancelAt: null,
        currentPeriodEnd: '2026-10-25T12:00:00.000Z',
      },
      mentorshipStatus: { accessible: true, startDate: '2026-03-01T00:00:00.000Z' },
      user: { firstName: 'Test' },
    },
    notice,
    viewFlags: { showCheckoutSuccess: false, showCoursesPaywall: true },
  }))
}

test('past_due members see the open payment notice with a portal link and no checkout', () => {
  const html = renderMember({ status: 'past_due', notice: 'payment-due' })
  assert.match(html, /Zahlung offen/)
  assert.match(html, /data-portal="Offene Rechnung bezahlen"/)
  assert.doesNotMatch(html, /create-checkout|Weiter zu Stripe|Zum Checkout/)
  // Der allgemeine Paywall-Hinweis wird vom Zahlungshinweis ersetzt, nicht doppelt gezeigt.
  assert.doesNotMatch(html, /Kursbereich gesperrt/)
})

test('incomplete members see the payment processing notice', () => {
  const html = renderMember({ status: 'incomplete', notice: 'payment-processing' })
  assert.match(html, /Zahlung wird verarbeitet/)
  assert.match(html, /keinen zweiten Checkout/)
  assert.doesNotMatch(html, /Offene Rechnung bezahlen/)
  // Kein zweiter, widersprüchlicher Paywall-Hinweis („schließe es ab“) neben dem Verarbeitungshinweis.
  assert.doesNotMatch(html, /Kursbereich gesperrt/)
})

test('active members see no payment notice', () => {
  const html = renderMember({ status: 'active', hasSubscription: true, notice: null })
  assert.doesNotMatch(html, /Zahlung offen|Zahlung wird verarbeitet/)
  assert.match(html, /Zur Mentorship Platform/)
})

test('new notice texts contain no dashes as sentence separators', () => {
  for (const notice of ['payment-due', 'payment-processing']) {
    const html = renderMember({ status: notice === 'payment-due' ? 'unpaid' : 'incomplete', notice })
    assert.doesNotMatch(html, /[–—]/)
  }
})

test('without a payment notice the course paywall hint still appears for inactive subscriptions', () => {
  // z. B. Admin mit beendetem Abo oder trialing mit geplanter Kündigung
  const html = renderMember({ status: 'canceled', notice: null })
  assert.match(html, /Kursbereich gesperrt/)
  assert.doesNotMatch(html, /Zahlung offen|Zahlung wird verarbeitet/)
})
