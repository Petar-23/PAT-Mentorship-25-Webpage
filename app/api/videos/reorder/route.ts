import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function POST(request: Request) {
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

  const body = await request.json()
  const { videoIds }: { videoIds: string[] } = body

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  try {
    await prisma.$transaction(
      videoIds.map((id, index) =>
        prisma.video.update({
          where: { id },
          data: { order: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Video Reorder Error:', error)
    return NextResponse.json({ error: 'Reihenfolge konnte nicht gespeichert werden' }, { status: 500 })
  }
}