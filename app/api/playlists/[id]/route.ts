import { prisma } from '@/lib/prisma'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { deleteVideo } from '@/lib/bunny'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const data: { name?: string; description?: string | null; iconUrl?: string | null } = {}

  if (typeof b.name === 'string') {
    const name = b.name.trim()
    if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
    data.name = name
  }

  if ('description' in b) {
    const v = b.description
    if (typeof v === 'string') {
      const t = v.trim()
      data.description = t.length > 0 ? t : null
    } else if (v === null) {
      data.description = null
    }
  }

  if ('iconUrl' in b) {
    const v = b.iconUrl
    if (typeof v === 'string') {
      const t = v.trim()
      data.iconUrl = t.length > 0 ? t : null
    } else if (v === null) {
      data.iconUrl = null
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 })
  }

  try {
    const playlist = await prisma.playlist.update({
      where: { id },
      data,
    })

    return NextResponse.json(playlist)
  } catch (error) {
    console.error('Playlist update error:', error)
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    // 1) Alle Bunny-Guids für diesen Kurs einsammeln
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            chapters: {
              include: {
                videos: { select: { bunnyGuid: true } },
              },
            },
          },
        },
      },
    })

    if (!playlist) {
      return NextResponse.json({ error: 'Kurs nicht gefunden' }, { status: 404 })
    }

    const bunnyGuids = playlist.modules
      .flatMap((m) => m.chapters.flatMap((c) => c.videos))
      .map((v) => v.bunnyGuid)
      .filter((guid): guid is string => Boolean(guid))

    // 2) Bunny-Videos löschen (fehlertolerant, wie bei euren Module/Kapitel Deletes)
    await Promise.allSettled(
      bunnyGuids.map(async (guid) => {
        try {
          await deleteVideo(guid)
        } catch (error) {
          console.error(`Bunny delete failed for ${guid}:`, error)
        }
      })
    )

    // 3) Kurs löschen (DB-Cascade löscht Module/Kapitel/Videos mit)
    await prisma.playlist.delete({ where: { id } })

    // 4) Sidebar-Order aufräumen (optional, aber sauber)
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'sidebarOrder' },
    })
    const order = setting?.value as unknown
    if (Array.isArray(order)) {
      const cleaned = order.filter((x) => x !== id)
      await prisma.adminSetting.update({
        where: { key: 'sidebarOrder' },
        data: { value: cleaned },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Playlist delete error:', error)
    return NextResponse.json({ error: 'Delete fehlgeschlagen' }, { status: 500 })
  }
}