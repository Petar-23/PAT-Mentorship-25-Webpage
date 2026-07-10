// app/api/chapters/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { toProtectedPdfUrl } from '@/lib/protected-pdf'

export async function POST(request: Request) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const body = await request.json()
  const { name = 'Neues Kapitel', moduleId } = body  // Standardname falls keiner gesendet

  if (!moduleId) {
    return NextResponse.json(
      { error: 'moduleId fehlt' },
      { status: 400 }
    )
  }

  try {
    // Höchsten order-Wert im Modul finden → neues Kapitel kommt ans Ende
    const maxOrderChapter = await prisma.chapter.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const newOrder = (maxOrderChapter?.order ?? 0) + 1

    const newChapter = await prisma.chapter.create({
      data: {
        name: name.trim(),
        moduleId,  // ← genau so muss es heißen (wie in deinem Prisma-Schema)
        order: newOrder,
      },
      select: {
        id: true,
        name: true,
        order: true,
        moduleId: true,
      },
    })

    return NextResponse.json(newChapter, { status: 201 })
  } catch (error) {
    console.error('Chapter create error:', error)
    return NextResponse.json(
      { error: 'Konnte Kapitel nicht anlegen – Modul nicht gefunden oder ungültig' },
      { status: 500 }
    )
  }
}

// GET bleibt unverändert – super wie es ist!
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const chapters = await prisma.chapter.findMany({
    select: {
      id: true,
      name: true,
      order: true,
      moduleId: true,
      createdAt: true,
      updatedAt: true,
      videos: {
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
        },
        orderBy: { order: 'asc' },
      },
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
          playlist: {
            select: { name: true, slug: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    chapters.map((chapter) => ({
      ...chapter,
      videos: chapter.videos.map((video) => ({
        ...video,
        pdfUrl: toProtectedPdfUrl(video.id, video.pdfUrl),
      })),
    }))
  )
}
