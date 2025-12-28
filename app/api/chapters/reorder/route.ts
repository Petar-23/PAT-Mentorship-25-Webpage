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
  const { chapterIds } = body

  if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
    return NextResponse.json({ error: 'chapterIds Array fehlt oder ist leer' }, { status: 400 })
  }

  try {
    await prisma.$transaction(
      chapterIds.map((id: string, index: number) =>
        prisma.chapter.update({
          where: { id },
          data: { order: index + 1 },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Kapitel Reorder Fehler:', error)
    return NextResponse.json({ error: 'Reihenfolge konnte nicht gespeichert werden' }, { status: 500 })
  }
}