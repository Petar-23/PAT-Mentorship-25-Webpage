import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe, hasActiveSubscription } from '@/lib/stripe'
import {
  exchangeDiscordCodeForToken,
  fetchDiscordUser,
  addDiscordMemberToGuild,
  addRoleToGuildMember,
} from '@/lib/discord'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function redirectToDiscordPage(req: Request, params: Record<string, string>) {
  const url = new URL('/mentorship/discord', req.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = NextResponse.redirect(url)
  res.cookies.delete('discord_oauth_state')
  res.cookies.delete('discord_oauth_uid')
  return res
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (error) return redirectToDiscordPage(req, { discord: 'error', reason: error })
  if (!code || !state) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'missing_code_or_state' })
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('discord_oauth_state')?.value
  const cookieUserId = cookieStore.get('discord_oauth_uid')?.value

  if (!expectedState || expectedState !== state) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'invalid_state' })
  }

  const { userId: authedUserId } = await auth()
  const userId = authedUserId || cookieUserId

  if (!userId) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'not_authenticated' })
  }

  if (authedUserId && cookieUserId && authedUserId !== cookieUserId) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'user_mismatch' })
  }

  try {
    const redirectUri = new URL('/api/discord/oauth/callback', req.url).toString()

    const token = await exchangeDiscordCodeForToken({ code, redirectUri })
    const discordUser = await fetchDiscordUser(token.access_token)

    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      return redirectToDiscordPage(req, { discord: 'error', reason: 'no_stripe_customer' })
    }

    await stripe.customers.update(customers.data[0].id, {
      metadata: { discordUserId: discordUser.id },
    })

    const allowed = await hasActiveSubscription(userId)

    if (allowed) {
      const guildId = requireEnv('DISCORD_GUILD_ID')
      const roleId = requireEnv('DISCORD_ROLE_MENTEE26_ID')

      await addDiscordMemberToGuild({
        guildId,
        discordUserId: discordUser.id,
        userAccessToken: token.access_token,
      })

      await addRoleToGuildMember({ guildId, discordUserId: discordUser.id, roleId })

      return redirectToDiscordPage(req, { discord: 'connected' })
    }

    return redirectToDiscordPage(req, { discord: 'linked', note: 'subscription_required' })
  } catch (err) {
    console.error('Discord OAuth callback failed:', err)
    return redirectToDiscordPage(req, { discord: 'error', reason: 'exception' })
  }
}