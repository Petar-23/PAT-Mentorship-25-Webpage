// Shared, credential-free policy. The real session always remains the admin's.
export type CustomerPreviewIdentity = {
  id: string
  name: string
  firstName: string | null
  email: string | null
}

export function isPlatformPreviewAdmin(
  memberships: ReadonlyArray<{ role: string; organization: { id: string } }>,
  organizationId: string | undefined,
) {
  const configuredId = organizationId?.trim()
  return Boolean(configuredId && memberships.some(
    membership => membership.organization.id === configuredId && membership.role === 'org:admin',
  ))
}

export function customerPreviewBase(userId: string) {
  return `/owner/customer-preview/${encodeURIComponent(userId)}`
}

// Only curriculum routes exist in preview. Never lead into the actor's billing/account flows.
export function customerPreviewHref(href: string, userId: string): string | null {
  // Shownotes may contain absolute links to the PAT site.
  if (/^https?:\/\//.test(href)) {
    try {
      const url = new URL(href)
      if (url.protocol !== 'https:' || !['www.price-action-trader.de', 'price-action-trader.de'].includes(url.host)) return null
      href = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return null
    }
  }
  const [pathname] = href.split(/[?#]/)
  const uuid = '[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}'
  const isCurriculum = pathname === '/mentorship' ||
    new RegExp(`^/mentorship/(?:modul/)?${uuid}$`).test(pathname)
  return isCurriculum ? `${customerPreviewBase(userId)}${href.slice('/mentorship'.length)}` : null
}

export function customerPreviewPathname(pathname: string, userId: string) {
  const base = customerPreviewBase(userId)
  return pathname === base || pathname.startsWith(`${base}/`)
    ? `/mentorship${pathname.slice(base.length)}` : pathname
}
