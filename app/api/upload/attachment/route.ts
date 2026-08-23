import { createHash, randomUUID } from 'crypto'
import { del, put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import sanitizeFilename from 'sanitize-filename'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { requireAdminApiAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import {
  MAX_VIDEO_ATTACHMENTS,
  parseVideoAttachmentSetting,
  toVideoAttachment,
  videoAttachmentSettingKey,
  type StoredVideoAttachment,
} from '@/lib/video-attachments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_ATTACHMENT_BYTES + 512 * 1024
const ALLOWED_CONTENT_TYPES = new Set([
  '',
  'application/octet-stream',
  'text/markdown',
  'text/plain',
])

async function requireAttachmentUploadAccess(request: NextRequest) {
  const agent = requireAgentUploadAccess(request)
  if (agent.ok) return agent
  return requireAdminApiAccess()
}

async function safeDeletePrivateBlob(pathname: string, token: string) {
  try {
    await del(pathname, { token })
  } catch (error) {
    console.warn('Private attachment cleanup failed:', error)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAttachmentUploadAccess(request)
  if (!access.ok) return access.response

  const privateBlobToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!privateBlobToken) {
    return NextResponse.json(
      { error: 'Private attachment storage is not configured' },
      { status: 503 }
    )
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (
    !Number.isFinite(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_MULTIPART_BYTES
  ) {
    return NextResponse.json({ error: 'Upload zu groß oder leer' }, { status: 413 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('attachment')
    const videoId = formData.get('videoId')

    if (
      !(file instanceof File) ||
      typeof videoId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(videoId)
    ) {
      return NextResponse.json({ error: 'Datei oder Video-ID fehlt' }, { status: 400 })
    }

    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: 'Markdown-Datei muss zwischen 1 Byte und 2 MB liegen' },
        { status: 400 }
      )
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Nur Markdown-Dateien sind erlaubt' }, { status: 400 })
    }

    let safeFilename = sanitizeFilename(file.name).trim()
    if (!safeFilename.toLowerCase().endsWith('.md')) {
      return NextResponse.json({ error: 'Dateiname muss auf .md enden' }, { status: 400 })
    }
    safeFilename = safeFilename.slice(0, 160) || 'regelwerk.md'

    const bytes = new Uint8Array(await file.arrayBuffer())
    let markdown: string
    try {
      markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return NextResponse.json({ error: 'Markdown muss gültiges UTF-8 sein' }, { status: 400 })
    }
    if (markdown.includes('\0')) {
      return NextResponse.json({ error: 'Ungültiger Markdown-Inhalt' }, { status: 400 })
    }

    const settingKey = videoAttachmentSettingKey(videoId)
    const [video, setting] = await Promise.all([
      prisma.video.findUnique({ where: { id: videoId }, select: { id: true } }),
      prisma.adminSetting.findUnique({ where: { key: settingKey }, select: { value: true } }),
    ])
    if (!video) return NextResponse.json({ error: 'Video nicht gefunden' }, { status: 404 })

    const existing = parseVideoAttachmentSetting(setting?.value, videoId)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const unchanged = existing.find(
      (item) => item.filename === safeFilename && item.sha256 === sha256
    )
    if (unchanged) {
      return NextResponse.json({ attachment: toVideoAttachment(videoId, unchanged) })
    }

    const replaced = existing.find((item) => item.filename === safeFilename)
    if (!replaced && existing.length >= MAX_VIDEO_ATTACHMENTS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_VIDEO_ATTACHMENTS} Anhänge pro Video` },
        { status: 409 }
      )
    }

    const attachment: StoredVideoAttachment = {
      id: randomUUID(),
      filename: safeFilename,
      pathname: '',
      contentType: 'text/markdown',
      size: file.size,
      sha256,
      uploadedAt: new Date().toISOString(),
    }
    const blobPath = `attachments/${videoId}/${attachment.id}-${safeFilename}`
    const blob = await put(blobPath, bytes, {
      access: 'private',
      token: privateBlobToken,
      contentType: 'text/markdown; charset=utf-8',
      cacheControlMaxAge: 60,
    })
    attachment.pathname = blob.pathname

    const next = [...existing.filter((item) => item.filename !== safeFilename), attachment]
    try {
      await prisma.adminSetting.upsert({
        where: { key: settingKey },
        create: { key: settingKey, value: next },
        update: { value: next },
        select: { id: true },
      })
    } catch (error) {
      await safeDeletePrivateBlob(attachment.pathname, privateBlobToken)
      throw error
    }

    if (replaced) await safeDeletePrivateBlob(replaced.pathname, privateBlobToken)

    return NextResponse.json({ attachment: toVideoAttachment(videoId, attachment) })
  } catch (error) {
    console.error('Attachment upload error:', error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }
}
