// app/api/playlists/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { revalidateSidebarData } from '@/lib/sidebar-data'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
}

export async function POST(request: Request) {

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const body = await request.json()
  const nameRaw = typeof body?.name === 'string' ? body.name : ''
  const name = nameRaw.trim()
  const slugRaw = typeof body?.slug === 'string' ? body.slug : ''
  const slug = slugRaw.trim() || slugify(name)
  const descriptionRaw = typeof body?.description === 'string' ? body.description : null
  const description = descriptionRaw && descriptionRaw.trim().length > 0 ? descriptionRaw.trim() : null
  const iconUrlRaw = typeof body?.iconUrl === 'string' ? body.iconUrl : null
  const iconUrl = iconUrlRaw && iconUrlRaw.trim().length > 0 ? iconUrlRaw.trim() : null

  // Einfache Prüfung: Name und Slug müssen da sein
  if (!name) {
    return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
  }
  if (!slug) {
    return NextResponse.json({ error: 'Slug fehlt' }, { status: 400 })
  }

  // Playlist in DB anlegen
  try {
    const playlist = await prisma.playlist.create({
      data: {
        name,
        slug,
        description,
        iconUrl,
      },
      select: { id: true, name: true },
    })

    revalidateSidebarData()
    return NextResponse.json(playlist, { status: 201 })
  } catch (error: unknown) {
    // z.B. Unique-Constraint auf slug
    const message = error instanceof Error ? error.message : 'Playlist konnte nicht erstellt werden'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const playlists = await prisma.playlist.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(playlists)
}
