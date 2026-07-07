import 'server-only'

import { clerkClient } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { TradingViewService } from '@/lib/indicators/tradingview'
import type {
  AdminIndicatorClaimQueueItem,
  AdminIndicatorClaimQueueSummary,
  AdminIndicatorClaimRetrySummary,
  AdminIndicatorOverview,
  AdminTradingViewAccountBinding,
  ClaimIndicatorActionResult,
  Indicator,
  IndicatorClaim,
  IndicatorClaimStatus,
  IndicatorPackage,
  RebindRevokeSummary,
  TradingViewAccountBinding,
  TradingViewSessionMeta,
} from '@/lib/indicators/types'

const TV_COOKIE_SETTING_KEY = 'tradingViewIndicatorCookie'

const VALID_CLAIM_STATUSES = new Set<IndicatorClaimStatus>([
  'pending',
  'processing',
  'granted',
  'failed',
  'needs_session',
  'revoked',
])

function toIso(date: Date | string | null | undefined) {
  if (!date) return null
  return typeof date === 'string' ? date : date.toISOString()
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeTradingViewUsername(value: string) {
  let v = String(value || '').trim()
  // Kunden pasten gern ihre Profil-URL oder "@name" — beides auf den nackten
  // Username reduzieren, bevor validiert/gespeichert wird.
  const urlMatch = v.match(/tradingview\.com\/u\/([A-Za-z0-9_\-.]+)/i)
  if (urlMatch) v = urlMatch[1]
  return v.replace(/^@+/, '').replace(/\/+$/, '').replace(/\s+/g, '')
}

function normalizedTradingViewKey(value: string) {
  return normalizeTradingViewUsername(value).toLowerCase()
}

function asClaimStatus(value: string): IndicatorClaimStatus {
  return VALID_CLAIM_STATUSES.has(value as IndicatorClaimStatus)
    ? (value as IndicatorClaimStatus)
    : 'pending'
}

function cookiePreview(cookie: string) {
  const value = cookie.trim()
  if (!value) return null
  if (value.includes('=')) {
    const sessionMatch = value.match(/(?:^|;\s*)sessionid=([^;]+)/i)
    if (sessionMatch?.[1]) {
      return `sessionid=${sessionMatch[1].slice(0, 6)}...${sessionMatch[1].slice(-4)}`
    }
    const first = value.split(';')[0]?.trim() ?? 'cookie'
    return `${first.slice(0, 18)}...`
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function parseSessionSetting(value: unknown): { cookie: string; savedAt: string | null; savedBy: string | null } {
  if (!value || typeof value !== 'object') return { cookie: '', savedAt: null, savedBy: null }
  const record = value as Record<string, unknown>
  return {
    cookie: typeof record.cookie === 'string' ? record.cookie : '',
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : null,
    savedBy: typeof record.savedBy === 'string' ? record.savedBy : null,
  }
}

function asIndicator(row: {
  id: string
  packageId: string | null
  slug: string
  name: string
  shortDescription: string | null
  detailDescription: string | null
  usageGuide: string | null
  pineId: string | null
  imageUrl: string | null
  ready: boolean
  visible: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): Indicator {
  const shortDescription = row.shortDescription ?? ''
  const detailDescription = row.detailDescription ?? ''

  return {
    id: row.id,
    packageId: row.packageId,
    slug: row.slug,
    name: row.name,
    shortDescription:
      shortDescription === `TradingView indicator - ${row.name}` ||
      shortDescription === 'Imported from TradingView.'
        ? ''
        : shortDescription,
    detailDescription:
      detailDescription ===
        'Invite-only TradingView indicator. Review copy and visibility before publishing to members.' ||
      detailDescription === 'Imported from TradingView. Publish as invite-only before making this claimable.'
        ? ''
        : detailDescription,
    usageGuide: row.usageGuide ?? '',
    pineId: row.pineId ?? '',
    imageUrl: row.imageUrl,
    ready: row.ready,
    visible: row.visible,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function asPackage(row: {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  visible: boolean
  indicators?: Array<Parameters<typeof asIndicator>[0]>
}): IndicatorPackage {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    sortOrder: row.sortOrder,
    visible: row.visible,
    indicators: (row.indicators ?? []).map(asIndicator),
  }
}

function asClaim(row: {
  id: string
  indicatorId: string
  tvUsername: string
  status: string
  errorMessage: string | null
  claimedAt: Date | null
  attemptCount: number
  nextRetryAt: Date | null
  lastAttemptAt: Date | null
}): IndicatorClaim {
  return {
    id: row.id,
    indicatorId: row.indicatorId,
    tvUsername: row.tvUsername,
    status: asClaimStatus(row.status),
    errorMessage: row.errorMessage,
    claimedAt: toIso(row.claimedAt),
    attemptCount: row.attemptCount,
    nextRetryAt: toIso(row.nextRetryAt),
    lastAttemptAt: toIso(row.lastAttemptAt),
  }
}

function asTradingViewAccount(row: {
  userId: string
  tvUsername: string
  tvUsernameNormalized: string
  verificationStatus: string
  createdAt: Date
  updatedAt: Date
}): TradingViewAccountBinding {
  return {
    userId: row.userId,
    tvUsername: row.tvUsername,
    normalizedUsername: row.tvUsernameNormalized,
    verificationStatus: row.verificationStatus === 'verified' ? 'verified' : 'unverified',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function asAdminQueueClaim(row: {
  id: string
  userId: string
  indicatorId: string
  tvUsername: string
  status: string
  errorMessage: string | null
  claimedAt: Date | null
  attemptCount: number
  nextRetryAt: Date | null
  lastAttemptAt: Date | null
  lastErrorCode: string | null
  lastWorkerId: string | null
  updatedAt: Date
  indicator: { name: string } | null
}): AdminIndicatorClaimQueueItem {
  return {
    id: row.id,
    userId: row.userId,
    indicatorId: row.indicatorId,
    indicatorName: row.indicator?.name ?? 'Unknown indicator',
    tvUsername: row.tvUsername,
    status: asClaimStatus(row.status),
    errorMessage: row.errorMessage,
    claimedAt: toIso(row.claimedAt),
    attemptCount: row.attemptCount,
    nextRetryAt: toIso(row.nextRetryAt),
    lastAttemptAt: toIso(row.lastAttemptAt),
    lastErrorCode: row.lastErrorCode,
    lastWorkerId: row.lastWorkerId,
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function uniqueIndicatorSlug(name: string, fallbackPrefix: string) {
  const base = normalizeSlug(name) || `${fallbackPrefix}-${Date.now()}`
  let slug = base
  let suffix = 2

  while (await prisma.indicator.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`
    suffix += 1
  }

  return slug
}

async function uniquePackageSlug(name: string) {
  const base = normalizeSlug(name) || `package-${Date.now()}`
  let slug = base
  let suffix = 2

  while (await prisma.indicatorPackage.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`
    suffix += 1
  }

  return slug
}

export async function getTradingViewSessionMeta(): Promise<TradingViewSessionMeta> {
  const setting = await withPrismaRetry(
    () =>
      prisma.adminSetting.findUnique({
        where: { key: TV_COOKIE_SETTING_KEY },
        select: { value: true },
      }),
    { label: 'Load TradingView cookie setting' }
  )

  const parsed = parseSessionSetting(setting?.value)
  return {
    configured: Boolean(parsed.cookie),
    savedAt: parsed.savedAt,
    savedBy: parsed.savedBy,
    preview: parsed.cookie ? cookiePreview(parsed.cookie) : null,
  }
}

export async function getTvSessionSecret() {
  const setting = await withPrismaRetry(
    () =>
      prisma.adminSetting.findUnique({
        where: { key: TV_COOKIE_SETTING_KEY },
        select: { value: true },
      }),
    { label: 'Load TradingView cookie secret' }
  )

  return parseSessionSetting(setting?.value).cookie
}

export async function saveTradingViewCookie(input: { cookie: string; savedBy: string }) {
  const cookie = input.cookie.trim()
  if (!cookie) throw new Error('TradingView cookie is required.')

  const savedAt = new Date().toISOString()
  await withPrismaRetry(
    () =>
      prisma.adminSetting.upsert({
        where: { key: TV_COOKIE_SETTING_KEY },
        create: {
          key: TV_COOKIE_SETTING_KEY,
          value: { cookie, savedAt, savedBy: input.savedBy },
        },
        update: {
          value: { cookie, savedAt, savedBy: input.savedBy },
        },
      }),
    { label: 'Save TradingView cookie' }
  )

  return new TradingViewService(cookie).testSession()
}

export async function clearTradingViewCookie() {
  await withPrismaRetry(
    () => prisma.adminSetting.deleteMany({ where: { key: TV_COOKIE_SETTING_KEY } }),
    { label: 'Clear TradingView cookie' }
  )
}

async function listPackages(onlyVisible = false) {
  const packages = await withPrismaRetry(
    () =>
      prisma.indicatorPackage.findMany({
        where: onlyVisible ? { visible: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          indicators: {
            where: onlyVisible ? { visible: true } : undefined,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
      }),
    { label: 'Load indicator packages' }
  )

  return packages.map(asPackage)
}

export async function getIndicatorAdminOverview(): Promise<AdminIndicatorOverview> {
  const [packages, unassignedIndicators, tradingViewAccounts, claimQueue, tradingViewSession] =
    await Promise.all([
      listPackages(false),
      withPrismaRetry(
        () =>
          prisma.indicator.findMany({
            where: { packageId: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          }),
        { label: 'Load unassigned indicators' }
      ).then((rows) => rows.map(asIndicator)),
      listTradingViewAccountBindings(),
      getTradingViewClaimQueueSummary(),
      getTradingViewSessionMeta(),
    ])

  return {
    packages,
    unassignedIndicators,
    tradingViewAccounts,
    claimQueue,
    tradingViewSession,
  }
}

export async function listVisibleIndicatorPackages() {
  const packages = await listPackages(true)
  return packages.filter((pkg) => pkg.visible && pkg.indicators.length > 0)
}

export async function listIndicatorClaimsForUser(userId: string) {
  const claims = await withPrismaRetry(
    () =>
      prisma.indicatorClaim.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
    { label: 'Load indicator claims for user' }
  )

  return claims.map(asClaim)
}

export async function getTradingViewAccountForUser(userId: string) {
  const account = await withPrismaRetry(
    () => prisma.userTradingViewAccount.findUnique({ where: { userId } }),
    { label: 'Load TradingView account binding' }
  )

  return account ? asTradingViewAccount(account) : null
}

async function loadClerkEmails(userIds: string[]) {
  const emails = new Map<string, string | null>()
  const client = await clerkClient().catch(() => null)
  if (!client) return emails

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const user = await client.users.getUser(userId)
        const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
        emails.set(userId, primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null)
      } catch {
        emails.set(userId, null)
      }
    })
  )

  return emails
}

export async function listTradingViewAccountBindings(): Promise<AdminTradingViewAccountBinding[]> {
  const [accounts, claimRows] = await Promise.all([
    withPrismaRetry(
      () => prisma.userTradingViewAccount.findMany({ orderBy: { updatedAt: 'desc' } }),
      { label: 'Load TradingView account bindings' }
    ),
    withPrismaRetry(
      () => prisma.indicatorClaim.findMany({ select: { userId: true, status: true } }),
      { label: 'Load TradingView account claim counts' }
    ),
  ])

  const counts = new Map<string, { claimCount: number; grantedCount: number }>()
  for (const row of claimRows) {
    const current = counts.get(row.userId) ?? { claimCount: 0, grantedCount: 0 }
    current.claimCount += 1
    if (row.status === 'granted') current.grantedCount += 1
    counts.set(row.userId, current)
  }

  const emails = await loadClerkEmails(accounts.map((account) => account.userId))

  return accounts.map((row) => ({
    ...asTradingViewAccount(row),
    email: emails.get(row.userId) ?? null,
    ...(counts.get(row.userId) ?? { claimCount: 0, grantedCount: 0 }),
  }))
}

export async function getTradingViewClaimQueueSummary(): Promise<AdminIndicatorClaimQueueSummary> {
  const [claimRows, heartbeat, recentClaims, cookie] = await Promise.all([
    withPrismaRetry(
      () =>
        prisma.indicatorClaim.findMany({
          select: {
            status: true,
            errorMessage: true,
            nextRetryAt: true,
            lastAttemptAt: true,
          },
          orderBy: [{ lastAttemptAt: 'desc' }, { updatedAt: 'desc' }],
        }),
      { label: 'Load TradingView claim queue counts' }
    ),
    withPrismaRetry(
      () => prisma.indicatorWorkerHeartbeat.findFirst({ orderBy: { lastSeenAt: 'desc' } }),
      { label: 'Load TradingView worker heartbeat' }
    ),
    withPrismaRetry(
      () =>
        prisma.indicatorClaim.findMany({
          include: { indicator: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
      { label: 'Load recent TradingView claims' }
    ),
    getTvSessionSecret(),
  ])

  const now = Date.now()
  const staleCutoff = now - 15 * 60 * 1000
  const counts = {
    total: 0,
    pending: 0,
    processing: 0,
    needsSession: 0,
    failed: 0,
    granted: 0,
    revoked: 0,
    retryable: 0,
    staleProcessing: 0,
    lastAttemptAt: null as string | null,
    lastErrorMessage: null as string | null,
  }

  for (const row of claimRows) {
    const status = asClaimStatus(row.status)
    counts.total += 1
    if (status === 'pending') counts.pending += 1
    if (status === 'processing') counts.processing += 1
    if (status === 'needs_session') counts.needsSession += 1
    if (status === 'failed') counts.failed += 1
    if (status === 'granted') counts.granted += 1
    if (status === 'revoked') counts.revoked += 1
    if (
      (status === 'pending' || status === 'failed' || status === 'needs_session') &&
      (!row.nextRetryAt || row.nextRetryAt.getTime() <= now)
    ) {
      counts.retryable += 1
    }
    if (
      status === 'processing' &&
      row.lastAttemptAt &&
      row.lastAttemptAt.getTime() < staleCutoff
    ) {
      counts.staleProcessing += 1
    }
    if (!counts.lastAttemptAt && row.lastAttemptAt) counts.lastAttemptAt = row.lastAttemptAt.toISOString()
    if (!counts.lastErrorMessage && row.errorMessage) counts.lastErrorMessage = row.errorMessage
  }

  const session = cookie
    ? await new TradingViewService(cookie).testSession()
    : {
        success: false,
        message: 'No TradingView cookie saved.',
        code: 'not_configured' as const,
      }

  return {
    ...counts,
    recentClaims: recentClaims.map(asAdminQueueClaim),
    workerHeartbeat: heartbeat
      ? {
          workerId: heartbeat.workerId,
          status:
            heartbeat.status === 'running' || heartbeat.status === 'blocked' || heartbeat.status === 'failed'
              ? heartbeat.status
              : 'idle',
          lastSeenAt: heartbeat.lastSeenAt.toISOString(),
          processedCount: heartbeat.processedCount,
          grantedCount: heartbeat.grantedCount,
          failedCount: heartbeat.failedCount,
          lastError: heartbeat.lastError,
        }
      : null,
    session: {
      configured: Boolean(cookie),
      ok: session.success,
      checkedAt: new Date().toISOString(),
      message: session.message,
    },
  }
}

export async function createIndicatorPackage(input: {
  name: string
  description: string
  visible: boolean
  sortOrder: number
}) {
  const name = input.name.trim()
  if (!name) throw new Error('Package name is required.')

  const slug = await uniquePackageSlug(name)
  await withPrismaRetry(
    () =>
      prisma.indicatorPackage.create({
        data: {
          slug,
          name,
          description: input.description.trim() || null,
          visible: input.visible,
          sortOrder: input.sortOrder,
        },
      }),
    { label: 'Create indicator package' }
  )
}

export async function updateIndicatorPackage(
  id: string,
  input: { name: string; description: string; visible: boolean; sortOrder: number }
) {
  const name = input.name.trim()
  if (!name) throw new Error('Package name is required.')

  await withPrismaRetry(
    () =>
      prisma.indicatorPackage.update({
        where: { id },
        data: {
          name,
          description: input.description.trim() || null,
          visible: input.visible,
          sortOrder: input.sortOrder,
        },
      }),
    { label: 'Update indicator package' }
  )
}

export async function createIndicator(input: {
  packageId: string | null
  name: string
  shortDescription: string
  detailDescription: string
  usageGuide: string
  pineId: string
  ready: boolean
  visible: boolean
  sortOrder: number
}) {
  const name = input.name.trim()
  if (!name) throw new Error('Indicator name is required.')

  const slug = await uniqueIndicatorSlug(name, 'indicator')
  await withPrismaRetry(
    () =>
      prisma.indicator.create({
        data: {
          packageId: input.packageId,
          slug,
          name,
          shortDescription: input.shortDescription.trim() || null,
          detailDescription: input.detailDescription.trim() || null,
          usageGuide: input.usageGuide.trim() || null,
          pineId: input.pineId.trim() || null,
          ready: input.ready,
          visible: input.visible,
          sortOrder: input.sortOrder,
        },
      }),
    { label: 'Create indicator' }
  )
}

export async function updateIndicator(
  id: string,
  input: {
    packageId: string | null
    name: string
    shortDescription: string
    detailDescription: string
    usageGuide: string
    pineId: string
    ready: boolean
    visible: boolean
    sortOrder: number
  }
) {
  const name = input.name.trim()
  if (!name) throw new Error('Indicator name is required.')

  await withPrismaRetry(
    () =>
      prisma.indicator.update({
        where: { id },
        data: {
          packageId: input.packageId,
          name,
          shortDescription: input.shortDescription.trim() || null,
          detailDescription: input.detailDescription.trim() || null,
          usageGuide: input.usageGuide.trim() || null,
          pineId: input.pineId.trim() || null,
          ready: input.ready,
          visible: input.visible,
          sortOrder: input.sortOrder,
        },
      }),
    { label: 'Update indicator' }
  )
}

export async function updateIndicatorImage(id: string, imageUrl: string | null) {
  await withPrismaRetry(
    () => prisma.indicator.update({ where: { id }, data: { imageUrl } }),
    { label: 'Update indicator image' }
  )
}

export async function importTradingViewIndicators(packageId: string | null) {
  const sessionCookie = await getTvSessionSecret()
  const tv = new TradingViewService(sessionCookie)

  if (!tv.isConfigured) {
    throw new Error('TradingView cookie is not configured.')
  }

  const scripts = await tv.listOwnedScripts()
  if (scripts.length === 0) {
    return { imported: 0, skipped: 0, total: 0 }
  }

  const existingIndicators = await withPrismaRetry(
    () => prisma.indicator.findMany({ select: { pineId: true, slug: true } }),
    { label: 'Load existing indicators for import' }
  )
  const existingPineIds = new Set(existingIndicators.map((row) => row.pineId).filter(Boolean))
  const existingSlugs = new Set(existingIndicators.map((row) => row.slug))

  let imported = 0
  let skipped = 0

  for (const script of scripts) {
    const pineId = script.scriptIdPart
    if (!pineId || existingPineIds.has(pineId)) {
      skipped += 1
      continue
    }

    const shortId = pineId.replace('PUB;', '').replace('USER;', '').slice(0, 8)
    let slug = normalizeSlug(script.scriptName || `tv-${shortId}`) || `tv-${shortId}`
    if (existingSlugs.has(slug)) slug = `${slug}-${shortId}`
    existingSlugs.add(slug)

    const isClaimable = pineId.startsWith('PUB;') && script.scriptAccess === 'closed_needs_auth'
    await withPrismaRetry(
      () =>
        prisma.indicator.create({
          data: {
            packageId,
            slug,
            name: script.scriptName || `TradingView Script ${shortId}`,
            shortDescription: null,
            detailDescription: null,
            pineId,
            ready: isClaimable,
            visible: false,
            sortOrder: 99,
            metadata: {
              source: 'tradingview_import',
              script_access: script.scriptAccess ?? null,
            },
          },
        }),
      { label: 'Import TradingView indicator' }
    )

    existingPineIds.add(pineId)
    imported += 1
  }

  return { imported, skipped, total: scripts.length }
}

async function writeClaimAudit(input: {
  userId: string
  indicatorId?: string | null
  tvUsername: string
  action: 'claim' | 'revoke' | 'validate'
  result: 'success' | 'failure'
  errorCode?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.indicatorClaimAudit.create({
      data: {
        userId: input.userId,
        indicatorId: input.indicatorId ?? null,
        tvUsername: input.tvUsername,
        action: input.action,
        result: input.result,
        errorCode: input.errorCode ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
      },
    })
  } catch {
    // Audit visibility is useful, but it should never block member access.
  }
}

async function bindTradingViewAccountForUser(input: {
  userId: string
  requestedUsername: string
  exactUsername: string
}): Promise<{ ok: true; account: TradingViewAccountBinding } | { ok: false; message: string }> {
  const requestedKey = normalizedTradingViewKey(input.requestedUsername)
  const existing = await prisma.userTradingViewAccount.findUnique({ where: { userId: input.userId } })

  if (existing) {
    const account = asTradingViewAccount(existing)
    if (requestedKey && requestedKey !== account.normalizedUsername) {
      return {
        ok: false,
        message: `Dieses Mitgliedskonto ist bereits mit @${account.tvUsername} verknüpft. Bitte Support kontaktieren, um das zu ändern.`,
      }
    }

    return { ok: true, account }
  }

  try {
    const created = await prisma.userTradingViewAccount.create({
      data: {
        userId: input.userId,
        tvUsername: input.exactUsername,
        tvUsernameNormalized: normalizedTradingViewKey(input.exactUsername),
        verificationStatus: 'unverified',
      },
    })

    return { ok: true, account: asTradingViewAccount(created) }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: `@${input.exactUsername} ist bereits mit einem anderen Mitgliedskonto verknüpft.`,
      }
    }
    throw error
  }
}

// Best-Effort-Auto-Revoke beim Rebind: entzieht dem ALTEN TradingView-Namen
// die vorhandenen Grants über die gleiche Session-Cookie-Infrastruktur wie
// die Grants (POST /pine_perm/remove/). WICHTIG: darf NIE werfen und den
// Claim des neuen Namens NIE blockieren — auch wenn der alte Name nie ein
// echter TradingView-Account war oder nie Zugang hatte. Fehler werden nur
// geloggt, auditiert und im Summary zurückgemeldet (Telegram-Warnung).
async function revokeOldGrantsAfterRebind(input: {
  userId: string
  oldUsername: string
  newUsername: string
}): Promise<RebindRevokeSummary> {
  const summary: RebindRevokeSummary = { attempted: 0, revoked: 0, failed: 0, firstError: null }

  try {
    // Nur Claims, bei denen auf TradingView-Seite überhaupt ein Grant
    // existieren kann: granted/processing oder mindestens ein Worker-Versuch.
    // Reine pending-Claims (z. B. Tippfehler, Worker lief nie) haben nichts,
    // das man entziehen könnte — attempted bleibt dann 0.
    const claims = await prisma.indicatorClaim.findMany({
      where: {
        userId: input.userId,
        OR: [{ status: { in: ['granted', 'processing'] } }, { attemptCount: { gt: 0 } }],
      },
      include: { indicator: { select: { pineId: true } } },
    })

    const revocable = claims.flatMap((claim) => {
      const pineId = claim.indicator?.pineId
      return pineId ? [{ indicatorId: claim.indicatorId, tvUsername: claim.tvUsername, pineId }] : []
    })
    if (revocable.length === 0) return summary

    const tv = new TradingViewService(await getTvSessionSecret())
    if (!tv.isConfigured) {
      summary.attempted = revocable.length
      summary.failed = revocable.length
      summary.firstError = 'TradingView cookie is not configured.'
      console.error('[indicators] rebind auto-revoke skipped: TradingView cookie not configured', {
        userId: input.userId,
        from: input.oldUsername,
        to: input.newUsername,
      })
      return summary
    }

    for (const claim of revocable) {
      summary.attempted += 1
      const revokeUsername = claim.tvUsername || input.oldUsername
      let result: { success: boolean; message: string }
      try {
        result = await tv.revokeAccess(revokeUsername, claim.pineId)
      } catch (error) {
        result = {
          success: false,
          message: error instanceof Error ? error.message : 'TradingView revoke failed.',
        }
      }

      if (result.success) {
        summary.revoked += 1
      } else {
        summary.failed += 1
        if (!summary.firstError) summary.firstError = result.message
        console.error('[indicators] rebind auto-revoke failed:', {
          userId: input.userId,
          from: input.oldUsername,
          to: input.newUsername,
          indicatorId: claim.indicatorId,
          message: result.message,
        })
      }

      await writeClaimAudit({
        userId: input.userId,
        indicatorId: claim.indicatorId,
        tvUsername: revokeUsername,
        action: 'revoke',
        result: result.success ? 'success' : 'failure',
        errorCode: result.success ? undefined : result.message,
        metadata: {
          reason: 'rebind_auto_revoke',
          from: input.oldUsername,
          to: input.newUsername,
          message: result.message,
        },
      })
    }
  } catch (error) {
    // Selbst das Laden der Claims darf den Rebind nicht stoppen.
    summary.failed = Math.max(summary.failed, 1)
    if (!summary.firstError) {
      summary.firstError = error instanceof Error ? error.message : 'Auto-revoke failed unexpectedly.'
    }
    console.error('[indicators] rebind auto-revoke crashed (non-fatal):', error)
  }

  return summary
}

export async function claimIndicatorForUser(input: {
  userId: string
  indicatorId: string
  tvUsername: string
  // Raid-Map-Self-Service: erlaubt das Umhaengen auf einen NEUEN TradingView-
  // Namen (Mentorship-Flows lassen das weiter bewusst nicht zu).
  allowRebind?: boolean
}): Promise<ClaimIndicatorActionResult> {
  const requestedTvUsername = normalizeTradingViewUsername(input.tvUsername)

  if (requestedTvUsername.length < 2) {
    return { ok: false, indicatorId: input.indicatorId, message: 'Gib einen gültigen TradingView-Benutzernamen ein.' }
  }

  const indicator = await withPrismaRetry(
    () =>
      prisma.indicator.findUnique({
        where: { id: input.indicatorId },
        select: { id: true, name: true, pineId: true, ready: true, visible: true },
      }),
    { label: 'Load claimable indicator' }
  )

  if (!indicator || !indicator.visible) {
    return { ok: false, indicatorId: input.indicatorId, message: 'Dieser Indikator ist nicht verfügbar.' }
  }

  if (!indicator.ready || !indicator.pineId?.startsWith('PUB;')) {
    return {
      ok: false,
      indicatorId: input.indicatorId,
      message: 'Dieser Indikator ist noch nicht claimbar.',
    }
  }

  const existingAccount = await prisma.userTradingViewAccount.findUnique({ where: { userId: input.userId } })
  let linkedAccount = existingAccount ? asTradingViewAccount(existingAccount) : null
  let tvUsername = requestedTvUsername
  let reboundFrom: string | undefined
  let rebindRevoke: RebindRevokeSummary | undefined

  if (linkedAccount) {
    const requestedKey = normalizedTradingViewKey(requestedTvUsername)
    if (requestedKey !== linkedAccount.normalizedUsername) {
      if (!input.allowRebind) {
        await writeClaimAudit({
          userId: input.userId,
          indicatorId: input.indicatorId,
          tvUsername: requestedTvUsername,
          action: 'claim',
          result: 'failure',
          errorCode: 'account_mismatch',
          metadata: { linked_username: linkedAccount.tvUsername },
        })

        return {
          ok: false,
          indicatorId: input.indicatorId,
          tvUsername: linkedAccount.tvUsername,
          message: `Dieses Mitgliedskonto ist bereits mit @${linkedAccount.tvUsername} verknüpft.`,
        }
      }

      // Rebind: neuen Namen erst gegen TradingView validieren, dann Konto
      // umhaengen. Danach wird der ALTE Grant auf TradingView-Seite best
      // effort automatisch entzogen (revokeOldGrantsAfterRebind); schlaegt
      // das fehl, bleibt "Manage access" der manuelle Fallback (Telegram).
      const revalidation = await new TradingViewService().validateUsername(requestedTvUsername)
      if (!revalidation.valid) {
        await writeClaimAudit({
          userId: input.userId,
          indicatorId: input.indicatorId,
          tvUsername: requestedTvUsername,
          action: 'claim',
          result: 'failure',
          errorCode: 'invalid_username',
          metadata: { reason: 'rebind_validation' },
        })
        return {
          ok: false,
          indicatorId: input.indicatorId,
          tvUsername: requestedTvUsername,
          message: `TradingView-Benutzername "${requestedTvUsername}" wurde nicht gefunden.`,
        }
      }

      try {
        const updated = await prisma.userTradingViewAccount.update({
          where: { userId: input.userId },
          data: {
            tvUsername: revalidation.exactName,
            tvUsernameNormalized: normalizedTradingViewKey(revalidation.exactName),
            verificationStatus: 'unverified',
          },
        })
        reboundFrom = linkedAccount.tvUsername
        linkedAccount = asTradingViewAccount(updated)
        tvUsername = linkedAccount.tvUsername
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return {
            ok: false,
            indicatorId: input.indicatorId,
            tvUsername: requestedTvUsername,
            message: `@${requestedTvUsername} ist bereits mit einem anderen Mitgliedskonto verknüpft.`,
          }
        }
        throw error
      }

      // Auto-Revoke der alten Grants — best effort, blockiert den neuen
      // Claim nie (auch nicht, wenn der alte Name nie Zugang hatte).
      rebindRevoke = await revokeOldGrantsAfterRebind({
        userId: input.userId,
        oldUsername: reboundFrom,
        newUsername: tvUsername,
      })

      await writeClaimAudit({
        userId: input.userId,
        indicatorId: input.indicatorId,
        tvUsername,
        action: 'revoke',
        result: 'success',
        metadata: {
          reason: 'rebind',
          from: reboundFrom,
          to: tvUsername,
          auto_revoke: {
            attempted: rebindRevoke.attempted,
            revoked: rebindRevoke.revoked,
            failed: rebindRevoke.failed,
            first_error: rebindRevoke.firstError,
          },
          note:
            rebindRevoke.failed > 0
              ? 'auto-revoke failed — old TradingView grant must be removed manually via Manage access'
              : rebindRevoke.attempted === 0
                ? 'no old TradingView grant existed — nothing to revoke'
                : 'old TradingView grant revoked automatically',
        },
      })
    } else {
      tvUsername = linkedAccount.tvUsername
    }
  }

  const existingClaim = await prisma.indicatorClaim.findUnique({
    where: { userId_indicatorId: { userId: input.userId, indicatorId: input.indicatorId } },
  })

  if (!reboundFrom && existingClaim?.status === 'granted') {
    return {
      ok: true,
      indicatorId: input.indicatorId,
      tvUsername,
      claimStatus: 'granted',
      message: `${indicator.name} ist bereits für @${tvUsername} aktiv.`,
    }
  }

  if (
    !reboundFrom &&
    (existingClaim?.status === 'pending' ||
      existingClaim?.status === 'processing' ||
      existingClaim?.status === 'needs_session')
  ) {
    return {
      ok: true,
      indicatorId: input.indicatorId,
      tvUsername,
      claimStatus: asClaimStatus(existingClaim.status),
      message: existingClaim.errorMessage ?? 'Deine TradingView-Freigabe ist bereits in der Queue.',
    }
  }

  const validation = linkedAccount
    ? { valid: true, exactName: linkedAccount.tvUsername }
    : await new TradingViewService().validateUsername(tvUsername)

  if (!validation.valid) {
    await writeClaimAudit({
      userId: input.userId,
      indicatorId: input.indicatorId,
      tvUsername,
      action: 'claim',
      result: 'failure',
      errorCode: 'invalid_username',
    })
    return {
      ok: false,
      indicatorId: input.indicatorId,
      tvUsername,
      message: `TradingView-Benutzername "${tvUsername}" wurde nicht gefunden.`,
    }
  }

  if (!linkedAccount) {
    const binding = await bindTradingViewAccountForUser({
      userId: input.userId,
      requestedUsername: tvUsername,
      exactUsername: validation.exactName,
    })

    if (!binding.ok) {
      await writeClaimAudit({
        userId: input.userId,
        indicatorId: input.indicatorId,
        tvUsername: validation.exactName,
        action: 'claim',
        result: 'failure',
        errorCode: 'account_binding_failed',
      })

      return {
        ok: false,
        indicatorId: input.indicatorId,
        tvUsername: validation.exactName,
        message: binding.message,
      }
    }

    linkedAccount = binding.account
    tvUsername = binding.account.tvUsername
  }

  const now = new Date()
  const memberMessage =
    'Deine Anfrage ist gespeichert. Die TradingView-Freigabe wird verarbeitet; du kannst die Seite schließen und später den Status prüfen.'

  await prisma.indicatorClaim.upsert({
    where: { userId_indicatorId: { userId: input.userId, indicatorId: input.indicatorId } },
    create: {
      userId: input.userId,
      indicatorId: input.indicatorId,
      tvUsername,
      status: 'pending',
      errorMessage: memberMessage,
      nextRetryAt: now,
      tradingViewResponse: {
        source: 'member_claim',
        queued_at: now.toISOString(),
      },
    },
    update: {
      tvUsername,
      status: 'pending',
      errorMessage: memberMessage,
      claimedAt: null,
      revokedAt: null,
      nextRetryAt: now,
      lastErrorCode: null,
      tradingViewResponse: {
        source: 'member_claim',
        queued_at: now.toISOString(),
        previous_status: existingClaim?.status ?? null,
      },
    },
  })

  await writeClaimAudit({
    userId: input.userId,
    indicatorId: input.indicatorId,
    tvUsername,
    action: 'claim',
    result: 'success',
    metadata: { account_locked: true, queued: true, status: 'pending' },
  })

  return {
    ok: true,
    indicatorId: input.indicatorId,
    tvUsername,
    claimStatus: 'pending',
    message: memberMessage,
    reboundFrom,
    rebindRevoke,
  }
}

function retryAtForAttempt(attemptCount: number) {
  const minutes = Math.min(12 * 60, Math.max(5, 2 ** Math.min(attemptCount, 6)))
  return new Date(Date.now() + minutes * 60 * 1000)
}

function memberMessageForTradingViewResult(result: { success: boolean; code?: string }) {
  if (result.success) return null
  if (result.code === 'login_required' || result.code === 'not_configured') {
    return 'Deine Anfrage ist gespeichert. Wir müssen die TradingView-Verbindung aktualisieren, danach wird automatisch erneut versucht.'
  }
  return 'TradingView konnte die Aktivierung noch nicht abschließen. Wir versuchen es erneut und prüfen es im Support.'
}

async function upsertTradingViewWorkerHeartbeat(input: {
  workerId: string
  status: 'idle' | 'running' | 'blocked' | 'failed'
  currentClaimId?: string | null
  processedCount?: number
  grantedCount?: number
  failedCount?: number
  lastError?: string | null
  metadata?: Record<string, unknown>
}) {
  await prisma.indicatorWorkerHeartbeat.upsert({
    where: { workerId: input.workerId },
    create: {
      workerId: input.workerId,
      status: input.status,
      currentClaimId: input.currentClaimId ?? null,
      processedCount: input.processedCount ?? 0,
      grantedCount: input.grantedCount ?? 0,
      failedCount: input.failedCount ?? 0,
      lastError: input.lastError ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
      lastSeenAt: new Date(),
    },
    update: {
      status: input.status,
      currentClaimId: input.currentClaimId ?? null,
      processedCount: input.processedCount ?? 0,
      grantedCount: input.grantedCount ?? 0,
      failedCount: input.failedCount ?? 0,
      lastError: input.lastError ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
      lastSeenAt: new Date(),
    },
  })
}

async function markDueClaimsAsNeedsSession(message: string, code: string) {
  const now = new Date()
  await prisma.indicatorClaim.updateMany({
    where: { status: { in: ['pending', 'processing', 'failed'] } },
    data: {
      status: 'needs_session',
      errorMessage:
        'Deine Anfrage ist gespeichert. Wir müssen die TradingView-Verbindung aktualisieren, danach wird automatisch erneut versucht.',
      nextRetryAt: null,
      lastAttemptAt: now,
      lastErrorCode: code,
      tradingViewResponse: {
        source: 'tradingview_queue_worker',
        blocked_at: now.toISOString(),
        code,
        message,
      },
    },
  })
}

export async function processTradingViewClaimQueue({
  limit = 25,
  workerId = 'admin-manual',
}: {
  limit?: number
  workerId?: string
} = {}): Promise<AdminIndicatorClaimRetrySummary> {
  const tv = new TradingViewService(await getTvSessionSecret())
  const cappedLimit = Math.max(1, Math.min(limit, 100))

  if (!tv.isConfigured) {
    await markDueClaimsAsNeedsSession('TradingView cookie is not configured.', 'not_configured')
    await upsertTradingViewWorkerHeartbeat({
      workerId,
      status: 'blocked',
      lastError: 'TradingView cookie is not configured.',
    })
    return {
      attempted: 0,
      granted: 0,
      failed: 0,
      skipped: 0,
      blockedBySession: true,
      message: 'TradingView cookie is not configured.',
    }
  }

  const session = await tv.testSession()
  if (!session.success) {
    await markDueClaimsAsNeedsSession(session.message, session.code ?? 'login_required')
    await upsertTradingViewWorkerHeartbeat({
      workerId,
      status: 'blocked',
      lastError: session.message,
      metadata: { code: session.code ?? null },
    })
    return {
      attempted: 0,
      granted: 0,
      failed: 0,
      skipped: 0,
      blockedBySession: true,
      message: session.message,
    }
  }

  const staleProcessingCutoff = new Date(Date.now() - 15 * 60 * 1000)
  await prisma.indicatorClaim.updateMany({
    where: { status: 'processing', lastAttemptAt: { lt: staleProcessingCutoff } },
    data: {
      status: 'pending',
      errorMessage: 'Der vorherige TradingView-Prozess war stale. Die Freigabe ist zurück in der Queue.',
      nextRetryAt: new Date(),
      lastErrorCode: 'stale_processing_reset',
    },
  })

  const rows = await prisma.indicatorClaim.findMany({
    where: {
      status: { in: ['pending', 'failed', 'needs_session'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    include: {
      indicator: {
        select: { id: true, name: true, pineId: true, ready: true, visible: true },
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: cappedLimit,
  })

  let attempted = 0
  let granted = 0
  let failed = 0
  let skipped = 0

  await upsertTradingViewWorkerHeartbeat({
    workerId,
    status: rows.length > 0 ? 'running' : 'idle',
  })

  for (const row of rows) {
    await upsertTradingViewWorkerHeartbeat({
      workerId,
      status: 'running',
      currentClaimId: row.id,
      processedCount: attempted,
      grantedCount: granted,
      failedCount: failed,
    })

    const attemptCount = row.attemptCount + 1
    const attemptStartedAt = new Date()
    const lock = await prisma.indicatorClaim.updateMany({
      where: { id: row.id, status: { in: ['pending', 'failed', 'needs_session'] } },
      data: {
        status: 'processing',
        attemptCount,
        lastAttemptAt: attemptStartedAt,
        lastWorkerId: workerId,
        errorMessage: 'TradingView-Freigabe wird verarbeitet.',
      },
    })

    if (lock.count === 0) {
      skipped += 1
      continue
    }

    if (!row.indicator?.pineId || !row.indicator.ready || !row.indicator.visible) {
      skipped += 1
      await prisma.indicatorClaim.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorMessage: 'Indikator ist nicht mehr claimbar. Support muss das prüfen.',
          nextRetryAt: null,
          lastErrorCode: 'indicator_not_claimable',
          tradingViewResponse: {
            source: 'tradingview_queue_worker',
            skipped_at: new Date().toISOString(),
            reason: 'indicator_not_claimable',
          },
        },
      })
      continue
    }

    attempted += 1
    const result = await tv.grantAccess(row.tvUsername, row.indicator.pineId)
    const now = new Date()
    const blockedBySession = result.code === 'login_required' || result.code === 'not_configured'

    await prisma.indicatorClaim.update({
      where: { id: row.id },
      data: {
        status: result.success ? 'granted' : blockedBySession ? 'needs_session' : 'failed',
        errorMessage: memberMessageForTradingViewResult(result),
        claimedAt: result.success ? now : null,
        revokedAt: null,
        nextRetryAt: result.success || blockedBySession ? null : retryAtForAttempt(attemptCount),
        lastErrorCode: result.success ? null : result.code ?? 'tradingview_rejected',
        tradingViewResponse: {
          source: 'tradingview_queue_worker',
          worker_id: workerId,
          attempted_at: now.toISOString(),
          attempt_count: attemptCount,
          success: result.success,
          code: result.code ?? null,
          message: result.message,
        },
      },
    })

    await writeClaimAudit({
      userId: row.userId,
      indicatorId: row.indicatorId,
      tvUsername: row.tvUsername,
      action: 'claim',
      result: result.success ? 'success' : 'failure',
      errorCode: result.success ? undefined : result.code ?? result.message,
      metadata: {
        source: 'tradingview_queue_worker',
        worker_id: workerId,
        attempt_count: attemptCount,
        message: result.message,
      },
    })

    if (result.success) granted += 1
    else failed += 1
  }

  await upsertTradingViewWorkerHeartbeat({
    workerId,
    status: 'idle',
    processedCount: attempted,
    grantedCount: granted,
    failedCount: failed,
  })

  return {
    attempted,
    granted,
    failed,
    skipped,
    blockedBySession: false,
    message:
      attempted === 0
        ? 'Keine TradingView-Claims sind gerade bereit.'
        : `${attempted} TradingView-Claims verarbeitet: ${granted} granted, ${failed} failed, ${skipped} skipped.`,
  }
}

export async function resetTradingViewAccountBinding(userId: string) {
  const account = await getTradingViewAccountForUser(userId)
  if (!account) return { removed: false, revoked: 0, failed: 0 }

  const grantedClaims = await prisma.indicatorClaim.findMany({
    where: { userId, status: 'granted' },
    include: { indicator: { select: { pineId: true } } },
  })

  const tv = new TradingViewService(await getTvSessionSecret())
  let revoked = 0
  let failed = 0

  if (tv.isConfigured) {
    for (const claim of grantedClaims) {
      const pineId = claim.indicator?.pineId
      if (!pineId) continue

      const result = await tv.revokeAccess(claim.tvUsername || account.tvUsername, pineId)
      if (result.success) revoked += 1
      else failed += 1

      await writeClaimAudit({
        userId,
        indicatorId: claim.indicatorId,
        tvUsername: claim.tvUsername || account.tvUsername,
        action: 'revoke',
        result: result.success ? 'success' : 'failure',
        errorCode: result.success ? undefined : result.message,
        metadata: { reason: 'admin_account_reset' },
      })
    }
  } else {
    failed = grantedClaims.length
  }

  await prisma.indicatorClaim.updateMany({
    where: { userId, status: { not: 'revoked' } },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
      errorMessage: tv.isConfigured
        ? 'TradingView-Verknüpfung wurde vom Admin zurückgesetzt.'
        : 'Verknüpfung zurückgesetzt; TradingView-Revocation wurde wegen fehlendem Cookie nicht versucht.',
    },
  })

  await prisma.userTradingViewAccount.delete({ where: { userId } })
  return { removed: true, revoked, failed }
}
