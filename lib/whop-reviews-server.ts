import 'server-only'

/**
 * Whop-Bewertungen serverseitig laden. Gemeinsame Grundlage für die API-Route /api/whop/reviews
 * und für Seiten, die die Zahl beim Rendern brauchen (Landingpage /lp-v3).
 */

export const WHOP_API_TIMEOUT_MS = 8_000

export type NormalizedWhopReview = {
  id: string
  rating: number | null
  title: string | null
  body: string
  author: string
  createdAt: string | null
  source: 'whop'
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asIsoString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  // Common pattern: unix seconds or ms timestamps
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

export function normalizeReview(item: any): NormalizedWhopReview | null {
  const id =
    asNonEmptyString(item?.id) ||
    asNonEmptyString(item?.review_id) ||
    asNonEmptyString(item?.reviewId) ||
    null

  const rating =
    asNumber(item?.rating) ??
    asNumber(item?.stars) ??
    asNumber(item?.star_rating) ??
    asNumber(item?.starRating) ??
    null

  const title =
    asNonEmptyString(item?.title) ||
    asNonEmptyString(item?.headline) ||
    asNonEmptyString(item?.summary) ||
    null

  const body =
    asNonEmptyString(item?.body) ||
    asNonEmptyString(item?.description) ||
    asNonEmptyString(item?.comment) ||
    asNonEmptyString(item?.content) ||
    asNonEmptyString(item?.text) ||
    asNonEmptyString(item?.review) ||
    asNonEmptyString(item?.review_text) ||
    asNonEmptyString(item?.reviewText) ||
    asNonEmptyString(item?.message) ||
    ''

  const userFirst =
    asNonEmptyString(item?.user?.first_name) ||
    asNonEmptyString(item?.user?.firstName) ||
    null
  const userLast =
    asNonEmptyString(item?.user?.last_name) ||
    asNonEmptyString(item?.user?.lastName) ||
    null
  const userNameFromParts = userFirst && userLast ? `${userFirst} ${userLast}` : userFirst || userLast || null

  const author =
    asNonEmptyString(item?.author?.name) ||
    asNonEmptyString(item?.author?.full_name) ||
    asNonEmptyString(item?.author?.fullName) ||
    asNonEmptyString(item?.user?.name) ||
    asNonEmptyString(item?.user?.full_name) ||
    asNonEmptyString(item?.user?.fullName) ||
    asNonEmptyString(item?.user?.display_name) ||
    asNonEmptyString(item?.user?.displayName) ||
    userNameFromParts ||
    asNonEmptyString(item?.reviewer?.name) ||
    asNonEmptyString(item?.reviewer?.full_name) ||
    asNonEmptyString(item?.reviewer?.fullName) ||
    asNonEmptyString(item?.reviewer?.display_name) ||
    asNonEmptyString(item?.reviewer?.displayName) ||
    asNonEmptyString(item?.member?.name) ||
    asNonEmptyString(item?.member?.display_name) ||
    asNonEmptyString(item?.member?.displayName) ||
    asNonEmptyString(item?.buyer?.name) ||
    asNonEmptyString(item?.buyer?.display_name) ||
    asNonEmptyString(item?.buyer?.displayName) ||
    asNonEmptyString(item?.customer?.name) ||
    asNonEmptyString(item?.name) ||
    asNonEmptyString(item?.username) ||
    asNonEmptyString(item?.user?.username) ||
    asNonEmptyString(item?.display_name) ||
    asNonEmptyString(item?.displayName) ||
    'Whop Kunde'

  const createdAt =
    asIsoString(item?.created_at) ||
    asIsoString(item?.createdAt) ||
    asIsoString(item?.created) ||
    null

  if (!id) return null

  return {
    id,
    rating,
    title,
    body,
    author,
    createdAt,
    source: 'whop',
  }
}

export type WhopFetchError = { status?: number; message: string; body?: string }
export type WhopEndpointMeta = { endpoint: string; count: number; pagesFetched: number; error?: string }

export type WhopReviewsFetchResult = {
  /** Bestes Ergebnis über alle Endpunkte, null wenn keiner Bewertungen geliefert hat. */
  best: { endpoint: string; collected: NormalizedWhopReview[]; pagesFetched: number } | null
  lastError: WhopFetchError | null
  tried: WhopEndpointMeta[]
  productId: string | null
  offerId: string | null
  storeId: string | null
}

/** Liest die Whop-Konfiguration aus der Umgebung. Ohne WHOP_API_KEY gibt es nichts zu laden. */
export function getWhopApiConfig() {
  return {
    apiKey: process.env.WHOP_API_KEY || null,
    productId: process.env.WHOP_PRODUCT_ID || null,
    offerId: process.env.WHOP_OFFER_ID || null,
    storeId: process.env.WHOP_STORE_ID || null,
  }
}

/**
 * Holt Bewertungen seitenweise von der Whop-API (v2), dedupliziert nach ID, höchstens `limit` Stück.
 * `revalidate` steuert den Daten-Cache von Next für die einzelnen Anfragen.
 */
export async function fetchWhopReviews({
  apiKey,
  productId,
  offerId,
  storeId,
  limit,
  per,
  revalidate,
}: {
  apiKey: string
  productId: string | null
  offerId: string | null
  storeId: string | null
  limit: number
  per: number
  revalidate: number
}): Promise<WhopReviewsFetchResult> {
  const maxPages = 20
  // Whop Reviews API: v2 is the stable endpoint. v5 returns 404 (siehe Debug).
  const candidateEndpoints = ['https://api.whop.com/api/v2/reviews']

  let lastError: WhopFetchError | null = null
  let best: { endpoint: string; collected: NormalizedWhopReview[]; pagesFetched: number } | null = null
  const debugMeta: WhopEndpointMeta[] = []

  for (const endpoint of candidateEndpoints) {
    const collected: NormalizedWhopReview[] = []
    const seen = new Set<string>()
    let page = 1
    let endpointError: string | null = null

    for (; page <= maxPages && collected.length < limit; page++) {
      const url = new URL(endpoint)
      // Wichtig: Whop zeigt auf der Store/Product-Page oft STORE-weite Review-Zahlen
      // (z.B. publishedReviewsCount), die Reviews stammen dann aus mehreren Access-Passes.
      // Wenn WHOP_STORE_ID gesetzt ist, holen wir daher STORE-weit und ignorieren Product/Offer Filter.
      if (storeId) {
        // API-Param-Namen variieren je nach Whop-Version – wir setzen mehrere Aliase.
        url.searchParams.set('store_id', storeId)
        url.searchParams.set('company_id', storeId)
        url.searchParams.set('business_id', storeId)
      } else if (offerId) {
        url.searchParams.set('offer_id', offerId)
      } else if (productId) {
        url.searchParams.set('product_id', productId)
      }

      // Whop list endpoints typically paginate via `page` + `per` (max 50).
      url.searchParams.set('page', String(page))
      url.searchParams.set('per', String(per))
      // Some APIs use `page_size` instead of `per`.
      url.searchParams.set('page_size', String(per))

      // Some versions may also accept `limit` – keep it in sync.
      url.searchParams.set('limit', String(per))

      let items: unknown[] = []
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), WHOP_API_TIMEOUT_MS)

      try {
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          next: { revalidate },
          signal: controller.signal,
        })

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          lastError = { status: res.status, message: `Whop API Fehler (${res.status})`, body }
          endpointError = `${lastError.message}: ${body || res.statusText}`.trim()
          break
        }

        const json = await res.json()

        items = Array.isArray(json)
          ? json
          : Array.isArray((json as any)?.data)
            ? (json as any).data
            : Array.isArray((json as any)?.reviews)
              ? (json as any).reviews
              : []
      } catch (error) {
        const message = isAbortError(error)
          ? `Whop API Timeout nach ${WHOP_API_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'Whop API Request fehlgeschlagen'
        lastError = {
          status: isAbortError(error) ? 504 : undefined,
          message,
        }
        endpointError = message
        break
      } finally {
        clearTimeout(timeout)
      }

      if (items.length === 0) break

      let added = 0
      for (const item of items) {
        const normalized = normalizeReview(item)
        if (!normalized) continue
        if (seen.has(normalized.id)) continue
        seen.add(normalized.id)
        collected.push(normalized)
        added++
        if (collected.length >= limit) break
      }

      // Stop if pagination doesn't move forward (safety against infinite loops)
      if (added === 0) break
    }

    const pagesFetched = Math.max(1, page - 1)
    debugMeta.push({
      endpoint,
      count: collected.length,
      pagesFetched,
      ...(endpointError ? { error: endpointError } : {}),
    })

    if (!best || collected.length > best.collected.length) {
      best = { endpoint, collected, pagesFetched }
    }
  }

  return { best, lastError, tried: debugMeta, productId, offerId, storeId }
}

export type WhopReviewSummary = { count: number; average: number }

/**
 * Anzahl und Durchschnitt der Whop-Bewertungen für serverseitiges Rendern (gleiche Zählweise wie die API-Route:
 * höchstens 200, nach ID dedupliziert). null, wenn Whop nicht konfiguriert oder nicht erreichbar ist.
 */
export async function getWhopReviewSummary({ revalidate }: { revalidate: number }): Promise<WhopReviewSummary | null> {
  try {
    const { apiKey, productId, offerId, storeId } = getWhopApiConfig()
    if (!apiKey) return null
    const { best } = await fetchWhopReviews({ apiKey, productId, offerId, storeId, limit: 200, per: 50, revalidate })
    if (!best || best.collected.length === 0) return null
    return { count: best.collected.length, average: averageRating(best.collected) }
  } catch {
    return null
  }
}

export function averageRating(reviews: NormalizedWhopReview[]) {
  const ratingValues = reviews
    .map((review) =>
      typeof review.rating === 'number' && Number.isFinite(review.rating)
        ? review.rating
        : null
    )
    .filter((rating): rating is number => rating != null)
  return ratingValues.length > 0
    ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length
    : 5
}
