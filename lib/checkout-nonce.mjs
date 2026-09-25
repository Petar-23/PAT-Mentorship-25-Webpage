// Nonce für den Gast-Checkout: /api/checkout/start legt sie als HttpOnly-Cookie pat_co ab und schreibt
// nur ihren Hash in die Stripe-Metadaten. /willkommen meldet ein neues Konto nur automatisch an, wenn
// das Cookie im selben Browser zum Hash passt. Nur serverseitig verwenden.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const HASH_PREFIX = 'pat-checkout-nonce:v1:'
const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/

/** Neue Nonce, 32 Zufallsbytes als base64url. */
export function createCheckoutNonce() {
  return randomBytes(32).toString('base64url')
}

/**
 * @param {string} nonce
 * @returns {string} SHA-256 als Hex
 */
export function hashCheckoutNonce(nonce) {
  return createHash('sha256').update(`${HASH_PREFIX}${nonce}`).digest('hex')
}

/**
 * Passt die Nonce aus dem Cookie zum Hash aus der Session? Vergleich in konstanter Zeit.
 * @param {string | null | undefined} nonce
 * @param {string | null | undefined} expectedHash
 */
export function nonceMatchesHash(nonce, expectedHash) {
  if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) return false
  if (typeof expectedHash !== 'string' || !HASH_PATTERN.test(expectedHash)) return false
  const actual = Buffer.from(hashCheckoutNonce(nonce), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
