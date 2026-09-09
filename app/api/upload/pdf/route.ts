import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { get, put } from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import sanitizeFilename from 'sanitize-filename'
import { requireAdminApiAccess } from '@/lib/authz'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { buildProtectedPdfUrl } from '@/lib/protected-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PDF_BYTES = 25 * 1024 * 1024
const VIDEO_ID = /^[A-Za-z0-9_-]{1,128}$/
const PDF_OBJECT = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function filename(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) return null
  const safe = sanitizeFilename(value).trim()
  return safe && safe.toLowerCase().endsWith('.pdf') ? safe : null
}

async function saveAttachment(videoId: string, pdfUrl: string, expectedPdfUrl: string | null) {
  try {
    await prisma.video.update({ where: { id: videoId, pdfUrl: expectedPdfUrl }, data: { pdfUrl }, select: { id: true } })
    return NextResponse.json({ pdfUrl })
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'P2025') {
      const current = await prisma.video.findUnique({ where: { id: videoId }, select: { pdfUrl: true } })
      if (!current) return error('Die Lektion wurde nicht gefunden.', 404)
      if (current.pdfUrl === pdfUrl) return NextResponse.json({ pdfUrl })
      return error('Die Unterlagen wurden inzwischen geändert. Bitte die Lektion neu laden.', 409)
    }
    throw cause
  }
}

async function hasPdfHeader(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const prefix = new Uint8Array(5)
  let length = 0
  try {
    while (length < prefix.length) {
      const chunk = await reader.read()
      if (chunk.done) break
      const part = chunk.value.subarray(0, prefix.length - length)
      prefix.set(part, length)
      length += part.length
    }
  } finally {
    await reader.cancel()
  }
  return new TextDecoder().decode(prefix) === '%PDF-'
}

export async function POST(request: NextRequest) {
  const hasAgentCredential = request.headers.has('authorization') || request.headers.has('x-agent-upload-token')
  const access = hasAgentCredential ? requireAgentUploadAccess(request) : await requireAdminApiAccess()
  if (!access.ok) return access.response

  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!token) return error('Der geschützte PDF-Speicher ist derzeit nicht verfügbar.', 503)

  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const text = await request.text()
      if (text.length > 16_000) return error('Die Upload-Anfrage ist zu groß.', 413)
      let body
      try { body = JSON.parse(text) } catch { return error('Ungültige Upload-Anfrage.') }
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.videoId !== 'string' || !VIDEO_ID.test(body.videoId)) {
        return error('Eine gültige Lektion fehlt.')
      }
      if (body.action !== 'prepare' && body.action !== 'complete') return error('Ungültige Upload-Aktion.')
      const safeFilename = filename(body.filename)
      if (!safeFilename) return error('Bitte eine PDF-Datei mit gültigem Dateinamen auswählen.')
      const hasExpected = Object.hasOwn(body, 'expectedPdfUrl')
      if ((body.action === 'complete' || hasExpected) &&
        body.expectedPdfUrl !== null && typeof body.expectedPdfUrl !== 'string') {
        return error('Die bisherige PDF-Zuordnung fehlt. Bitte die Lektion neu laden.')
      }

      if (body.action === 'complete') {
        const prefix = `pdfs/${body.videoId}/`
        if (typeof body.pathname !== 'string' || !body.pathname.startsWith(prefix) ||
          !PDF_OBJECT.test(body.pathname.slice(prefix.length))) {
          return error('Die hochgeladene PDF gehört nicht zu dieser Lektion.')
        }
      }
      const video = await prisma.video.findUnique({ where: { id: body.videoId }, select: { pdfUrl: true } })
      if (!video) return error('Die Lektion wurde nicht gefunden.', 404)
      if (hasExpected && video.pdfUrl !== body.expectedPdfUrl) {
        const sameCompletedUpload = body.action === 'complete' &&
          video.pdfUrl === buildProtectedPdfUrl(body.videoId, safeFilename, body.pathname)
        if (sameCompletedUpload) return NextResponse.json({ pdfUrl: video.pdfUrl })
        return error('Die Unterlagen wurden inzwischen geändert. Bitte die Lektion neu laden.', 409)
      }

      if (body.action === 'prepare') {
        if (!Number.isInteger(body.size) || body.size <= 0 || body.size > MAX_PDF_BYTES) {
          return error('Die PDF muss zwischen 1 Byte und 25 MB groß sein.')
        }
        const pathname = `pdfs/${body.videoId}/${randomUUID()}.pdf`
        const clientToken = await generateClientTokenFromReadWriteToken({
          token, pathname,
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: body.size,
          validUntil: Date.now() + 15 * 60 * 1000,
          allowOverwrite: false,
          addRandomSuffix: false,
          cacheControlMaxAge: 60,
        })
        return NextResponse.json({
          pathname, token: clientToken, filename: safeFilename, expectedPdfUrl: video.pdfUrl,
        }, { headers: { 'Cache-Control': 'no-store' } })
      }

      const uploaded = await get(body.pathname, { access: 'private', token, useCache: false })
      if (!uploaded || uploaded.statusCode !== 200) return error('Die Datei ist noch nicht verfügbar. Bitte erneut versuchen.', 409)
      if (uploaded.blob.size <= 0 || uploaded.blob.size > MAX_PDF_BYTES || uploaded.blob.contentType !== 'application/pdf') {
        await uploaded.stream.cancel()
        return error('Die hochgeladene Datei entspricht nicht den PDF-Vorgaben.')
      }
      if (!(await hasPdfHeader(uploaded.stream))) return error('Die Datei ist keine gültige PDF.')
      return await saveAttachment(body.videoId, buildProtectedPdfUrl(body.videoId, safeFilename, body.pathname), body.expectedPdfUrl)
    }

    // Keep small uploads from an already open, older admin page working.
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_PDF_BYTES + 1024 * 1024) {
      return error('Die PDF ist zu groß.', 413)
    }
    const form = await request.formData()
    const file = form.get('pdf')
    const videoId = form.get('videoId')
    if (!(file instanceof File) || typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) return error('PDF oder Video-ID fehlt.')
    const safeFilename = filename(file.name)
    if (!safeFilename || (file.type && file.type !== 'application/pdf')) return error('Nur PDF-Dateien sind erlaubt.')
    if (!file.size || file.size > MAX_PDF_BYTES) return error('Die PDF muss zwischen 1 Byte und 25 MB groß sein.')
    if ((await file.slice(0, 5).text()) !== '%PDF-') return error('Die Datei ist keine gültige PDF.')
    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { pdfUrl: true } })
    if (!video) return error('Die Lektion wurde nicht gefunden.', 404)
    const blob = await put(`pdfs/${videoId}/${randomUUID()}-${safeFilename}`, file, {
      access: 'private', token, contentType: 'application/pdf', cacheControlMaxAge: 60,
    })
    return await saveAttachment(videoId, buildProtectedPdfUrl(videoId, safeFilename, blob.pathname), video.pdfUrl)
  } catch {
    return error('Die PDF konnte nicht gespeichert werden. Bitte erneut versuchen.', 500)
  }
}
