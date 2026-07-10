// app/api/videos/[id]/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { deleteVideo } from '@/lib/bunny'
import { toProtectedPdfUrl } from '@/lib/protected-pdf'

// PATCH – Titel, PDF, bunnyGuid updaten (dein bestehender Code, leicht angepasst)
export async function PATCH(request: Request,{ params }: { params: Promise<{ id: string }> }) {

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const { id } = await params
  const body = await request.json()

  const updateData: { title?: string; pdfUrl?: string | null; bunnyGuid?: string | null } = {}

  if ('title' in body && typeof body.title === 'string') {
    updateData.title = body.title.trim() || undefined
  }

  if ('pdfUrl' in body) {
    if (body.pdfUrl !== '' && body.pdfUrl != null) {
      return NextResponse.json(
        { error: 'PDFs müssen über den geschützten Upload-Endpunkt hochgeladen werden' },
        { status: 400 }
      )
    }
    updateData.pdfUrl = null
  }

  if ('bunnyGuid' in body) {
    updateData.bunnyGuid = body.bunnyGuid || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Daten zum Updaten' }, { status: 400 })
  }

  try {
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        bunnyGuid: true,
        thumbnailUrl: true,
        pdfUrl: true,
        duration: true,
        order: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      ...updatedVideo,
      pdfUrl: toProtectedPdfUrl(updatedVideo.id, updatedVideo.pdfUrl),
    })
  } catch (error) {
    console.error('Video update error:', error)
    return NextResponse.json({ error: 'Konnte Video nicht updaten' }, { status: 500 })
  }
}

// DELETE – Video aus DB + Bunny.net löschen
export async function DELETE(_request: Request,{ params }: { params: Promise<{ id: string }> }) {

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const { id } = await params

  try {
    // 1. Video holen, um bunnyGuid zu bekommen
    const video = await prisma.video.findUnique({
      where: { id },
      select: { bunnyGuid: true },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video nicht gefunden' }, { status: 404 })
    }

    // 2. Bei Bunny.net löschen – fehlertolerant!
    if (video.bunnyGuid) {
      try {
        await deleteVideo(video.bunnyGuid)
        console.log(`Bunny Video gelöscht oder bereits entfernt: ${video.bunnyGuid}`)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Fehler beim Löschen bei Bunny:', message)
        // Kein Abbruch – DB-Löschung geht weiter
      }
    }

    // 3. Aus Prisma-DB löschen
    await prisma.video.delete({
      where: { id },
      select: { id: true },
    })

    return NextResponse.json({ success: true, message: 'Video erfolgreich gelöscht' })
  } catch (error) {
    console.error('Fehler beim Löschen des Videos:', error)
    return NextResponse.json({ error: 'Interner Serverfehler beim Löschen' }, { status: 500 })
  }
}
