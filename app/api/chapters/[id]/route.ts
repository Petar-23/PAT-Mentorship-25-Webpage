import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { deleteVideo } from '@/lib/bunny'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { name } = await request.json()

  try {
    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { name },
    })
    return NextResponse.json(updatedChapter)
  } catch (error) {
    console.error('Chapter update error:', error)
    return NextResponse.json({ error: 'Konnte Kapitel nicht umbenennen' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: { videos: true },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Kapitel nicht gefunden' }, { status: 404 })
    }

    // Bunny Videos löschen (nicht fatal wenn fehlschlägt)
    for (const video of chapter.videos) {
      if (video.bunnyGuid) {
        try {
          await deleteVideo(video.bunnyGuid)
        } catch (error) {
          console.error(`Bunny Video ${video.bunnyGuid} löschen fehlgeschlagen:`, error)
        }
      }
    }

    // DB löschen (Cascade löscht Videos)
    await prisma.chapter.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chapter löschen Fehler:', error)
    return NextResponse.json({ error: 'Konnte Kapitel nicht löschen' }, { status: 500 })
  }
}