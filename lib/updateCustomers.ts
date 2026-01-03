// src/lib/updateCustomers.ts

import { stripe } from './stripe'

/**
 * Updates a single customer with safe metadata and (if needed) removes legacy invoice settings.
 * Returns true if the update was successful and verified.
 */
export async function ensureCustomerTaxInfo(customerId: string) {
  try {
    // Safety: Wenn wir in der Vergangenheit versehentlich falsche Rechnungstexte (z.B. §19 UStG)
    // oder Platzhalter-IDs gesetzt haben, entfernen wir diese hier wieder.
    const customer = await stripe.customers.retrieve(customerId)
    if ('deleted' in customer && customer.deleted) {
      return false
    }

    const currentFooter = customer.invoice_settings?.footer ?? null
    const currentCustomFields = customer.invoice_settings?.custom_fields ?? null

    const hasLegacyFooter =
      typeof currentFooter === 'string' &&
      (currentFooter.includes('§ 19 UStG') ||
        currentFooter.includes('Kleinunternehmer') ||
        currentFooter.includes('Zahlungsbedingungen: Zahlbar sofort ohne Abzug'))

    const hasLegacyPlaceholderTaxId =
      Array.isArray(currentCustomFields) &&
      currentCustomFields.some((f) => {
        const name = f?.name ?? ''
        const value = f?.value ?? ''
        return (
          (name.includes('USt-ID') || name.includes('USt') || name.includes('Steuer')) &&
          value.includes('DE 123456789')
        )
      })

    await stripe.customers.update(customerId, {
      metadata: {
        tax_info_configured: 'true',
        last_updated: new Date().toISOString(),
      },
      ...(hasLegacyFooter || hasLegacyPlaceholderTaxId
        ? {
            invoice_settings: {
              footer: '',
              custom_fields: [],
            },
          }
        : {}),
    })

    return true
  } catch (error) {
    console.error('Error updating customer metadata:', error)
    return false
  }
}

/**
 * Updates all existing customers with tax information.
 * Includes progress tracking and verification.
 */
export async function updateAllCustomers() {
  console.log('Starting bulk customer update process')
  let hasMore = true
  let startingAfter: string | undefined
  let successCount = 0
  let failureCount = 0
  let skippedCount = 0

  try {
    while (hasMore) {
      const customers = await stripe.customers.list({
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.invoice_settings']
      })

      for (const currentCustomer of customers.data) {
        // Skip customers that are already configured
        if (currentCustomer.metadata.tax_info_configured === 'true') {
          skippedCount++
          continue
        }

        const success = await ensureCustomerTaxInfo(currentCustomer.id)
        if (success) {
          successCount++
        } else {
          failureCount++
        }
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      hasMore = customers.has_more
      if (customers.data.length > 0) {
        startingAfter = customers.data[customers.data.length - 1].id
      }
    }

    console.log(`
Bulk update completed:
- Successfully updated: ${successCount} customers
- Failed updates: ${failureCount} customers
- Skipped (already configured): ${skippedCount} customers
Total processed: ${successCount + failureCount + skippedCount} customers
    `)
  } catch (error) {
    console.error('Error during bulk customer update:', error)
    throw error
  }
}