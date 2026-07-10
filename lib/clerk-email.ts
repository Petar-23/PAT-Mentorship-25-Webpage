export type VerifiedEmailAddress = string & {
  readonly __verifiedEmailAddress: unique symbol
}

type ClerkEmailLike = {
  id?: string | null
  emailAddress?: string | null
  verification?: { status?: string | null } | null
}

type ClerkUserEmailLike = {
  primaryEmailAddressId?: string | null
  primaryEmailAddress?: ClerkEmailLike | null
  emailAddresses?: readonly ClerkEmailLike[] | null
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase()
}

export function getVerifiedPrimaryEmail(
  user: ClerkUserEmailLike | null | undefined
): VerifiedEmailAddress | null {
  const primaryId = user?.primaryEmailAddressId
  if (!primaryId) return null

  const primaryFromList = user?.emailAddresses?.find((email) => email.id === primaryId)
  const primaryFromField =
    user?.primaryEmailAddress?.id === primaryId ? user.primaryEmailAddress : null
  const primary = primaryFromList ?? primaryFromField
  const email = primary?.emailAddress?.trim()

  if (!email || primary?.verification?.status !== 'verified') return null

  return email as VerifiedEmailAddress
}

export function emailsMatch(left: string, right: string) {
  return normalizeEmailAddress(left) === normalizeEmailAddress(right)
}

export function parseNormalizedEmailCsv(value: string | undefined) {
  if (!value) return new Set<string>()

  return new Set(
    value
      .split(',')
      .map(normalizeEmailAddress)
      .filter((email) => email.length > 0)
  )
}
