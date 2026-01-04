// app/api/videos/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { hasActiveSubscription } from '@/lib/stripe'

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
  const { title, bunnyGuid, pdfUrl, chapterId } = body

  // Title und chapterId sind Pflicht
  if (!title || !chapterId) {
    return NextResponse.json(
      { error: 'Title und chapterId fehlen' },
      { status: 400 }
    )
  }

  try {
    // Höchsten order-Wert im Kapitel finden
    const maxOrder = await prisma.video.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const newOrder = (maxOrder?.order || 0) + 1

    const newVideo = await prisma.video.create({
      data: {
        title,
        bunnyGuid: bunnyGuid ?? null, 
        pdfUrl: pdfUrl ?? null,
        chapterId,
        order: newOrder,  // ← immer am Ende
      },
    })

    return NextResponse.json(newVideo, { status: 201 })
  }
   catch (error) {
    console.error('Video create error:', error)
    return NextResponse.json(
      { error: 'Konnte Video nicht anlegen – Chapter nicht gefunden oder ungültig' },
      { status: 400 }
    )
  }
}

// Optional: GET alle Videos (zum Testen) – kannst du behalten!
export async function GET() {
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
  const allowed = isAdmin || (await hasActiveSubscription(userId))

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const videos = await prisma.video.findMany({
    include: {
      chapter: {
        include: {
          module: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(videos)
}