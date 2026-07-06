import 'server-only'

function getClaimString(sessionClaims: unknown, keys: string[]) {
  if (!sessionClaims || typeof sessionClaims !== 'object') return null

  const claims = sessionClaims as Record<string, unknown>
  for (const key of keys) {
    const value = claims[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

export function getEmailFromSessionClaims(sessionClaims: unknown) {
  return getClaimString(sessionClaims, [
    'email',
    'primary_email',
    'primaryEmail',
    'primary_email_address',
    'primaryEmailAddress',
  ])
}

export function getFirstNameFromSessionClaims(sessionClaims: unknown) {
  const direct = getClaimString(sessionClaims, ['first_name', 'firstName', 'given_name', 'givenName'])
  if (direct) return direct

  const fullName = getClaimString(sessionClaims, ['name', 'fullName'])
  return fullName?.split(/\s+/)[0] ?? null
}
