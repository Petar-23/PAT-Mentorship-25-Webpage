import crypto from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlobNotFoundError, del, get, head, put } from '@vercel/blob'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import sanitizeFilename from 'sanitize-filename'

const MAX_PDF_BYTES = 25 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 30_000
const MANIFEST_VERSION = 1
const LOCK_KEYS = [19877101, 20260710]
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseIntegerFlag(value, name, { minimum = 0 } = {}) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`)
  }
  return parsed
}

function parseArgs(argv) {
  const options = {
    phase: 'inventory',
    apply: false,
    acknowledgePublicDeletion: false,
    environmentId: null,
    expectCount: null,
    expectDigest: null,
    limit: null,
    manifestPath: null,
    videoId: null,
  }

  for (const arg of argv) {
    if (arg === '--apply') options.apply = true
    else if (arg === '--acknowledge-public-deletion') options.acknowledgePublicDeletion = true
    else if (arg.startsWith('--phase=')) options.phase = arg.slice('--phase='.length)
    else if (arg.startsWith('--environment-id=')) {
      options.environmentId = arg.slice('--environment-id='.length).trim()
    } else if (arg.startsWith('--expect-digest=')) {
      options.expectDigest = arg.slice('--expect-digest='.length).trim().toLowerCase()
    }
    else if (arg.startsWith('--expect-count=')) {
      options.expectCount = parseIntegerFlag(
        arg.slice('--expect-count='.length),
        '--expect-count'
      )
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseIntegerFlag(arg.slice('--limit='.length), '--limit', { minimum: 1 })
    } else if (arg.startsWith('--manifest=')) {
      options.manifestPath = arg.slice('--manifest='.length).trim()
    } else if (arg.startsWith('--video-id=')) {
      const videoId = arg.slice('--video-id='.length).trim()
      if (!videoId) throw new Error('--video-id must not be empty')
      options.videoId = videoId
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!['inventory', 'migrate', 'verify', 'delete'].includes(options.phase)) {
    throw new Error('--phase must be inventory, migrate, verify, or delete')
  }
  if (options.videoId && !/^[A-Za-z0-9_-]{1,128}$/.test(options.videoId)) {
    throw new Error('--video-id is invalid')
  }
  if (options.environmentId && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(options.environmentId)) {
    throw new Error('--environment-id is invalid')
  }
  if (options.expectDigest && !/^[a-f0-9]{64}$/.test(options.expectDigest)) {
    throw new Error('--expect-digest must be a SHA-256 hex digest')
  }
  if (options.phase === 'inventory' && options.apply) {
    throw new Error('--apply is not valid for the inventory phase')
  }
  if (options.phase !== 'inventory' && !options.manifestPath) {
    throw new Error(`${options.phase} requires --manifest=/absolute/path.jsonl`)
  }
  if (options.apply && options.expectCount === null) {
    throw new Error('--apply requires --expect-count=<dry-run candidate count>')
  }
  if (options.apply && !options.expectDigest) {
    throw new Error('--apply requires --expect-digest=<dry-run candidate digest>')
  }
  if (options.apply && !options.environmentId) {
    throw new Error('--apply requires --environment-id=<target environment>')
  }
  if (options.phase === 'delete' && options.apply && !options.acknowledgePublicDeletion) {
    throw new Error('delete --apply requires --acknowledge-public-deletion')
  }

  return options
}

function canonicalPublicBlobPdfUrl(pdfUrl) {
  if (typeof pdfUrl !== 'string' || !pdfUrl) return null
  try {
    const parsed = new URL(pdfUrl)
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) return null
    if (!parsed.hostname.endsWith('.public.blob.vercel-storage.com')) return null
    if (!parsed.pathname.toLowerCase().endsWith('.pdf')) return null
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function getLegacyPublicPdfUrl(pdfUrl, videoId) {
  const canonical = canonicalPublicBlobPdfUrl(pdfUrl)
  if (!canonical) return null
  const original = new URL(pdfUrl)
  if (original.search || original.hash) return null
  return new URL(canonical).pathname.startsWith(`/pdfs/${videoId}/`) ? canonical : null
}

function publicBlobObjectIdentity(pdfUrl) {
  const canonical = canonicalPublicBlobPdfUrl(pdfUrl)
  if (!canonical) return null
  const parsed = new URL(canonical)
  let decodedPathname = parsed.pathname
  try {
    decodedPathname = decodeURI(parsed.pathname)
  } catch {
    // Preserve the encoded pathname if it is malformed.
  }
  return `${parsed.hostname.toLowerCase()}\0${decodedPathname}`
}

function getPrivatePdfBlobPathname(pdfUrl, videoId) {
  if (typeof pdfUrl !== 'string' || !pdfUrl.startsWith('/api/download/pdf/')) return null
  try {
    const parsed = new URL(pdfUrl, 'https://local.invalid')
    const pathname = parsed.searchParams.get('blob')
    if (!pathname || pathname.includes('..') || pathname.includes('\\')) return null
    if (pathname.includes('://') || !pathname.startsWith(`pdfs/${videoId}/`)) return null
    return pathname.toLowerCase().endsWith('.pdf') ? pathname : null
  } catch {
    return null
  }
}

function getOperationsDatabaseUrl() {
  const value = (
    process.env.MIGRATION_DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim()
  )
  if (!value) {
    throw new Error('MIGRATION_DATABASE_URL or DIRECT_URL is required')
  }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('The operations database URL is invalid')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('The operations database URL must use PostgreSQL')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (
    hostname === 'pooled.db.prisma.io' ||
    hostname.endsWith('.pooled.db.prisma.io') ||
    hostname.includes('accelerate.prisma-data.net') ||
    parsed.searchParams.get('pgbouncer') === 'true'
  ) {
    throw new Error('The PDF migration requires a direct non-pooled database URL')
  }
  return value
}

function safePdfFilename(sourceUrl) {
  const encodedBasename = new URL(sourceUrl).pathname.split('/').pop() || 'document.pdf'
  let decodedBasename = encodedBasename
  try {
    decodedBasename = decodeURIComponent(encodedBasename)
  } catch {
    // Keep the encoded basename when malformed percent escapes are present.
  }

  let filename = sanitizeFilename(decodedBasename) || 'document.pdf'
  if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf'
  if (filename.length > 120) filename = `${filename.slice(0, 116)}.pdf`
  return filename
}

function buildProtectedPdfUrl(videoId, filename, privatePathname) {
  const route = `/api/download/pdf/${encodeURIComponent(videoId)}/${encodeURIComponent(filename)}`
  const search = new URLSearchParams({ blob: privatePathname })
  return `${route}?${search.toString()}`
}

function migrationIdFor(videoId, originalPdfUrl) {
  return crypto.createHash('sha256').update(`${videoId}\0${originalPdfUrl}`).digest('hex')
}

function recordLabel(videoId) {
  return crypto.createHash('sha256').update(videoId).digest('hex').slice(0, 12)
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/https?:\/\/\S+/gi, '[redacted-url]').slice(0, 300)
}

async function readBoundedStream(stream) {
  const reader = stream.getReader()
  const chunks = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_PDF_BYTES) {
      await reader.cancel()
      throw new Error('PDF exceeds the migration size limit')
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, totalBytes)
}

function assertPdfBytes(bytes) {
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Object does not contain a valid PDF header')
  }
}

async function downloadLegacyPdf(sourceUrl) {
  const response = await fetch(sourceUrl, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!response.ok || !response.body) {
    throw new Error(`Legacy PDF download failed with status ${response.status}`)
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES) {
    throw new Error('PDF exceeds the migration size limit')
  }

  const bytes = await readBoundedStream(response.body)
  assertPdfBytes(bytes)
  return {
    bytes,
    etag: response.headers.get('etag'),
    size: bytes.length,
    sha256: sha256(bytes),
  }
}

async function getBlobMetadata(urlOrPathname, token) {
  try {
    return await head(urlOrPathname, { token })
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null
    throw error
  }
}

async function readPrivatePdf(pathname, token) {
  const result = await get(pathname, {
    access: 'private',
    token,
    useCache: false,
    abortSignal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!result?.stream) return null
  const bytes = await readBoundedStream(result.stream)
  assertPdfBytes(bytes)
  return { bytes, etag: result.blob.etag, size: bytes.length, sha256: sha256(bytes) }
}

async function assertPrivatePdf(record, privateToken) {
  const privatePdf = await readPrivatePdf(record.privatePathname, privateToken)
  if (!privatePdf) throw new Error('Private PDF is missing')
  if (privatePdf.size !== record.size || privatePdf.sha256 !== record.sha256) {
    throw new Error('Private PDF content verification failed')
  }
  return privatePdf
}

async function assertLegacySourceUnchanged(record) {
  const response = await fetch(record.canonicalSourceUrl, {
    method: 'HEAD',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  const currentEtag = response.ok ? response.headers.get('etag') : null
  const currentSize = Number(response.headers.get('content-length'))
  if (
    response.ok &&
    record.sourceEtag &&
    currentEtag === record.sourceEtag &&
    (!Number.isFinite(currentSize) || currentSize === record.size)
  ) {
    return
  }

  const current = await downloadLegacyPdf(record.canonicalSourceUrl)
  if (current.size !== record.size || current.sha256 !== record.sha256) {
    throw new Error('Legacy source changed after the private copy was prepared')
  }
}

function assertManifestPath(manifestPath) {
  if (!path.isAbsolute(manifestPath)) throw new Error('--manifest must be an absolute path')
  const resolved = path.resolve(manifestPath)
  if (resolved === REPO_ROOT || resolved.startsWith(`${REPO_ROOT}${path.sep}`)) {
    throw new Error('Manifest must live outside the repository')
  }
  return resolved
}

async function ensureManifestFile(manifestPath) {
  const resolved = assertManifestPath(manifestPath)
  const parent = path.dirname(resolved)
  const canonicalParent = await realpath(parent)
  if (canonicalParent !== parent) {
    throw new Error('Manifest parent directory must not traverse symbolic links')
  }
  try {
    const stat = await lstat(resolved)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Manifest must be a regular file')
    if ((stat.mode & 0o077) !== 0) throw new Error('Existing manifest must have mode 0600')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    const handle = await open(
      resolved,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW || 0),
      0o600
    )
    await handle.close()
  }
  return resolved
}

async function appendManifestEvent(manifestPath, event) {
  const handle = await open(
    manifestPath,
    fsConstants.O_APPEND | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW || 0)
  )
  try {
    await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function validatePreparedEvent(event, lineNumber) {
  const requiredStrings = [
    'migrationId',
    'videoId',
    'originalPdfUrl',
    'canonicalSourceUrl',
    'sha256',
    'filename',
    'privatePathname',
    'privateEtag',
    'protectedUrl',
  ]
  for (const key of requiredStrings) {
    if (typeof event[key] !== 'string' || !event[key]) {
      throw new Error(`Manifest line ${lineNumber} has an invalid ${key}`)
    }
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(event.videoId)) {
    throw new Error(`Manifest line ${lineNumber} has an invalid videoId`)
  }
  if (!/^[a-f0-9]{64}$/.test(event.sha256)) {
    throw new Error(`Manifest line ${lineNumber} has an invalid SHA-256`)
  }
  if (!Number.isInteger(event.size) || event.size < 1 || event.size > MAX_PDF_BYTES) {
    throw new Error(`Manifest line ${lineNumber} has an invalid size`)
  }
  if (event.sourceEtag !== null && typeof event.sourceEtag !== 'string') {
    throw new Error(`Manifest line ${lineNumber} has an invalid source ETag`)
  }

  const canonicalSourceUrl = getLegacyPublicPdfUrl(event.originalPdfUrl, event.videoId)
  if (!canonicalSourceUrl || canonicalSourceUrl !== event.canonicalSourceUrl) {
    throw new Error(`Manifest line ${lineNumber} has an invalid legacy source URL`)
  }
  if (event.migrationId !== migrationIdFor(event.videoId, event.originalPdfUrl)) {
    throw new Error(`Manifest line ${lineNumber} has an invalid migration ID`)
  }
  if (event.filename !== safePdfFilename(canonicalSourceUrl)) {
    throw new Error(`Manifest line ${lineNumber} has an invalid filename`)
  }
  const expectedPrivatePathname = `pdfs/${event.videoId}/migration-${event.sha256}.pdf`
  if (event.privatePathname !== expectedPrivatePathname) {
    throw new Error(`Manifest line ${lineNumber} has an invalid private pathname`)
  }
  if (
    event.protectedUrl !==
    buildProtectedPdfUrl(event.videoId, event.filename, event.privatePathname)
  ) {
    throw new Error(`Manifest line ${lineNumber} has an invalid protected URL`)
  }
}

function validateContextEvent(event, lineNumber) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(event.environmentId ?? '')) {
    throw new Error(`Manifest line ${lineNumber} has an invalid environment ID`)
  }
  for (const key of ['databaseFingerprint', 'privateTokenFingerprint']) {
    if (!/^[a-f0-9]{64}$/.test(event[key] ?? '')) {
      throw new Error(`Manifest line ${lineNumber} has an invalid ${key}`)
    }
  }
}

async function loadManifest(manifestPath) {
  const handle = await open(
    manifestPath,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0)
  )
  let text
  try {
    text = await handle.readFile('utf8')
  } finally {
    await handle.close()
  }
  const manifest = { context: null, states: new Map() }
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      throw new Error(`Manifest line ${index + 1} is invalid JSON`)
    }
    const lineNumber = index + 1
    if (event.version !== MANIFEST_VERSION) {
      throw new Error(`Manifest line ${index + 1} has an unsupported shape`)
    }
    if (event.event === 'CONTEXT') {
      if (manifest.context || manifest.states.size > 0) {
        throw new Error(`Manifest line ${lineNumber} has an out-of-order CONTEXT event`)
      }
      validateContextEvent(event, lineNumber)
      manifest.context = event
      continue
    }
    if (!manifest.context) {
      throw new Error(`Manifest line ${lineNumber} appears before CONTEXT`)
    }
    if (typeof event.migrationId !== 'string') {
      throw new Error(`Manifest line ${lineNumber} has an invalid migration ID`)
    }
    if (!['PREPARED', 'COMMITTED', 'VERIFIED', 'DELETED'].includes(event.event)) {
      throw new Error(`Manifest line ${lineNumber} has an unsupported event`)
    }
    if (event.event === 'PREPARED') validatePreparedEvent(event, lineNumber)
    const state = manifest.states.get(event.migrationId) ?? {
      events: new Set(),
      prepared: null,
    }
    const invalidTransition =
      (event.event === 'PREPARED' && state.events.size > 0) ||
      (event.event === 'COMMITTED' &&
        (!state.events.has('PREPARED') || state.events.has('COMMITTED'))) ||
      (event.event === 'VERIFIED' &&
        (!state.events.has('COMMITTED') || state.events.has('VERIFIED'))) ||
      (event.event === 'DELETED' &&
        (!state.events.has('VERIFIED') || state.events.has('DELETED')))
    if (invalidTransition) {
      throw new Error(`Manifest line ${lineNumber} has an invalid state transition`)
    }
    state.events.add(event.event)
    if (event.event === 'PREPARED') state.prepared = event
    manifest.states.set(event.migrationId, state)
  }
  for (const state of manifest.states.values()) {
    if (!state.prepared) throw new Error('Manifest contains an event without PREPARED data')
  }
  return manifest
}

function eventFor(event, migrationId, extra = {}) {
  return {
    version: MANIFEST_VERSION,
    event,
    migrationId,
    occurredAt: new Date().toISOString(),
    ...extra,
  }
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function candidateDigest({ phase, options, candidateIds, selectedIds }) {
  return fingerprint(
    JSON.stringify({
      version: MANIFEST_VERSION,
      phase,
      environmentId: options.environmentId ?? null,
      videoId: options.videoId ?? null,
      limit: options.limit,
      candidates: [...candidateIds].sort(),
      selected: [...selectedIds].sort(),
    })
  )
}

async function ensureManifestContext({
  manifest,
  manifestPath,
  options,
  databaseFingerprint,
  privateToken,
}) {
  const expected = {
    environmentId: options.environmentId,
    databaseFingerprint,
    privateTokenFingerprint: fingerprint(privateToken),
  }
  if (manifest.context) {
    for (const [key, value] of Object.entries(expected)) {
      if (manifest.context[key] !== value) {
        throw new Error(`Manifest context does not match the current ${key}`)
      }
    }
    return
  }

  const context = {
    version: MANIFEST_VERSION,
    event: 'CONTEXT',
    occurredAt: new Date().toISOString(),
    ...expected,
  }
  await appendManifestEvent(manifestPath, context)
  manifest.context = context
}

async function acquireAdvisoryLock(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, keepAlive: true })
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      LOCK_KEYS
    )
    if (result.rows[0]?.acquired !== true) {
      throw new Error('Another private PDF migration is already running')
    }
  } catch (error) {
    if (client) client.release()
    await pool.end().catch(() => undefined)
    throw error
  }

  return async () => {
    let unlockError = null
    try {
      await client.query('SELECT pg_advisory_unlock($1, $2)', LOCK_KEYS)
    } catch (error) {
      unlockError = error
    } finally {
      client.release()
      await pool.end().catch((error) => {
        unlockError ??= error
      })
    }
    if (unlockError) throw unlockError
  }
}

function createPrisma(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  })
  return {
    pool,
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
  }
}

async function loadPdfVideos(prisma, videoId) {
  return prisma.video.findMany({
    where: { pdfUrl: { not: null }, ...(videoId ? { id: videoId } : {}) },
    select: { id: true, pdfUrl: true },
    orderBy: { id: 'asc' },
  })
}

async function inventory(prisma, options) {
  const videos = await loadPdfVideos(prisma, options.videoId)
  const eligible = videos.filter(
    (video) => video.pdfUrl && getLegacyPublicPdfUrl(video.pdfUrl, video.id)
  )
  const protectedRows = videos.filter(
    (video) => video.pdfUrl && getPrivatePdfBlobPathname(video.pdfUrl, video.id)
  )
  const unsupported = videos.length - eligible.length - protectedRows.length
  console.log(
    JSON.stringify({
      phase: 'inventory',
      videosWithPdf: videos.length,
      eligibleLegacy: eligible.length,
      alreadyProtected: protectedRows.length,
      unsupported,
    })
  )
  return { videos, eligible, protectedRows, unsupported }
}

function selectWithLimit(records, limit) {
  return limit === null ? records : records.slice(0, limit)
}

async function prepareRecord(video, privateToken) {
  const canonicalSourceUrl = getLegacyPublicPdfUrl(video.pdfUrl, video.id)
  if (!canonicalSourceUrl) throw new Error('Video no longer has an eligible legacy PDF URL')
  const source = await downloadLegacyPdf(canonicalSourceUrl)
  const filename = safePdfFilename(canonicalSourceUrl)
  const privatePathname = `pdfs/${video.id}/migration-${source.sha256}.pdf`
  const existing = await readPrivatePdf(privatePathname, privateToken)
  if (existing && (existing.size !== source.size || existing.sha256 !== source.sha256)) {
    throw new Error('Existing private target does not match the legacy PDF')
  }
  if (!existing) {
    await put(privatePathname, source.bytes, {
      access: 'private',
      token: privateToken,
      contentType: 'application/pdf',
      cacheControlMaxAge: 60,
      addRandomSuffix: false,
      allowOverwrite: false,
      multipart: source.bytes.length > 5 * 1024 * 1024,
    })
  }
  const verified = await readPrivatePdf(privatePathname, privateToken)
  if (!verified || verified.size !== source.size || verified.sha256 !== source.sha256) {
    throw new Error('Private target verification failed')
  }

  return {
    version: MANIFEST_VERSION,
    event: 'PREPARED',
    migrationId: migrationIdFor(video.id, video.pdfUrl),
    occurredAt: new Date().toISOString(),
    videoId: video.id,
    originalPdfUrl: video.pdfUrl,
    canonicalSourceUrl,
    sourceEtag: source.etag,
    size: source.size,
    sha256: source.sha256,
    filename,
    privatePathname,
    privateEtag: verified.etag,
    protectedUrl: buildProtectedPdfUrl(video.id, filename, privatePathname),
  }
}

async function migrateRecord({ prisma, video, privateToken, manifestPath, states }) {
  const migrationId = migrationIdFor(video.id, video.pdfUrl)
  let state = states.get(migrationId)
  let record = state?.prepared

  if (!record) {
    record = await prepareRecord(video, privateToken)
    await appendManifestEvent(manifestPath, record)
    state = { prepared: record, events: new Set(['PREPARED']) }
    states.set(migrationId, state)
  } else {
    await assertPrivatePdf(record, privateToken)
  }

  const current = await prisma.video.findUnique({
    where: { id: record.videoId },
    select: { pdfUrl: true },
  })
  if (current?.pdfUrl === record.protectedUrl) {
    if (!state.events.has('COMMITTED')) {
      await appendManifestEvent(manifestPath, eventFor('COMMITTED', migrationId))
      state.events.add('COMMITTED')
    }
    return
  }
  if (state.events.has('COMMITTED')) {
    throw new Error('A committed manifest record no longer matches the database')
  }
  if (current?.pdfUrl !== record.originalPdfUrl) {
    throw new Error('Concurrent PDF URL change detected')
  }

  await assertLegacySourceUnchanged(record)
  const updated = await prisma.video.updateMany({
    where: { id: record.videoId, pdfUrl: record.originalPdfUrl },
    data: { pdfUrl: record.protectedUrl },
  })
  if (updated.count !== 1) {
    const reloaded = await prisma.video.findUnique({
      where: { id: record.videoId },
      select: { pdfUrl: true },
    })
    if (reloaded?.pdfUrl !== record.protectedUrl) {
      throw new Error('Compare-and-set update failed')
    }
  }

  await appendManifestEvent(manifestPath, eventFor('COMMITTED', migrationId))
  state.events.add('COMMITTED')
}

async function findPreparedRecoveries(prisma, states, options) {
  const recoveries = []
  for (const state of states.values()) {
    if (state.events.has('COMMITTED')) continue
    const record = state.prepared
    if (options.videoId && record.videoId !== options.videoId) continue
    const current = await prisma.video.findUnique({
      where: { id: record.videoId },
      select: { pdfUrl: true },
    })
    if (current?.pdfUrl === record.protectedUrl) {
      recoveries.push(record)
      continue
    }
    if (current?.pdfUrl !== record.originalPdfUrl) {
      throw new Error('Prepared manifest record conflicts with the current database value')
    }
  }
  return recoveries
}

async function reconcilePreparedRecord({ record, privateToken, manifestPath, states }) {
  await assertPrivatePdf(record, privateToken)
  await appendManifestEvent(manifestPath, eventFor('COMMITTED', record.migrationId))
  states.get(record.migrationId).events.add('COMMITTED')
}

function manifestCandidates(states, options, requiredEvent, excludedEvent) {
  const records = []
  for (const state of states.values()) {
    if (!state.events.has(requiredEvent)) continue
    if (excludedEvent && state.events.has(excludedEvent)) continue
    if (options.videoId && state.prepared.videoId !== options.videoId) continue
    records.push(state.prepared)
  }
  records.sort((left, right) => left.videoId.localeCompare(right.videoId))
  return records
}

async function verifyRecord({ prisma, record, privateToken }) {
  const current = await prisma.video.findUnique({
    where: { id: record.videoId },
    select: { pdfUrl: true },
  })
  if (current?.pdfUrl !== record.protectedUrl) {
    throw new Error('Database no longer references the manifest protected URL')
  }
  await assertPrivatePdf(record, privateToken)
}

async function deletePublicRecord({ prisma, record, privateToken, publicToken }) {
  await verifyRecord({ prisma, record, privateToken })
  const pdfRows = await prisma.video.findMany({
    where: { pdfUrl: { not: null } },
    select: { pdfUrl: true },
  })
  const oldReferences = pdfRows.filter(
    (row) =>
      publicBlobObjectIdentity(row.pdfUrl) ===
      publicBlobObjectIdentity(record.canonicalSourceUrl)
  ).length
  if (oldReferences !== 0) throw new Error('A database row still references the public URL')

  const currentSource = await getBlobMetadata(record.canonicalSourceUrl, publicToken)
  if (!currentSource) return
  if (record.sourceEtag && currentSource.etag !== record.sourceEtag) {
    throw new Error('Public source ETag changed; refusing deletion')
  }
  if (currentSource.size !== record.size) {
    throw new Error('Public source size changed; refusing deletion')
  }

  const downloaded = await downloadLegacyPdf(record.canonicalSourceUrl)
  if (downloaded.size !== record.size || downloaded.sha256 !== record.sha256) {
    throw new Error('Public source content changed; refusing deletion')
  }

  await del(record.canonicalSourceUrl, {
    token: publicToken,
    ifMatch: currentSource.etag,
  })
  const remaining = await getBlobMetadata(record.canonicalSourceUrl, publicToken)
  if (remaining) throw new Error('Public source still exists after deletion')
}

async function runManifestPhase({
  prisma,
  options,
  manifestPath,
  manifest,
  databaseFingerprint,
}) {
  const { states } = manifest
  const requiredEvent = options.phase === 'verify' ? 'COMMITTED' : 'VERIFIED'
  const excludedEvent = options.phase === 'verify' ? 'VERIFIED' : 'DELETED'
  const candidates = manifestCandidates(states, options, requiredEvent, excludedEvent)
  const selected = selectWithLimit(candidates, options.limit)
  const digest = candidateDigest({
    phase: options.phase,
    options,
    candidateIds: candidates.map((record) => record.migrationId),
    selectedIds: selected.map((record) => record.migrationId),
  })
  console.log(
    JSON.stringify({
      phase: options.phase,
      mode: options.apply ? 'apply' : 'dry-run',
      candidates: candidates.length,
      selected: selected.length,
      candidateDigest: digest,
      databaseFingerprint,
    })
  )
  if (!options.apply) return
  if (options.expectCount !== candidates.length) {
    throw new Error(`Candidate count changed: expected ${options.expectCount}, found ${candidates.length}`)
  }
  if (options.expectDigest !== digest) {
    throw new Error('Candidate digest changed since the dry-run')
  }

  const privateToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!privateToken) throw new Error('BLOB_PRIVATE_READ_WRITE_TOKEN is required')
  await ensureManifestContext({
    manifest,
    manifestPath,
    options,
    databaseFingerprint,
    privateToken,
  })
  const publicToken = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (options.phase === 'delete') {
    if (!publicToken) throw new Error('BLOB_READ_WRITE_TOKEN is required for delete')
    if (publicToken === privateToken) throw new Error('Public and private Blob tokens must differ')
  }

  let succeeded = 0
  let failed = 0
  for (const record of selected) {
    const label = recordLabel(record.videoId)
    try {
      if (options.phase === 'verify') {
        await verifyRecord({ prisma, record, privateToken })
        await appendManifestEvent(manifestPath, eventFor('VERIFIED', record.migrationId))
      } else {
        await deletePublicRecord({ prisma, record, privateToken, publicToken })
        await appendManifestEvent(manifestPath, eventFor('DELETED', record.migrationId))
      }
      succeeded += 1
      console.log(JSON.stringify({ record: label, status: options.phase }))
    } catch (error) {
      failed += 1
      console.error(
        JSON.stringify({ record: label, status: 'failed', error: safeErrorMessage(error) })
      )
    }
  }
  console.log(JSON.stringify({ phase: options.phase, succeeded, failed }))
  if (failed > 0) process.exitCode = 1
}

async function runMigratePhase({
  prisma,
  options,
  manifestPath,
  manifest,
  databaseFingerprint,
}) {
  const { states } = manifest
  const { eligible, unsupported } = await inventory(prisma, options)
  if (unsupported > 0) throw new Error('Unsupported PDF URL formats require manual review')
  const recoveries = await findPreparedRecoveries(prisma, states, options)
  const workItems = [
    ...eligible.map((video) => ({
      kind: 'migrate',
      video,
      videoId: video.id,
      migrationId: migrationIdFor(video.id, video.pdfUrl),
    })),
    ...recoveries.map((record) => ({
      kind: 'reconcile',
      record,
      videoId: record.videoId,
      migrationId: record.migrationId,
    })),
  ].sort((left, right) => left.videoId.localeCompare(right.videoId))
  const selected = selectWithLimit(workItems, options.limit)
  const digest = candidateDigest({
    phase: 'migrate',
    options,
    candidateIds: workItems.map((item) => item.migrationId),
    selectedIds: selected.map((item) => item.migrationId),
  })
  console.log(
    JSON.stringify({
      phase: 'migrate',
      mode: options.apply ? 'apply' : 'dry-run',
      candidates: workItems.length,
      selected: selected.length,
      preparedNeedsReconcile: recoveries.length,
      candidateDigest: digest,
      databaseFingerprint,
    })
  )
  if (!options.apply) return
  if (options.expectCount !== workItems.length) {
    throw new Error(`Candidate count changed: expected ${options.expectCount}, found ${workItems.length}`)
  }
  if (options.expectDigest !== digest) {
    throw new Error('Candidate digest changed since the dry-run')
  }

  const privateToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!privateToken) throw new Error('BLOB_PRIVATE_READ_WRITE_TOKEN is required for migrate')
  await ensureManifestContext({
    manifest,
    manifestPath,
    options,
    databaseFingerprint,
    privateToken,
  })

  let succeeded = 0
  let failed = 0
  for (const item of selected) {
    const label = recordLabel(item.videoId)
    try {
      if (item.kind === 'reconcile') {
        await reconcilePreparedRecord({
          record: item.record,
          privateToken,
          manifestPath,
          states,
        })
      } else {
        await migrateRecord({
          prisma,
          video: item.video,
          privateToken,
          manifestPath,
          states,
        })
      }
      succeeded += 1
      console.log(JSON.stringify({ record: label, status: 'migrated' }))
    } catch (error) {
      failed += 1
      console.error(
        JSON.stringify({ record: label, status: 'failed', error: safeErrorMessage(error) })
      )
    }
  }
  console.log(JSON.stringify({ phase: 'migrate', succeeded, failed }))
  if (failed > 0) process.exitCode = 1
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const databaseUrl = getOperationsDatabaseUrl()
  const databaseFingerprint = fingerprint(databaseUrl)

  const { pool, prisma } = createPrisma(databaseUrl)
  let releaseLock = null
  try {
    if (options.phase === 'inventory') {
      await inventory(prisma, options)
      return
    }

    const manifestPath = await ensureManifestFile(options.manifestPath)
    const manifest = await loadManifest(manifestPath)
    releaseLock = await acquireAdvisoryLock(databaseUrl)

    if (options.phase === 'migrate') {
      await runMigratePhase({
        prisma,
        options,
        manifestPath,
        manifest,
        databaseFingerprint,
      })
    } else {
      await runManifestPhase({
        prisma,
        options,
        manifestPath,
        manifest,
        databaseFingerprint,
      })
    }
  } finally {
    let cleanupError = null
    if (releaseLock) {
      try {
        await releaseLock()
      } catch (error) {
        cleanupError = error
      }
    }
    try {
      await prisma.$disconnect()
    } catch (error) {
      cleanupError ??= error
    }
    try {
      await pool.end()
    } catch (error) {
      cleanupError ??= error
    }
    if (cleanupError) throw cleanupError
  }
}

main().catch((error) => {
  console.error(`Private PDF migration failed: ${safeErrorMessage(error)}`)
  process.exitCode = 1
})
