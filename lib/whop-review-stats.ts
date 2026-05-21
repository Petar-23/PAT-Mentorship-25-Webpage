export type WhopReviewStats = {
  count: number
  average: number
}

export type WhopReview = {
  id: string
  rating: number | null
  title: string | null
  body: string
  author: string
  createdAt: string | null
  source: 'whop'
}

export type WhopReviewData = WhopReviewStats & {
  reviews: WhopReview[]
}

const WHOP_REVIEW_STATS_TTL_MS = 5 * 60 * 1000
const WHOP_REVIEW_ERROR_TTL_MS = 30 * 1000
const WHOP_REVIEW_REQUEST_TIMEOUT_MS = 8_000

let cachedReviews:
  | {
      expiresAt: number
      promise: Promise<WhopReviewData | null>
    }
  | null = null

let cachedStats:
  | {
      expiresAt: number
      promise: Promise<WhopReviewStats | null>
    }
  | null = null

function calculateAverage(reviews: WhopReview[]) {
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

async function fetchWhopJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WHOP_REVIEW_REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function getWhopReviews(): Promise<WhopReviewData | null> {
  const now = Date.now()
  if (cachedReviews && cachedReviews.expiresAt > now) {
    return cachedReviews.promise
  }

  const promise = fetchWhopJson<{
    count?: unknown
    average?: unknown
    reviews?: WhopReview[]
  }>('/api/whop/reviews?limit=200&per=50')
    .then((data) => {
      if (!data) return null

      const reviews = Array.isArray(data.reviews) ? data.reviews : []
      const average = typeof data.average === 'number' ? data.average : calculateAverage(reviews)

      return {
        count: typeof data.count === 'number' ? data.count : reviews.length,
        average,
        reviews,
      }
    })
    .catch(() => null)

  cachedReviews = {
    expiresAt: now + WHOP_REVIEW_STATS_TTL_MS,
    promise,
  }

  void promise.then((data) => {
    if (data || cachedReviews?.promise !== promise) return
    cachedReviews.expiresAt = Date.now() + WHOP_REVIEW_ERROR_TTL_MS
  })

  return promise
}

export async function getWhopReviewStats(): Promise<WhopReviewStats | null> {
  const now = Date.now()
  if (cachedReviews && cachedReviews.expiresAt > now) {
    const data = await cachedReviews.promise
    return data ? { count: data.count, average: data.average } : null
  }
  if (cachedStats && cachedStats.expiresAt > now) {
    return cachedStats.promise
  }

  const promise = fetchWhopJson<{
    count?: unknown
    average?: unknown
  }>('/api/whop/reviews?limit=200&per=50&summary=1')
    .then((data) => {
      if (!data) return null

      const count = typeof data.count === 'number' ? data.count : null
      if (count == null) return null

      return {
        count,
        average: typeof data.average === 'number' ? data.average : 5,
      }
    })
    .catch(() => null)

  cachedStats = {
    expiresAt: now + WHOP_REVIEW_STATS_TTL_MS,
    promise,
  }

  void promise.then((data) => {
    if (data || cachedStats?.promise !== promise) return
    cachedStats.expiresAt = Date.now() + WHOP_REVIEW_ERROR_TTL_MS
  })

  return promise
}
