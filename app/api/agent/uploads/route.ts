import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { createVideo, generateTusSignature, getBunnyLibraryId } from '@/lib/bunny'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { revalidateSidebarData } from '@/lib/sidebar-data'

const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload/'
const DEFAULT_SIGNATURE_EXPIRE_MINUTES = 15
const MAX_SIGNATURE_EXPIRE_MINUTES = 60
const MAX_REQUEST_BYTES = 32 * 1024

const prepareSchema = z.object({
  action: z.literal('prepare').optional(),
  type: z.enum(['daily_review', 'advanced_content']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  filename: z.string().trim().max(255).optional(),
  playlistName: z.string().trim().min(1).max(120).optional(),
  moduleName: z.string().trim().min(1).max(120).optional(),
  chapterName: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
  dryRun: z.boolean().optional(),
  signatureExpireMinutes: z.number().int().positive().max(MAX_SIGNATURE_EXPIRE_MINUTES).optional(),
})

const finalizeSchema = z.object({
  action: z.literal('finalize'),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
  videoId: z.string().trim().min(1).max(128),
  bunnyGuid: z.string().trim().uuid(),
})

const DE_MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

type PreparedUploadValue = {
  action: 'prepare'
  type: 'daily_review' | 'advanced_content'
  preparedAt: string
  uploadedAt?: string
  target: {
    playlist: { id: string; name: string; created: boolean }
    module: { id: string; name: string; created: boolean }
    chapter: { id: string; name: string; created: boolean }
  }
  video: {
    id: string
    title: string
    bunnyGuid: string
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
}

function settingKey(idempotencyKey: string) {
  return `agent-upload:${idempotencyKey}`
}

function parseDate(input?: string | null) {
  if (!input) return null
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

function inferDateFromText(input?: string | null) {
  if (!input) return null

  const iso = input.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/)
  if (iso) return parseDate(`${iso[1]}-${iso[2]}-${iso[3]}`)

  const european = input.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/)
  if (european) return parseDate(`${european[3]}-${european[2]}-${european[1]}`)

  return null
}

function monthFromDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${DE_MONTHS[monthNumber - 1] ?? month} ${year}`
}

function isoWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1))
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function resolveTargetNames(input: z.infer<typeof prepareSchema>) {
  const inferredDate =
    parseDate(input.date) ??
    inferDateFromText(input.filename) ??
    inferDateFromText(input.title) ??
    new Date()
  const month = input.month ?? monthFromDate(inferredDate)
  const moduleName = input.moduleName ?? monthLabel(month)

  if (input.type === 'daily_review') {
    return {
      month,
      playlistName:
        input.playlistName ?? process.env.AGENT_DAILY_REVIEW_PLAYLIST_NAME ?? 'Daily Reviews',
      moduleName,
      chapterName:
        input.chapterName ??
        process.env.AGENT_DAILY_REVIEW_CHAPTER_NAME ??
        `KW ${isoWeek(inferredDate)}`,
    }
  }

  return {
    month,
    playlistName:
      input.playlistName ?? process.env.AGENT_ADVANCED_CONTENT_PLAYLIST_NAME ?? 'Advanced Content',
    moduleName,
    chapterName:
      input.chapterName ?? process.env.AGENT_ADVANCED_CONTENT_CHAPTER_NAME ?? 'Lektionen',
  }
}

async function findPlaylistByName(name: string) {
  return prisma.playlist.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { slug: { equals: slugify(name), mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true },
  })
}

async function ensurePlaylist(name: string) {
  const existing = await findPlaylistByName(name)
  if (existing) return { ...existing, created: false }

  const created = await prisma.playlist.create({
    data: { name, slug: slugify(name) },
    select: { id: true, name: true, slug: true },
  })

  revalidateSidebarData()
  return { ...created, created: true }
}

async function findModuleByName(playlistId: string, name: string) {
  return prisma.module.findFirst({
    where: {
      playlistId,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true, name: true, order: true },
  })
}

async function ensureModule(playlistId: string, name: string) {
  const existing = await findModuleByName(playlistId, name)
  if (existing) return { ...existing, created: false }

  const maxOrder = await prisma.module.findFirst({
    where: { playlistId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const created = await prisma.module.create({
    data: {
      playlistId,
      name,
      order: (maxOrder?.order ?? 0) + 1,
    },
    select: { id: true, name: true, order: true },
  })

  revalidateSidebarData()
  return { ...created, created: true }
}

async function findChapterByName(moduleId: string, name: string) {
  return prisma.chapter.findFirst({
    where: {
      moduleId,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true, name: true, order: true },
  })
}

async function ensureChapter(moduleId: string, name: string) {
  const existing = await findChapterByName(moduleId, name)
  if (existing) return { ...existing, created: false }

  const maxOrder = await prisma.chapter.findFirst({
    where: { moduleId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const created = await prisma.chapter.create({
    data: {
      moduleId,
      name,
      order: (maxOrder?.order ?? 0) + 1,
    },
    select: { id: true, name: true, order: true },
  })

  return { ...created, created: true }
}

async function createPlatformVideo(params: {
  title: string
  bunnyGuid: string
  chapterId: string
}) {
  const maxOrder = await prisma.video.findFirst({
    where: { chapterId: params.chapterId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return prisma.video.create({
    data: {
      title: params.title,
      bunnyGuid: params.bunnyGuid,
      chapterId: params.chapterId,
      order: (maxOrder?.order ?? 0) + 1,
    },
    select: {
      id: true,
      title: true,
      bunnyGuid: true,
      order: true,
    },
  })
}

async function getDryRunTarget(names: ReturnType<typeof resolveTargetNames>) {
  const playlist = await findPlaylistByName(names.playlistName)
  const moduleRow = playlist ? await findModuleByName(playlist.id, names.moduleName) : null
  const chapter = moduleRow ? await findChapterByName(moduleRow.id, names.chapterName) : null

  return {
    playlist: playlist ? { id: playlist.id, name: playlist.name, exists: true } : { name: names.playlistName, exists: false },
    module: moduleRow ? { id: moduleRow.id, name: moduleRow.name, exists: true } : { name: names.moduleName, exists: false },
    chapter: chapter ? { id: chapter.id, name: chapter.name, exists: true } : { name: names.chapterName, exists: false },
  }
}

async function buildResponseFromPrepared(
  value: PreparedUploadValue,
  reused: boolean,
  signatureExpireMinutes = DEFAULT_SIGNATURE_EXPIRE_MINUTES
) {
  const { signature, expire } = await generateTusSignature(
    value.video.bunnyGuid,
    signatureExpireMinutes
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.price-action-trader.de'

  return {
    ok: true,
    reused,
    uploadedAt: value.uploadedAt ?? null,
    type: value.type,
    target: value.target,
    video: value.video,
    upload: {
      endpoint: TUS_ENDPOINT,
      libraryId: getBunnyLibraryId(),
      videoId: value.video.bunnyGuid,
      signature,
      expire,
    },
    links: {
      videoUrl: `${baseUrl}/mentorship/modul/${value.target.module.id}?video=${value.video.id}`,
      statusUrl: `${baseUrl}/api/videos/status/${value.video.bunnyGuid}`,
    },
  }
}

function asPreparedUploadValue(value: unknown): PreparedUploadValue | null {
  if (!value || typeof value !== 'object') return null
  const maybe = value as Partial<PreparedUploadValue>
  if (maybe.action !== 'prepare') return null
  if (!maybe.video?.id || !maybe.video.bunnyGuid || !maybe.target?.module?.id) return null
  return maybe as PreparedUploadValue
}

async function prepareUpload(input: z.infer<typeof prepareSchema>) {
  const names = resolveTargetNames(input)

  if (input.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      type: input.type,
      month: names.month,
      target: await withPrismaRetry(() => getDryRunTarget(names), { label: 'Dry-run agent upload target' }),
    })
  }

  if (input.idempotencyKey) {
    const existing = await prisma.adminSetting.findUnique({
      where: { key: settingKey(input.idempotencyKey) },
      select: { value: true },
    })
    const prepared = asPreparedUploadValue(existing?.value)
    if (prepared) {
      return NextResponse.json(
        await buildResponseFromPrepared(prepared, true, input.signatureExpireMinutes)
      )
    }
  }

  const target = await withPrismaRetry(async () => {
    const playlist = await ensurePlaylist(names.playlistName)
    const moduleRow = await ensureModule(playlist.id, names.moduleName)
    const chapter = await ensureChapter(moduleRow.id, names.chapterName)

    return {
      playlist: { id: playlist.id, name: playlist.name, created: playlist.created },
      module: { id: moduleRow.id, name: moduleRow.name, created: moduleRow.created },
      chapter: { id: chapter.id, name: chapter.name, created: chapter.created },
    }
  }, { label: 'Prepare agent upload target' })

  const bunny = await createVideo(input.title, input.description ?? '')
  const video = await withPrismaRetry(
    () =>
      createPlatformVideo({
        title: input.title,
        bunnyGuid: bunny.guid,
        chapterId: target.chapter.id,
      }),
    { label: 'Create agent upload video record' }
  )

  const prepared: PreparedUploadValue = {
    action: 'prepare',
    type: input.type,
    preparedAt: new Date().toISOString(),
    target,
    video: {
      id: video.id,
      title: video.title,
      bunnyGuid: video.bunnyGuid ?? bunny.guid,
    },
  }

  if (input.idempotencyKey) {
    await withPrismaRetry(
      () =>
        prisma.adminSetting.upsert({
          where: { key: settingKey(input.idempotencyKey!) },
          create: { key: settingKey(input.idempotencyKey!), value: prepared },
          update: { value: prepared },
        }),
      { label: 'Store agent upload idempotency state' }
    )
  }

  return NextResponse.json(
    await buildResponseFromPrepared(prepared, false, input.signatureExpireMinutes),
    { status: 201 }
  )
}

async function finalizeUpload(input: z.infer<typeof finalizeSchema>) {
  if (!input.idempotencyKey) {
    return NextResponse.json({ ok: true, finalized: false })
  }

  const existing = await prisma.adminSetting.findUnique({
    where: { key: settingKey(input.idempotencyKey) },
    select: { value: true },
  })
  const prepared = asPreparedUploadValue(existing?.value)
  if (!prepared) {
    return NextResponse.json({ error: 'Prepared upload not found' }, { status: 404 })
  }
  if (prepared.video.id !== input.videoId || prepared.video.bunnyGuid !== input.bunnyGuid) {
    return NextResponse.json({ error: 'Prepared upload does not match video' }, { status: 409 })
  }

  const updated: PreparedUploadValue = {
    ...prepared,
    uploadedAt: new Date().toISOString(),
  }
  await prisma.adminSetting.update({
    where: { key: settingKey(input.idempotencyKey) },
    data: { value: updated },
  })

  return NextResponse.json({ ok: true, finalized: true, uploadedAt: updated.uploadedAt })
}

export async function POST(req: NextRequest) {
  const agent = requireAgentUploadAccess(req)
  if (!agent.ok) return agent.response

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  try {
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody) as unknown
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const bodyRecord = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const action = bodyRecord?.action === 'finalize' ? 'finalize' : 'prepare'

    if (action === 'finalize') {
      const parsed = finalizeSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }
      return await finalizeUpload(parsed.data)
    }

    const parsed = prepareSchema.safeParse({ ...(bodyRecord ?? {}), action: 'prepare' })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    return await prepareUpload(parsed.data)
  } catch (error) {
    console.error('Agent upload API failed:', error)
    return NextResponse.json({ error: 'Server Error' }, { status: 500 })
  }
}
