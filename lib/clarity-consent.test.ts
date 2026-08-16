// @ts-nocheck -- Node executes TypeScript tests directly and requires explicit .ts specifiers.
import assert from 'node:assert/strict'
import test from 'node:test'

import { syncClarityConsent } from './clarity-consent.ts'

test('grants analytics while keeping advertising storage denied', () => {
  const calls: unknown[][] = []

  assert.equal(syncClarityConsent((...args) => calls.push(args), true), true)
  assert.deepEqual(calls, [
    [
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'granted' },
    ],
  ])
})

test('revocation denies storage before erasing cookies and stopping tracking', () => {
  const calls: unknown[][] = []

  assert.equal(syncClarityConsent((...args) => calls.push(args), false), true)
  assert.deepEqual(calls, [
    [
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'denied' },
    ],
    ['consent', false],
  ])
})

test('does nothing before the Clarity runtime exists', () => {
  assert.equal(syncClarityConsent(undefined, true), false)
})
