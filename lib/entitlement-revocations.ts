import 'server-only'

import { addRoleToGuildMember, removeRoleFromGuildMember } from '@/lib/discord'
import { evaluateMentorshipRevocationGuard } from '@/lib/indicator-entitlements'
import { getTvSessionSecret } from '@/lib/indicators/store'
import { TradingViewService } from '@/lib/indicators/tradingview'
import { prisma } from '@/lib/prisma'
import { getRaidMapAccessState } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { stripe } from '@/lib/stripe'

export type RevocableEntitlement = 'mentorship' | 'raidmap'

const USER_ID_MAX_LENGTH = 128
const REASON_MAX_LENGTH = 500

function assertQueueInput(userId: string, entitlement: string) {
  if (typeof userId !== 'string' || !userId || userId.length > USER_ID_MAX_LENGTH) {
    throw new Error('Invalid user ID.')
  }
  if (entitlement !== 'mentorship' && entitlement !== 'raidmap') {
    throw new Error('Invalid entitlement.')
  }
}

function retryAtForAttempt(attemptCount: number) {
  const minutes = Math.min(12 * 60, Math.max(5, 2 ** Math.min(attemptCount, 6)))
  return new Date(Date.now() + minutes * 60 * 1000)
}

export async function enqueueEntitlementRevocation(input: {
  userId: string
  entitlement: RevocableEntitlement
  reason: string
}) {
  assertQueueInput(input.userId, input.entitlement)
  const now = new Date()
  return prisma.entitlementRevocationJob.upsert({
    where: {
      userId_entitlement: { userId: input.userId, entitlement: input.entitlement },
    },
    create: {
      userId: input.userId,
      entitlement: input.entitlement,
      desiredState: 'revoked',
      status: 'pending',
      reason: input.reason.slice(0, REASON_MAX_LENGTH),
      nextRetryAt: now,
    },
    update: {
      desiredState: 'revoked',
      status: 'pending',
      reason: input.reason.slice(0, REASON_MAX_LENGTH),
      attemptCount: 0,
      nextRetryAt: now,
      lastAttemptAt: null,
      lastError: null,
      lastWorkerId: null,
    },
    select: { id: true },
  })
}

/** An activation/reactivation event supersedes any still-pending revocation. */
export async function markEntitlementDesiredActive(input: {
  userId: string
  entitlement: RevocableEntitlement
  reason: string
}) {
  assertQueueInput(input.userId, input.entitlement)
  return prisma.entitlementRevocationJob.updateMany({
    where: { userId: input.userId, entitlement: input.entitlement },
    data: {
      desiredState: 'granted',
      status: 'completed',
      reason: input.reason.slice(0, REASON_MAX_LENGTH),
      nextRetryAt: null,
      lastError: null,
    },
  })
}

export async function restoreLinkedDiscordMentorshipRole(userId: string) {
  const account = await prisma.userDiscordAccount.findUnique({
    where: { userId },
    select: { discordUserId: true },
  })
  if (!account) return { restored: false }

  const guildId = process.env.DISCORD_GUILD_ID
  const roleId = process.env.DISCORD_ROLE_MENTEE26_ID
  if (!guildId || !roleId) throw new Error('Discord grant environment is incomplete.')

  try {
    await addRoleToGuildMember({ guildId, discordUserId: account.discordUserId, roleId })
    return { restored: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('(404)')) return { restored: false }
    throw error
  }
}

async function writeRevocationAudit(input: {
  userId: string
  indicatorId: string
  tvUsername: string
  success: boolean
  message: string
  entitlement: RevocableEntitlement
}) {
  try {
    await prisma.indicatorClaimAudit.create({
      data: {
        userId: input.userId,
        indicatorId: input.indicatorId,
        tvUsername: input.tvUsername,
        action: 'revoke',
        result: input.success ? 'success' : 'failure',
        errorCode: input.success ? null : input.message.slice(0, 500),
        metadata: {
          source: 'entitlement_revocation_queue',
          entitlement: input.entitlement,
        },
      },
    })
  } catch {
    // The durable queue/claim state remains authoritative if audit logging fails.
  }
}

