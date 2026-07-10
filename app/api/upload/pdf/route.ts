// app/api/upload/pdf/route.ts

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import sanitizeFilename from 'sanitize-filename'
import { requireAdminApiAccess } from '@/lib/authz'
import { buildProtectedPdfUrl } from '@/lib/protected-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PDF_BYTES = 25 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_PDF_BYTES + 1024 * 1024

export const POST = async (request: Request) => {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const privateBlobToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!privateBlobToken) {
    return NextResponse.json(
      { error: 'Private PDF storage is not configured' },
      { status: 503 }
    )
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json({ error: 'Upload zu groß' }, { status: 413 })
  }

  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const videoId = formData.get('videoId') as string

    if (!pdfFile || !videoId || !/^[A-Za-z0-9_-]{1,128}$/.test(videoId)) {
      return NextResponse.json({ error: 'PDF oder Video-ID fehlt' }, { status: 400 })
    }

    if (pdfFile.type && pdfFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Nur PDF-Dateien sind erlaubt' }, { status: 400 })
    }

    if (pdfFile.size <= 0 || pdfFile.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF muss zwischen 1 Byte und 25 MB liegen' }, { status: 400 })
    }

    if ((await pdfFile.slice(0, 5).text()) !== '%PDF-') {
      return NextResponse.json({ error: 'Ungültige PDF-Datei' }, { status: 400 })
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
    const blob = await put(blobPath, pdfFile, {
      access: 'private',
      token: privateBlobToken,
      contentType: 'application/pdf',
      cacheControlMaxAge: 60,
    })

    const protectedUrl = buildProtectedPdfUrl(videoId, safeFilename, blob.pathname)

    // In DB speichern
    await prisma.video.update({
      where: { id: videoId },
      data: { pdfUrl: protectedUrl },
      select: { id: true },
    })

    return NextResponse.json({ pdfUrl: protectedUrl })
  } catch (error) {
    console.error('PDF Upload Fehler:', error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }
}
