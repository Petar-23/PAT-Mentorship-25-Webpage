// src/lib/updateCustomers.ts

import { stripe } from './stripe'

/**
 * Updates a single customer with tax information and invoice settings.
 * Returns true if the update was successful and verified.
 */
export async function ensureCustomerTaxInfo(customerId: string) {
  try {
    // Update the customer and store the returned customer object
    const updatedCustomer = await stripe.customers.update(customerId, {
      metadata: {
        tax_info_configured: 'true',
        last_updated: new Date().toISOString()
      },
      invoice_settings: {
        custom_fields: [
          {
            name: 'Steuer-ID',
            value: '******6789'
          }
        ],
        footer: `Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen, da Kleinunternehmer im Sinne des UStG.

Price Action Trader
Erlenweg 16
21423 Winsen
Deutschland
kontakt@price-action-trader.de

Steueridentifizierungsnummer: ******6789`
      }
    })
    
    // Verify the update was successful by checking the returned data
    const isConfigured = updatedCustomer.metadata.tax_info_configured === 'true' &&
                        updatedCustomer.invoice_settings.custom_fields?.some(
                          field => field.name === 'Steuer-ID'
                        )

    if (isConfigured) {
      console.log(`Successfully updated customer ${customerId} with tax information`)
      return true
    } else {
      console.warn(`Update may have failed for customer ${customerId} - tax information not verified`)
      return false
    }
    
  } catch (error) {
    console.error('Error updating customer tax info:', error)
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