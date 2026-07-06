import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'

export async function POST(request: Request) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
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
          select: { id: true },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Kapitel Reorder Fehler:', error)
    return NextResponse.json({ error: 'Reihenfolge konnte nicht gespeichert werden' }, { status: 500 })
  }
}
