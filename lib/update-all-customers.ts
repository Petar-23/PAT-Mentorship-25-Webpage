// src/scripts/update-all-customers.ts

import { updateAllCustomers } from '../lib/updateCustomers'

async function main() {
  try {
    await updateAllCustomers()
    console.log('Completed customer updates')
  } catch (error) {
    console.error('Failed to update customers:', error)
    process.exit(1)
  }
}

main()