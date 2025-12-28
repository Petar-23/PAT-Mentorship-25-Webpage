import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
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
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      if (wantsHtml(req)) {
        return redirectToDiscordPage(req, { discord: 'error', reason: 'no_stripe_customer' })
      }
      return NextResponse.json({ ok: false, error: 'no_stripe_customer' }, { status: 404 })
    }

    const stripeCustomerId = customers.data[0].id
    const customer = await stripe.customers.retrieve(stripeCustomerId)

    // Stripe kann auch ein DeletedCustomer zurückgeben (hat dann { deleted: true })
    if ('deleted' in customer && customer.deleted) {
      if (wantsHtml(req)) {
        return redirectToDiscordPage(req, { discord: 'error', reason: 'deleted_stripe_customer' })
      }
      return NextResponse.json(
        { ok: false, error: 'deleted_stripe_customer' },
        { status: 404 }
      )
    }

    const rawDiscordUserId = customer.metadata?.discordUserId
    const discordUserId =
      typeof rawDiscordUserId === 'string' && rawDiscordUserId.length > 0 ? rawDiscordUserId : null

    // Wenn eh nichts verknüpft ist: trotzdem sauber "leer" schreiben und fertig.
    if (!discordUserId) {
      await stripe.customers.update(stripeCustomerId, { metadata: { discordUserId: '' } })
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

    // Rolle entziehen (wenn sie schon weg ist / Member nicht im Guild ist, ist das okay)
    try {
      await removeRoleFromGuildMember({ guildId, discordUserId, roleId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Auth/Permission Fehler sollten wir nicht "schlucken".
      if (msg.includes('(401)') || msg.includes('(403)')) {
        console.error('Discord role remove failed:', err)
        if (wantsHtml(req)) {
          return redirectToDiscordPage(req, { discord: 'error', reason: 'discord_role_remove_failed' })
        }
        return NextResponse.json(
          { ok: false, error: 'discord_role_remove_failed' },
          { status: 502 }
        )
      }

      console.warn('Discord role remove non-fatal error (ignored):', err)
    }

    // Discord-Link entfernen
    await stripe.customers.update(stripeCustomerId, { metadata: { discordUserId: '' } })

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