async function revokeTradingViewClaims(input: {
  jobId: string
  userId: string
  entitlement: RevocableEntitlement
}) {
  const claims = await prisma.indicatorClaim.findMany({
    where: {
      userId: input.userId,
      status: {
        in: ['pending', 'processing', 'granted', 'failed', 'needs_session', 'rebind_locked'],
      },
      indicator:
        input.entitlement === 'raidmap'
          ? { slug: RAIDMAP_CONFIG.indicatorSlug }
          : { slug: { not: RAIDMAP_CONFIG.indicatorSlug } },
    },
    include: { indicator: { select: { pineId: true } } },
  })

  if (claims.some((claim) => claim.status === 'processing')) {
    throw new Error('A TradingView claim is still processing; revocation will retry.')
  }

  const ensureStillRevocable = async () => {
    const [currentJob, guard] = await Promise.all([
      prisma.entitlementRevocationJob.findFirst({
        where: { id: input.jobId, status: 'processing', desiredState: 'revoked' },
        select: { id: true },
      }),
      guardAllowsRevocation(input.userId, input.entitlement),
    ])
    if (!currentJob) throw new Error('Revocation desired state changed.')
    if (guard.state !== 'inactive') {
      throw new Error(`Revocation guard no longer inactive: ${guard.reason}`)
    }
  }

  const localOnly = claims.filter((claim) => claim.status !== 'granted')
  if (localOnly.length > 0) {
    await ensureStillRevocable()
    await prisma.indicatorClaim.updateMany({
      where: { id: { in: localOnly.map((claim) => claim.id) }, status: { not: 'granted' } },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        nextRetryAt: null,
        lastErrorCode: 'entitlement_revoked',
        errorMessage: 'Produktzugang beendet; TradingView-Freigabe wurde widerrufen.',
      },
    })
  }

  const externallyGranted = claims.filter((claim) => claim.status === 'granted')
  if (externallyGranted.length === 0) return

  const tv = new TradingViewService(await getTvSessionSecret())
  if (!tv.isConfigured) {
    throw new Error('TradingView cookie is unavailable; granted claims remain queued for revocation.')
  }

  const failures: string[] = []
  for (const claim of externallyGranted) {
    await ensureStillRevocable()
    const pineId = claim.indicator?.pineId
    if (!pineId) {
      failures.push(`Missing Pine ID for claim ${claim.id}`)
      continue
    }

    let result: { success: boolean; message: string }
    try {
      result = await tv.revokeAccess(claim.tvUsername, pineId)
    } catch (error) {
      result = {
        success: false,
        message: error instanceof Error ? error.message : 'TradingView revoke failed.',
      }
    }

    await writeRevocationAudit({
      userId: input.userId,
      indicatorId: claim.indicatorId,
      tvUsername: claim.tvUsername,
      success: result.success,
      message: result.message,
      entitlement: input.entitlement,
    })

    if (!result.success) {
      failures.push(result.message)
      continue
    }

    await prisma.indicatorClaim.updateMany({
      where: { id: claim.id, status: 'granted' },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        nextRetryAt: null,
        lastErrorCode: null,
        errorMessage: 'Produktzugang beendet; TradingView-Freigabe wurde widerrufen.',
      },
    })
  }

  if (failures.length > 0) {
    throw new Error(`TradingView revocation incomplete: ${failures[0]}`)
  }
}

async function loadDiscordAccountWithLegacyFallback(userId: string) {
  const existing = await prisma.userDiscordAccount.findUnique({ where: { userId } })
  if (existing) return existing

  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  })
  if (!subscription?.stripeCustomerId) return null

  const customer = await stripe.customers.retrieve(subscription.stripeCustomerId)
  if ('deleted' in customer && customer.deleted) return null
  const discordUserId = customer.metadata?.discordUserId?.trim()
  if (!discordUserId) return null

  return prisma.userDiscordAccount.upsert({
    where: { userId },
    create: { userId, discordUserId },
    update: { discordUserId },
  })
}

