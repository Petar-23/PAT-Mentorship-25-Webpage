import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'

export async function POST(request: Request) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const body = await request.json()
  const { videoIds }: { videoIds: string[] } = body

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  try {
    await prisma.$transaction(
      videoIds.map((id, index) =>
        prisma.video.update({
          where: { id },
          data: { order: index },
          select: { id: true },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Video Reorder Error:', error)
    return NextResponse.json({ error: 'Reihenfolge konnte nicht gespeichert werden' }, { status: 500 })
  }
}
