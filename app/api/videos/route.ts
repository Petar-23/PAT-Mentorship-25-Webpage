// app/api/videos/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasActiveSubscription } from '@/lib/stripe'
import { getIsAdmin, requireAdminApiAccess } from '@/lib/authz'

export async function POST(request: Request) {

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
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
      select: {
        id: true,
        title: true,
        bunnyGuid: true,
        thumbnailUrl: true,
        pdfUrl: true,
        duration: true,
        order: true,
        updatedAt: true,
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
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = (await hasActiveSubscription(userId)) || (await getIsAdmin(userId, sessionClaims))

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const videos = await prisma.video.findMany({
    select: {
      id: true,
      title: true,
      bunnyGuid: true,
      pdfUrl: true,
      thumbnailUrl: true,
      announcedAt: true,
      announcementMessageId: true,
      order: true,
      chapterId: true,
      createdAt: true,
      updatedAt: true,
      duration: true,
      chapter: {
        select: {
          id: true,
          name: true,
          order: true,
          moduleId: true,
          createdAt: true,
          updatedAt: true,
          module: {
            select: {
              id: true,
              name: true,
              order: true,
              playlistId: true,
              createdAt: true,
              updatedAt: true,
              description: true,
              imageUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(videos)
}
