import { requireAdminApiAccess } from '@/lib/authz'
import { getOwnerMetrics } from '@/lib/owner-metrics'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const url = new URL(req.url)
    const metrics = await getOwnerMetrics({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })
    const res = NextResponse.json(metrics)
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (error) {
    console.error('Error in owner/metrics route:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('Invalid ') ? 400 : 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
