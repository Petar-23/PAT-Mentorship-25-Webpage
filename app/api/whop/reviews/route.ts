import { NextResponse } from 'next/server'
import { averageRating, fetchWhopReviews, getWhopApiConfig } from '@/lib/whop-reviews-server'

// Cache the response for 5 minutes
export const revalidate = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { apiKey, productId, offerId, storeId } = getWhopApiConfig()

    if (!apiKey) {
      return NextResponse.json({ error: 'Whop API ist nicht konfiguriert (WHOP_API_KEY fehlt).' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'
    const summaryOnly =
      searchParams.get('summary') === '1' || searchParams.get('summary') === 'true'
    const rawLimit = searchParams.get('limit') || searchParams.get('max')
    const limit = Math.min(Math.max(Number.parseInt(rawLimit ?? '200', 10) || 200, 1), 200)
    const rawPer = searchParams.get('per')
    const per = Math.min(Math.max(Number.parseInt(rawPer ?? '50', 10) || 50, 1), 50)

    const { best, lastError, tried: debugMeta } = await fetchWhopReviews({
      apiKey,
      productId,
      offerId,
      storeId,
      limit,
      per,
      revalidate,
    })

    if (!best || best.collected.length === 0) {
      return NextResponse.json(
        {
          error: 'Whop Reviews konnten nicht geladen werden.',
          details: lastError,
          ...(debug
            ? {
                meta: {
                  productId,
                  offerId,
                  storeId,
                  limit,
                  per,
                  tried: debugMeta,
                },
              }
            : {}),
        },
        { status: lastError?.status === 504 ? 504 : 502 }
      )
    }

    if (debug) {
      console.log(`[whop/reviews] chosen_endpoint=${best.endpoint}`)
      console.log(`[whop/reviews] fetched=${best.collected.length} per=${per} pages=${best.pagesFetched}`)
      console.log(
        `[whop/reviews] product_id=${productId ?? '—'} offer_id=${offerId ?? '—'} store_id=${storeId ?? '—'}`
      )
    }

    const average = averageRating(best.collected)

    const response = NextResponse.json({
      source: 'whop',
      count: best.collected.length,
      average,
      ...(summaryOnly ? {} : { reviews: best.collected }),
      ...(debug
        ? {
            meta: {
              chosenEndpoint: best.endpoint,
              pagesFetched: best.pagesFetched,
              productId,
              offerId,
              storeId,
              limit,
              per,
              tried: debugMeta,
            },
          }
        : {}),
    })

    // CDN caching (Vercel etc.)
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
    return response
  } catch (error: unknown) {
    console.error('Error fetching Whop reviews:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
