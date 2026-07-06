import { NextRequest, NextResponse } from 'next/server'
import { processTradingViewClaimQueue } from '@/lib/indicators/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await processTradingViewClaimQueue({
    limit: 25,
    workerId: 'vercel-cron-hourly',
  })

  console.log('[tradingview-claims] Cron result:', result)
  return NextResponse.json(result)
}
