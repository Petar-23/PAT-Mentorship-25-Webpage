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
  const { moduleIds, playlistId } = body

  if (!moduleIds || !Array.isArray(moduleIds) || !playlistId) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  try {
    const updates = moduleIds.map((id: string, index: number) =>
      prisma.module.update({
        where: { id },
        data: { order: index },
      })
    )

    await Promise.all(updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reorder Fehler:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Reihenfolge' }, { status: 500 })
  }
}