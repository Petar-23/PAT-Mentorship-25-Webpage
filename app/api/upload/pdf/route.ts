// app/api/upload/pdf/route.ts

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import sanitizeFilename from 'sanitize-filename'
import { requireAdminApiAccess } from '@/lib/authz'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { buildProtectedPdfUrl } from '@/lib/protected-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PDF_BYTES = 25 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_PDF_BYTES + 1024 * 1024

async function requirePdfUploadAccess(request: NextRequest) {
  const agent = requireAgentUploadAccess(request)
  if (agent.ok) return agent

  return requireAdminApiAccess()
}

export const POST = async (request: NextRequest) => {
  const access = await requirePdfUploadAccess(request)
  if (!access.ok) {
    return access.response
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
    const pdfFile = formData.get('pdf')
    const videoId = formData.get('videoId')

    if (
      !(pdfFile instanceof File) ||
      typeof videoId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(videoId)
    ) {
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

    let originalName = pdfFile.name
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      originalName += '.pdf'
    }

    const safeFilename = sanitizeFilename(originalName) || 'document.pdf'
    const blobPath = `pdfs/${videoId}/${randomUUID()}-${safeFilename}`

    const blob = await put(blobPath, pdfFile, {
      access: 'private',
      token: privateBlobToken,
      contentType: 'application/pdf',
      cacheControlMaxAge: 60,
    })

    const protectedUrl = buildProtectedPdfUrl(videoId, safeFilename, blob.pathname)

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
