import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID
const BUNNY_API_KEY = process.env.BUNNY_API_KEY

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ guid: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })
  const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
    return NextResponse.json({ error: 'Missing Bunny env' }, { status: 500 })
  }

  const { guid } = await params

  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`,
    {
      headers: { AccessKey: BUNNY_API_KEY },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    )
  }

  const json: unknown = await res.json()
  const data =
    typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}

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