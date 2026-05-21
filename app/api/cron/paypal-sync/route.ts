import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPayPalSubscription } from '@/lib/paypal'
import {
  removeRoleFromGuildMember,
  sendDiscordChannelMessage,
} from '@/lib/discord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAYPAL_SYNC_CONCURRENCY = 3
const PAYPAL_API_REQUEST_SPACING_MS = 300

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

// ---------------------------------------------------------------------------
// Discord helpers (mirrors pattern from app/api/webhooks/paypal/route.ts)
// ---------------------------------------------------------------------------

async function safeRemoveDiscordRole(userId: string): Promise<void> {
  try {
    const { stripe } = await import('@/lib/stripe')

    const sub = await prisma.userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    if (!sub?.stripeCustomerId) return

    const customer = await stripe.customers.retrieve(sub.stripeCustomerId)
    if ('deleted' in customer && customer.deleted) return

    const discordUserId = customer.metadata?.discordUserId
    if (!discordUserId) return

    const guildId = requireEnv('DISCORD_GUILD_ID')
    const roleId = requireEnv('DISCORD_ROLE_MENTEE26_ID')
    await removeRoleFromGuildMember({ guildId, discordUserId, roleId })
  } catch (err) {
    console.error('[paypal-sync] Failed to remove Discord role:', err)
  }
}

async function safeSendModNotification(params: {
  title: string
  description: string
  email: string
  color: number
}): Promise<void> {
  const channelId = process.env.DISCORD_MOD_CHANNEL_ID
  if (!channelId) return

  try {
    await sendDiscordChannelMessage({
      channelId,
      content: '',
      embeds: [
        {
          title: params.title,
          description: params.description,
          color: params.color,
          fields: [{ name: 'PayPal Email', value: params.email, inline: true }],
          footer: { text: 'Price Action Trader Mentorship – Cron Sync' },
          timestamp: new Date().toISOString(),
        },
      ],
    })
  } catch (err) {
    console.error('[paypal-sync] Failed to send mod notification:', err)
  }
}

// ---------------------------------------------------------------------------
// Status normalisation helpers
// ---------------------------------------------------------------------------

/** Map PayPal API status → UserSubscription.status */
function toUserSubStatus(paypalStatus: string): string {
  const upper = paypalStatus.toUpperCase()
  if (upper === 'ACTIVE') return 'active'
  return 'canceled'
}

// ---------------------------------------------------------------------------
// GET handler (Vercel Cron calls GET)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const subscribers = await prisma.payPalSubscriber.findMany({
    select: {
      id: true,
      paypalSubscriptionId: true,
      paypalEmail: true,
      status: true,
      userId: true,
    },
  })
  console.log(`[paypal-sync] Starting sync for ${subscribers.length} subscribers`)

  let nextPayPalRequestAt = Date.now()
  const waitForPayPalRequestSlot = async () => {
    const now = Date.now()
    const scheduledAt = Math.max(now, nextPayPalRequestAt)
    nextPayPalRequestAt = scheduledAt + PAYPAL_API_REQUEST_SPACING_MS
    const delay = scheduledAt - now

    if (delay > 0) {
      await sleep(delay)
    }
  }

  const results = await mapWithConcurrency(
    subscribers,
    PAYPAL_SYNC_CONCURRENCY,
    async (subscriber) => {
      try {
        await waitForPayPalRequestSlot()
        const liveInfo = await getPayPalSubscription(subscriber.paypalSubscriptionId)
        const liveStatus = liveInfo.status // e.g. ACTIVE, CANCELLED, SUSPENDED, EXPIRED

        let changed = 0
        if (liveStatus !== subscriber.status) {
          console.log(
            `[paypal-sync] Status changed for ${subscriber.paypalSubscriptionId}: ` +
              `${subscriber.status} → ${liveStatus}`
          )

          // 1. Update PayPalSubscriber
          await prisma.payPalSubscriber.update({
            where: { id: subscriber.id },
            data: { status: liveStatus },
            select: { id: true },
          })

          // 2. Update UserSubscription (if linked)
          if (subscriber.userId) {
            await prisma.userSubscription.updateMany({
              where: {
                userId: subscriber.userId,
                paypalSubscriptionId: subscriber.paypalSubscriptionId,
              },
              data: { status: toUserSubStatus(liveStatus) },
            })
          }

          // 3. If previously ACTIVE and now not ACTIVE → remove Discord role
          const wasActive = subscriber.status === 'ACTIVE'
          const isNowActive = liveStatus === 'ACTIVE'
          if (wasActive && !isNowActive && subscriber.userId) {
            await safeRemoveDiscordRole(subscriber.userId)
          }

          // 4. Send mod notification
          const deactivated = wasActive && !isNowActive
          const reactivated = !wasActive && isNowActive
          await safeSendModNotification({
            title: deactivated
              ? 'PayPal-Abo deaktiviert (Cron-Sync)'
              : reactivated
                ? 'PayPal-Abo reaktiviert (Cron-Sync)'
                : 'PayPal-Status geändert (Cron-Sync)',
            description:
              `Subscription \`${subscriber.paypalSubscriptionId}\` Statusänderung: ` +
              `**${subscriber.status}** → **${liveStatus}**`,
            email: subscriber.paypalEmail,
            color: deactivated ? 0xef4444 : reactivated ? 0x22c55e : 0xf59e0b,
          })

          changed = 1
        }

        return { checked: 1, changed, errors: 0 }
      } catch (err) {
        console.error(
          `[paypal-sync] Error checking ${subscriber.paypalSubscriptionId}:`,
          err
        )
        return { checked: 1, changed: 0, errors: 1 }
      }
    }
  )

  const summary = results.reduce(
    (acc, result) => ({
      checked: acc.checked + result.checked,
      changed: acc.changed + result.changed,
      errors: acc.errors + result.errors,
    }),
    { checked: 0, changed: 0, errors: 0 }
  )

  console.log('[paypal-sync] Done:', summary)
  return NextResponse.json(summary)
}
