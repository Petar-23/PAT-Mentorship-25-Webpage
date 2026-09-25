// Billing-Portal für PAT Research (eigener USD-Customer, eigene Portal-Konfiguration).
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { consumeResearchRateLimit } from '@/lib/research/rate-limit'
import { researchBasePathFromRequest, researchOriginFromRequest } from '@/lib/research/request-context'
import { isSameOriginRequest, jsonError } from '@/lib/research/request-guards'
import {
  createResearchPortalSession,
  describeResearchErrorForLog,
  isResearchStripeError,
} from '@/lib/research/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PORTAL_RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxAttempts: 20 }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, 'bad_origin', 'This request is not allowed from this origin.')
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return jsonError(401, 'signed_out', 'Please sign in again.')
    }

    const limit = await consumeResearchRateLimit({ key: `portal:${userId}`, ...PORTAL_RATE_LIMIT })
    if (limit.limited) {
      return jsonError(429, 'rate_limited', 'Too many attempts. Please try again later.', {
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      })
    }

    const origin = researchOriginFromRequest(request)
    const basePath = researchBasePathFromRequest(request)
    const { url } = await createResearchPortalSession({ userId, returnUrl: `${origin}${basePath}/account` })

    return NextResponse.json({ url })
  } catch (error) {
    if (isResearchStripeError(error, 'no_customer')) {
      return jsonError(404, 'no_customer', 'No PAT Research subscription found for this account yet.')
    }
    console.error('[research] portal failed', describeResearchErrorForLog(error))
    return jsonError(500, 'portal_failed', 'Could not open the billing portal. Please try again.')
  }
}
