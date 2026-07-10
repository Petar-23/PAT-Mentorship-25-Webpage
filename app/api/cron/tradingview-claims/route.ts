import { NextRequest, NextResponse } from 'next/server'
import { processEntitlementRevocationQueue } from '@/lib/entitlement-revocations'
import { processTradingViewClaimQueue } from '@/lib/indicators/store'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const expiredRateLimits = await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  const revocations = await processEntitlementRevocationQueue({
    limit: 25,
    workerId: 'vercel-cron-hourly-revocations',
  })
  const result = await processTradingViewClaimQueue({
    limit: 25,
    workerId: 'vercel-cron-hourly',
  })

  console.log('[tradingview-claims] Cron result:', {
    claims: result,
    revocations,
    expiredRateLimitsPruned: expiredRateLimits.count,
  })
  return NextResponse.json({
    ...result,
    revocations,
    expiredRateLimitsPruned: expiredRateLimits.count,
  })
}
