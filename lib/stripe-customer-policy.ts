export type StripeCustomerOwnership = {
  id: string
  metadata?: Record<string, string> | null
}

export type UniqueEmailFallbackCustomer<T extends StripeCustomerOwnership> = {
  customer: T
  shouldLinkUserId: boolean
}

export function selectUniqueEmailFallbackCustomer<T extends StripeCustomerOwnership>(
  customers: readonly T[],
  userId: string
): UniqueEmailFallbackCustomer<T> | null {
  if (customers.length !== 1) return null

  const customer = customers[0]
  const ownerUserId = customer.metadata?.userId?.trim() || null
  if (ownerUserId && ownerUserId !== userId) return null

  return {
    customer,
    shouldLinkUserId: ownerUserId === null,
  }
}
