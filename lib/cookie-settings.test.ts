// @ts-nocheck -- Node executes TypeScript tests directly and requires explicit .ts specifiers.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentSnapshotFromSerialized,
  DEFAULT_COOKIE_CONSENT,
  normalizeCookieConsent,
  parseCookieConsent,
} from './cookie-settings.ts'

test('keeps the existing storage key and denied-by-default consent', () => {
  assert.equal(COOKIE_CONSENT_STORAGE_KEY, 'cookieConsent')
  assert.deepEqual(DEFAULT_COOKIE_CONSENT, {
    necessary: true,
    analytics: false,
    marketing: false,
  })
})

test('normalization always enforces necessary consent', () => {
  assert.deepEqual(
    normalizeCookieConsent({ necessary: false, analytics: true, marketing: false }),
    { necessary: true, analytics: true, marketing: false }
  )
})

test('parser rejects missing, corrupt and structurally invalid values', () => {
  assert.equal(parseCookieConsent(null), null)
  assert.equal(parseCookieConsent('{'), null)
  assert.equal(parseCookieConsent('[]'), null)
  assert.equal(parseCookieConsent(JSON.stringify({ analytics: true })), null)
})

test('parser accepts legacy booleans but restores the necessary invariant', () => {
  assert.deepEqual(
    parseCookieConsent(
      JSON.stringify({ necessary: false, analytics: true, marketing: 'yes' })
    ),
    { necessary: true, analytics: true, marketing: false }
  )
})

test('invalid storage remains an unsaved denied snapshot', () => {
  assert.deepEqual(cookieConsentSnapshotFromSerialized('{'), {
    consent: DEFAULT_COOKIE_CONSENT,
    hasSavedConsent: false,
  })
  assert.deepEqual(
    cookieConsentSnapshotFromSerialized(
      JSON.stringify({ necessary: true, analytics: true, marketing: true })
    ),
    {
      consent: { necessary: true, analytics: true, marketing: true },
      hasSavedConsent: true,
    }
  )
})
