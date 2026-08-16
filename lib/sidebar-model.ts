export const SIDEBAR_STATIC_IDS = {
  discord: 'discord',
  indicators: 'indicators',
} as const

export type SidebarStaticId = (typeof SIDEBAR_STATIC_IDS)[keyof typeof SIDEBAR_STATIC_IDS]

export type SidebarStaticIdentity = {
  kind: 'static'
  id: SidebarStaticId
}

export type SidebarCourseIdentity = {
  kind: 'course'
  id: string
  resourceId: string
}

export type SidebarPageIdentity = {
  kind: 'page'
  id: `page:${string}`
  resourceId: string
}

export type SidebarItemIdentity =
  | SidebarStaticIdentity
  | SidebarCourseIdentity
  | SidebarPageIdentity

export function buildStaticSidebarIdentity(id: SidebarStaticId): SidebarStaticIdentity {
  return { kind: 'static', id }
}

export function buildCourseSidebarIdentity(courseId: string): SidebarCourseIdentity {
  return { kind: 'course', id: courseId, resourceId: courseId }
}

export function buildPageSidebarIdentity(pageId: string): SidebarPageIdentity {
  return { kind: 'page', id: `page:${pageId}`, resourceId: pageId }
}

function indexSidebarIdentities(identities: readonly SidebarItemIdentity[]) {
  const identitiesById = new Map<string, SidebarItemIdentity | null>()

  for (const identity of identities) {
    identitiesById.set(identity.id, identitiesById.has(identity.id) ? null : identity)
  }

  return identitiesById
}

function parseIndexedSidebarKey(
  key: unknown,
  identitiesById: ReadonlyMap<string, SidebarItemIdentity | null>
) {
  if (typeof key !== 'string') return null
  return identitiesById.get(key) ?? null
}

export function parseSidebarKey(
  key: unknown,
  identities: readonly SidebarItemIdentity[]
): SidebarItemIdentity | null {
  return parseIndexedSidebarKey(key, indexSidebarIdentities(identities))
}

export function parseSidebarOrder(
  value: unknown,
  identities: readonly SidebarItemIdentity[]
): string[] | null {
  if (!Array.isArray(value)) return null

  const identitiesById = indexSidebarIdentities(identities)
  const parsed: string[] = []
  const seen = new Set<string>()

  for (const key of value) {
    const identity = parseIndexedSidebarKey(key, identitiesById)
    if (!identity || seen.has(identity.id)) continue
    seen.add(identity.id)
    parsed.push(identity.id)
  }

  return parsed
}

export function orderSidebarItems<T extends SidebarItemIdentity>(
  items: readonly T[],
  savedOrder: readonly string[] | null | undefined
): T[] {
  if (!savedOrder) return [...items]

  const parsedOrder = parseSidebarOrder(savedOrder, items) ?? []
  const orderById = new Map(parsedOrder.map((id, index) => [id, index]))

  return [...items].sort((a, b) => {
    const positionA = orderById.get(a.id) ?? items.length
    const positionB = orderById.get(b.id) ?? items.length
    return positionA - positionB
  })
}

type ActiveSidebarOptions = {
  pathname: string | null | undefined
  activeCourseId?: string | null
  courses: readonly { id: string }[]
  pages: readonly { id: string; slug: string }[]
}

export function resolveActiveSidebarId({
  pathname,
  activeCourseId,
  courses,
  pages,
}: ActiveSidebarOptions): string | null {
  if (pathname?.startsWith('/mentorship/discord')) {
    return buildStaticSidebarIdentity(SIDEBAR_STATIC_IDS.discord).id
  }
  if (pathname?.startsWith('/mentorship/indicators')) {
    return buildStaticSidebarIdentity(SIDEBAR_STATIC_IDS.indicators).id
  }

  if (activeCourseId && courses.some((course) => course.id === activeCourseId)) {
    return buildCourseSidebarIdentity(activeCourseId).id
  }

  const pageMatch = pathname?.match(/^\/mentorship\/page\/([^/]+)$/)
  if (pageMatch) {
    const page = pages.find((candidate) => candidate.slug === pageMatch[1])
    return page ? buildPageSidebarIdentity(page.id).id : null
  }

  const courseMatch = pathname?.match(/^\/mentorship\/([^/]+)$/)
  const course = courses.find((candidate) => candidate.id === courseMatch?.[1])
  return course ? buildCourseSidebarIdentity(course.id).id : null
}
