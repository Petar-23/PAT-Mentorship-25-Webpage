// app/api/upload/pdf/route.ts

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import sanitizeFilename from 'sanitize-filename'
import { requireAdminApiAccess } from '@/lib/authz'

export const POST = async (request: Request) => {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const videoId = formData.get('videoId') as string

    if (!pdfFile || !videoId) {
      return NextResponse.json({ error: 'PDF oder Video-ID fehlt' }, { status: 400 })
    }

    if (pdfFile.type && pdfFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Nur PDF-Dateien sind erlaubt' }, { status: 400 })
    }

    if (pdfFile.size <= 0 || pdfFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF muss zwischen 1 Byte und 25 MB liegen' }, { status: 400 })
    }

    // Original-Dateinamen nehmen und sicher machen
    let originalName = pdfFile.name
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      originalName += '.pdf'
    }

    // Sichere den Dateinamen (entfernt ungültige Zeichen, Sonderzeichen, etc.)
    const safeFilename = sanitizeFilename(originalName) || 'document.pdf'

    // Eindeutigen, schwer erratbaren Pfad erstellen
    const blobPath = `pdfs/${videoId}/${randomUUID()}-${safeFilename}`

    // Hochladen mit Originalnamen
    const { url } = await put(blobPath, pdfFile, {
      access: 'public',
    })

    // In DB speichern
    await prisma.video.update({
      where: { id: videoId },
      data: { pdfUrl: url },
      select: { id: true },
    })

    return NextResponse.json({ pdfUrl: url })
  } catch (error) {
    console.error('PDF Upload Fehler:', error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }
}