async function revokeDiscordMentorshipRole(userId: string) {
  const account = await loadDiscordAccountWithLegacyFallback(userId)
  if (!account) return

  const guildId = process.env.DISCORD_GUILD_ID
  const roleId = process.env.DISCORD_ROLE_MENTEE26_ID
  if (!guildId || !roleId) {
    throw new Error('Discord revocation environment is incomplete.')
  }

  try {
    await removeRoleFromGuildMember({
      guildId,
      discordUserId: account.discordUserId,
      roleId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('(404)')) throw error
  }
}

async function guardAllowsRevocation(
  userId: string,
  entitlement: RevocableEntitlement
) {
  if (entitlement === 'mentorship') {
    return evaluateMentorshipRevocationGuard(userId)
  }

  try {
    const access = await getRaidMapAccessState(userId)
    return {
      state: access.hasAccess ? ('active' as const) : ('inactive' as const),
      reason: access.hasAccess ? 'raidmap_active' : 'raidmap_inactive',
    }
  } catch (error) {
    console.error('[entitlement-revocation] Raid Map guard unavailable:', error)
    return { state: 'unknown' as const, reason: 'raidmap_guard_unavailable' }
  }
}

export async function processEntitlementRevocationQueue(input: {
  limit?: number
  workerId?: string
  jobId?: string
} = {}) {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100))
  const workerId = (input.workerId ?? 'entitlement-revocation-worker').slice(0, 128)
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000)

  await prisma.entitlementRevocationJob.updateMany({
    where: { status: 'processing', lastAttemptAt: { lt: staleCutoff } },
    data: {
      status: 'failed',
      nextRetryAt: new Date(),
      lastError: 'Stale revocation lock reset.',
    },
  })

  const jobs = await prisma.entitlementRevocationJob.findMany({
    where: {
      ...(input.jobId ? { id: input.jobId.slice(0, 128) } : {}),
      desiredState: 'revoked',
      status: { in: ['pending', 'failed'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })

  let completed = 0
  let retried = 0
  let superseded = 0
  let skipped = 0

  for (const job of jobs) {
    const entitlement = job.entitlement as RevocableEntitlement
    if (entitlement !== 'mentorship' && entitlement !== 'raidmap') {
      skipped += 1
      await prisma.entitlementRevocationJob.update({
        where: { id: job.id },
        data: { status: 'dead_letter', nextRetryAt: null, lastError: 'Invalid entitlement.' },
      })
      continue
    }

    const attemptCount = job.attemptCount + 1
    const locked = await prisma.entitlementRevocationJob.updateMany({
      where: {
        id: job.id,
        desiredState: 'revoked',
        status: { in: ['pending', 'failed'] },
      },
      data: {
        status: 'processing',
        attemptCount,
        lastAttemptAt: new Date(),
        lastWorkerId: workerId,
        lastError: null,
      },
    })
    if (locked.count !== 1) {
      skipped += 1
      continue
    }

    try {
      const guard = await guardAllowsRevocation(job.userId, entitlement)
      if (guard.state === 'unknown') throw new Error(guard.reason)

      if (guard.state === 'active') {
        await prisma.entitlementRevocationJob.updateMany({
          where: { id: job.id, status: 'processing', desiredState: 'revoked' },
          data: {
            desiredState: 'granted',
            status: 'completed',
            nextRetryAt: null,
            lastError: `Revocation superseded: ${guard.reason}`,
          },
        })
        superseded += 1
        continue
      }

      const stillCurrent = await prisma.entitlementRevocationJob.findFirst({
        where: { id: job.id, status: 'processing', desiredState: 'revoked' },
        select: { id: true },
      })
      if (!stillCurrent) {
        superseded += 1
        continue
      }

      await revokeTradingViewClaims({ jobId: job.id, userId: job.userId, entitlement })
      if (entitlement === 'mentorship') {
        // Re-check both desired state and all providers after the potentially
        // slow TradingView calls, immediately before removing the Discord role.
        const [currentJob, currentGuard] = await Promise.all([
          prisma.entitlementRevocationJob.findFirst({
            where: { id: job.id, status: 'processing', desiredState: 'revoked' },
            select: { id: true },
          }),
          guardAllowsRevocation(job.userId, entitlement),
        ])
        if (!currentJob) {
          superseded += 1
          continue
        }
        if (currentGuard.state === 'active') {
          await markEntitlementDesiredActive({
            userId: job.userId,
            entitlement,
            reason: `revocation-superseded:${currentGuard.reason}`,
          })
          superseded += 1
          continue
        }
        if (currentGuard.state === 'unknown') throw new Error(currentGuard.reason)
        await revokeDiscordMentorshipRole(job.userId)
      }

      const finished = await prisma.entitlementRevocationJob.updateMany({
        where: { id: job.id, status: 'processing', desiredState: 'revoked' },
        data: { status: 'completed', nextRetryAt: null, lastError: null },
      })
      if (finished.count === 1) completed += 1
      else superseded += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entitlement revocation failed.'
      await prisma.entitlementRevocationJob.updateMany({
        where: { id: job.id, status: 'processing', desiredState: 'revoked' },
        data: {
          status: 'failed',
          nextRetryAt: retryAtForAttempt(attemptCount),
          lastError: message.slice(0, 1_000),
        },
      })
      retried += 1
    }
  }

  return { attempted: jobs.length, completed, retried, superseded, skipped }
}
