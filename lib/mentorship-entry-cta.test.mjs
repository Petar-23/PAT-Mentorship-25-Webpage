import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const { outputText } = ts.transpileModule(await readFile(new URL('../components/sections/mentorship-entry-cta.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
})

const clicks = []

function renderCta(authState, { guestCheckout = false, onLink } = {}) {
  const exports = {}
  const deps = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@clerk/nextjs': { useUser: () => authState, SignInButton: ({ children, mode, forceRedirectUrl, signUpForceRedirectUrl }) => React.createElement('div', {
      'data-sign-in-modal': mode,
      'data-sign-in-redirect': forceRedirectUrl,
      'data-sign-up-redirect': signUpForceRedirectUrl,
    }, children) },
    '@phosphor-icons/react/ArrowRight': { ArrowRight: () => null },
    '@phosphor-icons/react/SpinnerGap': { SpinnerGap: () => null },
    'next/navigation': { useRouter: () => ({ push: () => { throw new Error('Unexpected navigation while rendering') } }) },
    'next/link': { default: ({ href, prefetch, children, onClick }) => {
      assert.equal(prefetch, false, 'Do not prefetch authentication while Clerk is loading')
      onLink?.({ href, onClick })
      return React.createElement('a', { href }, children)
    } },
    '@/components/checkout/checkout-mode': {
      useGuestCheckout: () => guestCheckout,
      checkoutEntryHref: source => `/checkout?src=${encodeURIComponent(source)}`,
    },
    '@/components/analytics/tracking': { trackConversion: { ctaClick: source => clicks.push(source) } },
    '@/components/ui/button': { Button: ({ asChild, children, disabled }) => asChild ? React.Children.only(children) : React.createElement('button', { disabled }, children) },
    '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
  }
  runInNewContext(outputText, { exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`)
    return deps[name]
  } })
  return renderToStaticMarkup(React.createElement(exports.MentorshipEntryCta, { source: 'test' }))
}

test('before Clerk is ready the entry CTA is a usable native link with the dashboard return URL', () => {
  const html = renderCta({ isLoaded: false })
  assert.match(html, /<a href="\/sign-in\?redirect_url=%2Fdashboard"><span>Jetzt einsteigen<\/span><\/a>/)
  assert.doesNotMatch(html, /disabled/)
})

test('loaded anonymous visitors keep the existing sign-in modal', () => {
  const html = renderCta({ isLoaded: true, isSignedIn: false })
  assert.match(html, /data-sign-in-modal/)
  assert.match(html, /<button><span>Jetzt einsteigen<\/span><\/button>/)
})

test('loaded members keep their dashboard button', () => {
  const html = renderCta({ isLoaded: true, isSignedIn: true })
  assert.match(html, /<button><span>Jetzt einsteigen<\/span><\/button>/)
  assert.doesNotMatch(html, /data-sign-in-modal|href=/)
})

test('sign-up from the entry modal returns to the dashboard like sign-in instead of the homepage', () => {
  const html = renderCta({ isLoaded: true, isSignedIn: false })
  assert.match(html, /data-sign-in-modal="modal"/)
  assert.match(html, /data-sign-in-redirect="\/dashboard"/)
  assert.match(html, /data-sign-up-redirect="\/dashboard"/)
})

test('guest checkout switched on: every visitor gets a plain link to /checkout with the CTA source', () => {
  for (const authState of [{ isLoaded: false }, { isLoaded: true, isSignedIn: false }, { isLoaded: true, isSignedIn: true }]) {
    let link = null
    const html = renderCta(authState, { guestCheckout: true, onLink: value => { link = value } })
    assert.match(html, /<a href="\/checkout\?src=test"><span>Jetzt einsteigen<\/span><\/a>/)
    assert.doesNotMatch(html, /data-sign-in-modal|sign-in\?redirect_url/)
    clicks.length = 0
    link.onClick()
    assert.deepEqual(clicks, ['test'], 'cta_click is tracked with the source')
  }
})
