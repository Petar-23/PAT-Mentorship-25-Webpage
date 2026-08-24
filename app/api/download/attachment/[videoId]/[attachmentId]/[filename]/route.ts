import { auth } from '@clerk/nextjs/server'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { prisma } from '@/lib/prisma'
import { verifyVideoAttachmentBytes } from '@/lib/video-attachment-integrity'
import {
  parseVideoAttachmentSetting,
  videoAttachmentSettingKey,
} from '@/lib/video-attachments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DOWNLOAD_TIMEOUT_MS = 15_000

function downloadHeaders(filename: string, contentLength?: number | null, etag?: string | null) {
  const safeFilename = filename.replace(/[\r\n"\\]/g, '').slice(0, 180) || 'regelwerk.md'
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `attachment; filename="document.md"; filename*=UTF-8''${encodeURIComponent(
      safeFilename
    )}`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Type': 'text/markdown; charset=utf-8',
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
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ videoId: string; attachmentId: string; filename: string }>
  }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { videoId, attachmentId, filename } = await params
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(videoId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(attachmentId)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const setting = await prisma.adminSetting.findUnique({
    where: { key: videoAttachmentSettingKey(videoId) },
    select: { value: true },
  })
  const attachment = parseVideoAttachmentSetting(setting?.value, videoId).find(
    (item) => item.id === attachmentId
  )
  if (!attachment || attachment.filename !== filename) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const privateBlobToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!privateBlobToken) {
    return NextResponse.json(
      { error: 'Private attachment storage is not configured' },
      { status: 503 }
    )
  }

  const result = await get(attachment.pathname, {
    access: 'private',
    token: privateBlobToken,
    useCache: false,
    abortSignal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (result.statusCode !== 200) {
    return NextResponse.json({ error: 'Attachment download failed' }, { status: 502 })
  }

  // Markdown attachments are capped at 2 MB. Buffering them lets us verify the
  // exact payload before responding and avoids propagating a missing upstream
  // Content-Length as `0`, which causes browsers to save an empty file.
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
  if (!verifyVideoAttachmentBytes(bytes, attachment.size, attachment.sha256)) {
    console.error('Attachment integrity check failed', {
      attachmentId: attachment.id,
      videoId,
      expectedSize: attachment.size,
      receivedSize: bytes.byteLength,
    })
    return NextResponse.json({ error: 'Attachment integrity check failed' }, { status: 502 })
  }

  return new Response(bytes, {
    status: 200,
    headers: downloadHeaders(attachment.filename, bytes.byteLength, result.blob.etag),
  })
}
