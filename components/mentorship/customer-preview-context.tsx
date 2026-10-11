'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { CustomerPreviewIdentity } from '@/lib/customer-preview-policy'

const CustomerPreviewContext = createContext<CustomerPreviewIdentity | null>(null)
export const useCustomerPreview = () => useContext(CustomerPreviewContext)

export function CustomerPreviewProvider({ customer, children }: {
  customer: CustomerPreviewIdentity
  children: ReactNode
}) {
  return <CustomerPreviewContext.Provider value={customer}>{children}</CustomerPreviewContext.Provider>
}
