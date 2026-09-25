// Raid Map (und künftig PAT Research) legen je User einen EIGENEN USD-Customer an, der nur
// produktbezogene Metadata trägt und bewusst KEIN metadata.userId hat (Mentorship rechnet in EUR,
// Stripe verbietet Currency-Mix pro Customer). Solche Customers dürfen von den Mentorship-
// Email-Fallbacks nie ausgewählt oder per metadata.userId verknüpft werden.
export const PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS = Object.freeze(['raidmapUserId', 'researchUserId'])

/**
 * @typedef {{ id: string, created: number, deleted?: unknown, metadata?: Record<string, string> | null }} CustomerLike
 */

/**
 * @param {{ metadata?: Record<string, string> | null } | null | undefined} customer
 * @returns {boolean}
 */
export function isProductScopedCustomer(customer) {
  const metadata = customer?.metadata
  if (!metadata) return false
  return PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS.some((key) => {
    const value = metadata[key]
    return typeof value === 'string' && value.length > 0
  })
}

/**
 * Auswahl für die Mentorship-Email-Fallbacks: gelöschte und produktbezogene Customers raus,
 * danach wie bisher der neueste (`created`) Customer.
 *
 * @template {CustomerLike} T
 * @param {readonly T[]} customers
 * @returns {T | null}
 */
export function selectEmailFallbackCustomer(customers) {
  const eligible = customers
    .filter((c) => !('deleted' in c && c.deleted))
    .filter((c) => !isProductScopedCustomer(c))
    .sort((a, b) => b.created - a.created)
  return eligible[0] ?? null
}

/**
 * Eine metadata.userId-Suche sollte nie einen produktbezogenen Customer liefern. Falls doch
 * (z. B. alte Fehlzuordnung über den Email-Fallback), nur im Log sichtbar machen: Ergebnis und
 * Customer bleiben unverändert (siehe scripts/find-misassigned-stripe-customers.mjs).
 *
 * @param {readonly CustomerLike[]} customers
 * @param {string} context
 */
export function warnOnProductScopedUserIdMatch(customers, context) {
  const ids = customers.filter((c) => isProductScopedCustomer(c)).map((c) => c.id)
  if (ids.length > 0) {
    console.warn(`[stripe] ${context}: metadata.userId matcht produktbezogene Customer (manuell prüfen): ${ids.join(', ')}`)
  }
}
