import { NextResponse } from 'next/server'

// Cache the response for 5 minutes
export const revalidate = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NormalizedWhopReview = {
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

function normalizeReview(item: any): NormalizedWhopReview | null {
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

export async function GET(request: Request) {
  try {
    const apiKey = process.env.WHOP_API_KEY
    const productId = process.env.WHOP_PRODUCT_ID || null
    const offerId = process.env.WHOP_OFFER_ID || null
    const storeId = process.env.WHOP_STORE_ID || null

    if (!apiKey) {
      return NextResponse.json({ error: 'Whop API ist nicht konfiguriert (WHOP_API_KEY fehlt).' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'
    const rawLimit = searchParams.get('limit') || searchParams.get('max')
    const limit = Math.min(Math.max(Number.parseInt(rawLimit ?? '200', 10) || 200, 1), 200)
    const rawPer = searchParams.get('per')
    const per = Math.min(Math.max(Number.parseInt(rawPer ?? '50', 10) || 50, 1), 50)
    const maxPages = 20

    const candidateEndpoints = [
      'https://api.whop.com/api/v2/reviews',
      'https://api.whop.com/api/v5/reviews',
    ]

    let lastError: { status?: number; message: string; body?: string } | null = null

    for (const endpoint of candidateEndpoints) {
      const collected: NormalizedWhopReview[] = []
      const seen = new Set<string>()
      let page = 1

      for (; page <= maxPages && collected.length < limit; page++) {
        const url = new URL(endpoint)
        if (productId) url.searchParams.set('product_id', productId)
        if (offerId) url.searchParams.set('offer_id', offerId)
        if (storeId) url.searchParams.set('store_id', storeId)

        // Whop list endpoints typically paginate via `page` + `per` (max 50).
        url.searchParams.set('page', String(page))
        url.searchParams.set('per', String(per))

        // Some versions may also accept `limit` – keep it in sync.
        url.searchParams.set('limit', String(per))

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          next: { revalidate },
        })

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          lastError = { status: res.status, message: `Whop API Fehler (${res.status})`, body }
          break
        }

        const json = await res.json()

        const items: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray((json as any)?.data)
            ? (json as any).data
            : Array.isArray((json as any)?.reviews)
              ? (json as any).reviews
              : []

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

        // Heuristic: if less than page size, it's the last page
        if (items.length < per) break
      }

      if (collected.length === 0) {
        continue
      }

      if (debug) {
        console.log(`[whop/reviews] endpoint=${endpoint}`)
        console.log(`[whop/reviews] fetched=${collected.length} per=${per} pages=${Math.max(1, page - 1)}`)
        console.log(
          `[whop/reviews] product_id=${productId ?? '—'} offer_id=${offerId ?? '—'} store_id=${storeId ?? '—'}`
        )
        console.log(`[whop/reviews] printing reviews: author | rating | text`)
        for (const r of collected) {
          const text = [r.title, r.body].filter(Boolean).join(' — ')
          console.log(`${r.author} | ${r.rating ?? '—'} | ${text}`)
        }
      }

      const response = NextResponse.json({
        source: 'whop',
        count: collected.length,
        reviews: collected,
      })

      // CDN caching (Vercel etc.)
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
      return response
    }

    return NextResponse.json(
      {
        error: 'Whop Reviews konnten nicht geladen werden.',
        details: lastError,
      },
      { status: 502 }
    )
  } catch (error: unknown) {
    console.error('Error fetching Whop reviews:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}


