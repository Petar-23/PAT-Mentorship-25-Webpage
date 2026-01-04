import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server' // Dein Auth!
import { createVideo, generateTusSignature } from '@/lib/bunny'

export async function POST(req: NextRequest) {
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

  try {
    const { title, description } = await req.json()
    const { guid } = await createVideo(title, description || '')
    const { signature, expire } = await generateTusSignature(guid, 60)
    return NextResponse.json({
      guid,
      signature,
      expire,
      libraryId: process.env.BUNNY_LIBRARY_ID!
    })
  } catch (error: unknown) {
    console.error('Video create failed:', error)
    return NextResponse.json({ error: 'Server Error' }, { status: 500 })
  }
}