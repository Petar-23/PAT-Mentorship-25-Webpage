// app/api/chapters/route.ts

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

  const chapters = await prisma.chapter.findMany({
    include: {
      videos: {
        orderBy: { order: 'asc' },
      },
      module: {
        include: {
          playlist: {
            select: { name: true, slug: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(chapters)
}