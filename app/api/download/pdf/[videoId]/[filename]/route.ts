import { auth } from '@clerk/nextjs/server'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { prisma } from '@/lib/prisma'
import {
  getLegacyPublicPdfUrl,
  getPrivatePdfBlobPathname,
  getStoredPdfFilename,
} from '@/lib/protected-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DOWNLOAD_TIMEOUT_MS = 15_000

function downloadHeaders(filename: string, contentLength?: number | null, etag?: string | null) {
  const safeFilename = filename.replace(/[\r\n"\\]/g, '').slice(0, 180) || 'document.pdf'
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Type': 'application/pdf',
    Pragma: 'no-cache',
    Vary: 'Cookie, Authorization',
    'X-Content-Type-Options': 'nosniff',
  })
  if (typeof contentLength === 'number' && Number.isFinite(contentLength)) {
    headers.set('Content-Length', String(contentLength))
  }
  if (etag) headers.set('ETag', etag)
  return headers
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; filename: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { videoId } = await params
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(videoId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { pdfUrl: true },
  })
  if (!video?.pdfUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filename = getStoredPdfFilename(video.pdfUrl)
  const privatePathname = getPrivatePdfBlobPathname(video.pdfUrl, videoId)

  if (privatePathname) {
    const privateBlobToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
    if (!privateBlobToken) {
      return NextResponse.json({ error: 'Private PDF storage is not configured' }, { status: 503 })
    }

    const result = await get(privatePathname, {
      access: 'private',
      token: privateBlobToken,
      useCache: false,
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
      abortSignal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: downloadHeaders(filename, null, result.blob.etag),
      })
    }

    return new Response(result.stream, {
      status: 200,
      headers: downloadHeaders(filename, result.blob.size, result.blob.etag),
    })
  }

  // Transitional compatibility only. Existing public blobs must still be migrated to a private store.
  const legacyUrl = getLegacyPublicPdfUrl(video.pdfUrl, videoId)
  if (!legacyUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const legacyResponse = await fetch(legacyUrl, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!legacyResponse.ok || !legacyResponse.body) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contentLength = Number(legacyResponse.headers.get('content-length'))
  return new Response(legacyResponse.body, {
    status: 200,
    headers: downloadHeaders(
      filename,
      Number.isFinite(contentLength) ? contentLength : null,
      legacyResponse.headers.get('etag')
    ),
  })
}
