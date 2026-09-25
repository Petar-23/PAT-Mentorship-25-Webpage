#!/usr/bin/env node
/**
 * READ-ONLY Report: vermutlich falsch zugeordnete Mentorship-Stripe-Customers.
 *
 * Stripe: Customers mit metadata.userId (Mentorship), die
 *   - zusätzlich einen produktbezogenen Key (raidmapUserId / researchUserId) tragen (alter
 *     Mentorship-Email-Fallback), oder
 *   - eine Currency ungleich EUR haben (z. B. die ersten Raid-Map-Customers vom 06./07.07.2026,
 *     die nur metadata.userId bekamen). Ein Mentorship-EUR-Checkout scheitert an ihnen.
 * DB (nur wenn DATABASE_URL gesetzt): UserSubscription-Zeilen, deren stripeCustomerId auf einen
 *   produktbezogenen oder oben gemeldeten Customer zeigt. Der alte Email-Fallback hat die ID dort
 *   gecacht; Portal und Dashboard nutzen sie ohne neue Stripe-Suche.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_live_... [DATABASE_URL=postgres://...] node scripts/find-misassigned-stripe-customers.mjs
 *
 * - Liest nur (customers.list, SELECT in einer READ ONLY-Transaktion), schreibt NIE etwas.
 *   Ein Restricted Key mit "Customers: Read" reicht.
 * - Gibt nur IDs und Key-Namen aus (keine E-Mails, keine Metadata-Werte).
 * - Korrekturen bitte manuell nach Prüfung: Stripe-Metadata UND UserSubscription.stripeCustomerId.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS, isProductScopedCustomer } from '../lib/stripe-customer-scope.mjs'

const MENTORSHIP_CURRENCY = 'eur'

export function findMisassignedCustomers(customers) {
  return customers
    .filter((c) => !c.deleted && typeof c.metadata?.userId === 'string' && c.metadata.userId.length > 0)
    .map((c) => {
      const productKeys = PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS.filter((key) => c.metadata[key])
      const currency = typeof c.currency === 'string' && c.currency && c.currency.toLowerCase() !== MENTORSHIP_CURRENCY
        ? c.currency
        : null
      if (productKeys.length === 0 && !currency) return null
      return {
        id: c.id,
        keys: ['userId', ...productKeys],
        sameUser: productKeys.length > 0 ? productKeys.every((key) => c.metadata[key] === c.metadata.userId) : null,
        currency,
      }
    })
    .filter(Boolean)
}

// Customer-IDs, auf die UserSubscription nie zeigen sollte: produktbezogene + oben gemeldete.
export function customerIdsForDbCheck(customers, findings) {
  const productScoped = customers.filter((c) => !c.deleted && isProductScopedCustomer(c)).map((c) => c.id)
  return [...new Set([...productScoped, ...findings.map((f) => f.id)])]
}

export async function findUserSubscriptionsForCustomers(db, customerIds) {
  if (customerIds.length === 0) return []
  await db.query('BEGIN READ ONLY')
  try {
    const { rows } = await db.query(
      'SELECT "userId", "stripeCustomerId", "status" FROM "UserSubscription" WHERE "stripeCustomerId" = ANY($1::text[]) ORDER BY "stripeCustomerId"',
      [customerIds],
    )
    return rows
  } finally {
    await db.query('ROLLBACK')
  }
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('Abbruch: STRIPE_SECRET_KEY fehlt (bitte selbst im Environment setzen).')
    process.exit(1)
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-10-28.acacia' })
  const customers = []
  for await (const customer of stripe.customers.list({ limit: 100 })) customers.push(customer)

  const findings = findMisassignedCustomers(customers)
  for (const f of findings) {
    const details = [`keys=${f.keys.join(',')}`]
    if (f.sameUser !== null) details.push(`sameUser=${f.sameUser ? 'yes' : 'no'}`)
    if (f.currency) details.push(`currency=${f.currency}`)
    console.log(`${f.id}  ${details.join('  ')}`)
  }
  console.log(`${findings.length} verdächtige von ${customers.length} Customers (nichts verändert).`)

  if (!process.env.DATABASE_URL) {
    console.log('UserSubscription NICHT geprüft (DATABASE_URL fehlt): dort gecachte stripeCustomerIds nutzen Portal/Dashboard ohne neue Stripe-Suche.')
  } else {
    const { Client } = await import('pg')
    const db = new Client({ connectionString: process.env.DATABASE_URL })
    await db.connect()
    try {
      const rows = await findUserSubscriptionsForCustomers(db, customerIdsForDbCheck(customers, findings))
      for (const row of rows) console.log(`UserSubscription userId=${row.userId} -> ${row.stripeCustomerId}  status=${row.status}`)
      console.log(`${rows.length} UserSubscription-Zeilen zeigen auf produktbezogene/verdächtige Customers (nichts verändert).`)
    } finally {
      await db.end()
    }
  }
  console.log('Korrektur manuell: Stripe-Metadata UND UserSubscription.stripeCustomerId bereinigen.')
}

// realpath auf beiden Seiten, sonst läuft main() bei Aufruf über einen Symlink (z. B. /tmp) stumm nicht.
function isMain() {
  if (!process.argv[1]) return false
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
