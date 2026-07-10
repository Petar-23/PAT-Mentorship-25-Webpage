export const PLATFORM_ADMIN_ROLE = 'org:admin'

type AdminContext = {
  orgId?: unknown
  orgRole?: unknown
}

function asNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function getConfiguredAdminOrganizationId(value: string | undefined) {
  return asNonEmptyString(value)
}

export function isPlatformAdminContext(
  context: AdminContext,
  configuredOrganizationId: string | null
) {
  if (!configuredOrganizationId) return false

  return (
    asNonEmptyString(context.orgRole) === PLATFORM_ADMIN_ROLE &&
    asNonEmptyString(context.orgId) === configuredOrganizationId
  )
}

export function hasPlatformAdminSessionClaim(
  sessionClaims: unknown,
  configuredOrganizationId: string | null
) {
  if (!sessionClaims || typeof sessionClaims !== 'object') return false

  const claims = sessionClaims as Record<string, unknown>
  return (
    isPlatformAdminContext(
      { orgId: claims.org_id, orgRole: claims.org_role },
      configuredOrganizationId
    ) ||
    isPlatformAdminContext(
      { orgId: claims.orgId, orgRole: claims.orgRole },
      configuredOrganizationId
    )
  )
}
