// app/api/modules/route.ts

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
  const { name, description, imageUrl, playlistId } = body

  // Prüfen, ob die Pflichtfelder da sind
  if (!name || !playlistId) {
    return NextResponse.json(
      { error: 'Name und playlistId fehlen' },
      { status: 400 }
    )
  }

  try {
    // Alle Felder speichern – description und imageUrl sind optional (können null sein)
    const newModule = await prisma.module.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,  // Wenn leer → null speichern
        imageUrl: imageUrl || null,               // Wenn kein Bild → null
        playlistId,
        order: 0,                                 // Du kannst das später mit Reorder anpassen
      },
    })

    return NextResponse.json(newModule, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen des Moduls:', error)
    return NextResponse.json(
      { error: 'Konnte Modul nicht anlegen – Playlist nicht gefunden oder ungültig' },
      { status: 500 }
    )
  }
}

// GET bleibt genau gleich – super!
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

  const modules = await prisma.module.findMany({
    include: {
      playlist: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return NextResponse.json(modules)
}