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

function renderCta(authState) {
  const exports = {}
  const deps = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@clerk/nextjs': { useUser: () => authState, SignInButton: ({ children }) => React.createElement('div', { 'data-sign-in-modal': true }, children) },
    '@phosphor-icons/react/ArrowRight': { ArrowRight: () => null },
    '@phosphor-icons/react/SpinnerGap': { SpinnerGap: () => null },
    'next/navigation': { useRouter: () => ({ push: () => { throw new Error('Unexpected navigation while rendering') } }) },
    'next/link': { default: ({ href, prefetch, children }) => {
      assert.equal(prefetch, false, 'Do not prefetch authentication while Clerk is loading')
      return React.createElement('a', { href }, children)
    } },
    '@/components/analytics/tracking': { trackConversion: {} },
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
