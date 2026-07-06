import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { BunnyApiError, getBunnyVideoDetails } from '@/lib/bunny'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ guid: string }> }
) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const { guid } = await params

  let data: Record<string, unknown>
  try {
    data = await getBunnyVideoDetails(guid)
  } catch (error) {
    if (error instanceof BunnyApiError) {
      return NextResponse.json({ error: error.body }, { status: error.status })
    }

    if (error instanceof Error && error.message.startsWith('Missing BUNNY_')) {
      return NextResponse.json({ error: 'Missing Bunny env' }, { status: 500 })
    }

    throw error
  }

  const status = typeof data.status === 'number' ? data.status : 0
  const encodeProgress =
    typeof data.encodeProgress === 'number' ? data.encodeProgress : 0
  const transcodingFailed = data.transcodingFailed === true

  return NextResponse.json({
    status,
    encodeProgress,
    transcodingFailed,
  })
}
