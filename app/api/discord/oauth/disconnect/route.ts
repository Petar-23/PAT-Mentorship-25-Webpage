import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { removeRoleFromGuildMember } from '@/lib/discord'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function wantsHtml(req: Request): boolean {
  const accept = req.headers.get('accept') ?? ''
  return accept.includes('text/html')
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function redirectToDiscordPage(req: Request, params: Record<string, string>) {
  const url = new URL('/mentorship/discord', req.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    if (wantsHtml(req)) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  try {
    const [discordAccount, sub] = await Promise.all([
      prisma.userDiscordAccount.findUnique({
        where: { userId },
        select: { discordUserId: true },
      }),
      prisma.userSubscription
        .findUnique({
          where: { userId },
          select: { stripeCustomerId: true },
        })
        .catch(() => null),
    ])

    let stripeCustomerId = sub?.stripeCustomerId ?? null
    // Find an optional Stripe mirror even for a DB-backed/PayPal link so a
    // previous OAuth run cannot leave stale metadata behind.
    if (!stripeCustomerId) {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })
      stripeCustomerId = customers.data[0]?.id ?? null
    }

    let legacyDiscordUserId: string | null = null
    if (!discordAccount && stripeCustomerId) {
      const customer = await stripe.customers.retrieve(stripeCustomerId)
      if (!('deleted' in customer && customer.deleted)) {
        const raw = customer.metadata?.discordUserId
        legacyDiscordUserId = typeof raw === 'string' && raw.trim() ? raw.trim() : null
      }
    }

    const discordUserId = discordAccount?.discordUserId ?? legacyDiscordUserId

    // Wenn eh nichts verknüpft ist: beide Speicherorte idempotent leeren.
    if (!discordUserId) {
      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, { metadata: { discordUserId: '' } })
      }
      await prisma.userDiscordAccount.deleteMany({ where: { userId } })
      if (wantsHtml(req)) {
        return redirectToDiscordPage(req, {})
      }
      return NextResponse.json({ ok: true })
    }

    let guildId: string
    let roleId: string
    try {
      guildId = requireEnv('DISCORD_GUILD_ID')
      roleId = requireEnv('DISCORD_ROLE_MENTEE26_ID')
    } catch (err) {
      console.error('Discord disconnect missing env:', err)
      if (wantsHtml(req)) {
        return redirectToDiscordPage(req, { discord: 'error', reason: 'missing_env' })
      }
      return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 })
    }

    // Binding erst nach bestaetigter Rollenentfernung loeschen. Nur ein 404
    // (Member existiert nicht mehr) ist bereits der gewuenschte Endzustand;
    // alle anderen Fehler muessen mit erhaltener ID retrybar bleiben.
    try {
      await removeRoleFromGuildMember({ guildId, discordUserId, roleId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('(404)')) {
        console.info('Discord member already absent during disconnect.')
      } else {
        console.error('Discord role remove failed:', err)
        if (wantsHtml(req)) {
          return redirectToDiscordPage(req, {
            discord: 'error',
            reason: 'discord_role_remove_failed',
          })
        }
        return NextResponse.json(
          { ok: false, error: 'discord_role_remove_failed' },
          { status: 502 }
        )
      }
    }

    // Discord-Link in beiden Speicherorten entfernen. Der DB-Datensatz wird
    // erst nach erfolgreichem Legacy-Cleanup geloescht, damit ein Retry moeglich bleibt.
    if (stripeCustomerId) {
      await stripe.customers.update(stripeCustomerId, { metadata: { discordUserId: '' } })
    }
    await prisma.userDiscordAccount.deleteMany({ where: { userId, discordUserId } })

    if (wantsHtml(req)) {
      return redirectToDiscordPage(req, {})
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Discord disconnect failed:', err)
    if (wantsHtml(req)) {
      return redirectToDiscordPage(req, { discord: 'error', reason: 'exception' })
    }
    return NextResponse.json({ ok: false, error: 'exception' }, { status: 500 })
  }
}
