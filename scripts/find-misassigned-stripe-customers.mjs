#!/usr/bin/env node
/**
 * READ-ONLY Report: Stripe-Customers, die sowohl metadata.userId (Mentorship) als auch einen
 * produktbezogenen Key (raidmapUserId / researchUserId) tragen. Solche Customers sind vermutlich
 * über einen alten Mentorship-Email-Fallback falsch verknüpft worden.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/find-misassigned-stripe-customers.mjs
 *
 * - Liest nur (customers.list), schreibt NIE etwas. Ein Restricted Key mit "Customers: Read" reicht.
 * - Gibt nur Customer-IDs und Key-Namen aus (keine E-Mails, keine Metadata-Werte).
 * - Korrekturen bitte manuell nach Prüfung im Stripe-Dashboard.
 */
import { pathToFileURL } from 'node:url'
import Stripe from 'stripe'
import { PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS, isProductScopedCustomer } from '../lib/stripe-customer-scope.mjs'

export function findMisassignedCustomers(customers) {
  return customers
    .filter((c) => !c.deleted && typeof c.metadata?.userId === 'string' && c.metadata.userId.length > 0)
    .filter((c) => isProductScopedCustomer(c))
    .map((c) => {
      const productKeys = PRODUCT_SCOPED_CUSTOMER_METADATA_KEYS.filter((key) => c.metadata[key])
      return {
        id: c.id,
        keys: ['userId', ...productKeys],
        sameUser: productKeys.every((key) => c.metadata[key] === c.metadata.userId),
      }
    })
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
    console.log(`${f.id}  keys=${f.keys.join(',')}  sameUser=${f.sameUser ? 'yes' : 'no'}`)
  }
  console.log(`${findings.length} verdächtige von ${customers.length} Customers (nichts verändert).`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
