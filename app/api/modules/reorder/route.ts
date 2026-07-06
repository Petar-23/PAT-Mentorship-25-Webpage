import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'

export async function POST(request: Request) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const body = await request.json()
  const { moduleIds, playlistId } = body

  if (!moduleIds || !Array.isArray(moduleIds) || !playlistId) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  try {
    await prisma.$transaction(
      moduleIds.map((id: string, index: number) =>
        prisma.module.update({
          where: { id },
          data: { order: index },
          select: { id: true },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reorder Fehler:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Reihenfolge' }, { status: 500 })
  }
}
