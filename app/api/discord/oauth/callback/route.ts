import { auth, clerkClient } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import {
  getVerifiedPrimaryEmail,
  type VerifiedEmailAddress,
} from '@/lib/clerk-email'
import { selectUniqueEmailFallbackCustomer } from '@/lib/stripe-customer-policy'
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

/**
 * Prüft ob ein User einen aktiven PayPal-Subscriber-Eintrag hat.
 * PayPal-User haben keinen Stripe Customer, bekommen aber trotzdem Discord-Zugriff.
 */
async function checkPayPalAccess(userId: string): Promise<boolean> {
  try {
    const paypalSub = await prisma.payPalSubscriber.findUnique({
      where: { userId },
      select: { status: true },
    })
    return paypalSub?.status === 'ACTIVE'
  } catch {
    return false
  }
}

/**
 * Sucht den Stripe Customer für einen User.
 * Versucht zuerst das DB-Mapping, dann metadata.userId und zuletzt E-Mail (Fallback für ältere Käufe).
 * Gibt null zurück wenn kein Customer gefunden.
 */
async function findStripeCustomer(userId: string, userEmail?: VerifiedEmailAddress | null) {
  // 1) DB-Mapping ist der schnellste Pfad, falls der Kunde bereits verknüpft wurde.
  const db = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  }).catch(() => null)

  if (db?.stripeCustomerId) {
    const customer = await stripe.customers.retrieve(db.stripeCustomerId).catch(() => null)
    if (customer && !('deleted' in customer && customer.deleted)) {
      return customer
    }
  }

  // 2) Suche via metadata.userId (Standard)
  const byMetadata = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
  })

  const liveByMetadata = byMetadata.data.filter((c) => !('deleted' in c && c.deleted))
  if (liveByMetadata.length > 0) {
    return [...liveByMetadata].sort((a, b) => b.created - a.created)[0]
  }

  // 3) Fallback: Suche per E-Mail (für ältere Käufe ohne metadata.userId)
  if (userEmail) {
    const byEmail = await stripe.customers.list({
      email: userEmail,
      limit: 100,
    })

    const liveByEmail = byEmail.data
      .filter((c) => !('deleted' in c && c.deleted))
    if (byEmail.has_more) return null

    const selected = selectUniqueEmailFallbackCustomer(liveByEmail, userId)
    if (!selected) return null

    // Refresh directly before linking so a concurrent foreign binding is
    // observed and never overwritten.
    const refreshed = await stripe.customers.retrieve(selected.customer.id)
    if ('deleted' in refreshed && refreshed.deleted) return null
    const freshSelection = selectUniqueEmailFallbackCustomer([refreshed], userId)
    if (!freshSelection) return null
    if (!freshSelection.shouldLinkUserId) return refreshed

    return stripe.customers.update(refreshed.id, {
      metadata: { ...(refreshed.metadata ?? {}), userId },
    })
  }

  return null
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

  if (!expectedState || expectedState !== state) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'invalid_state' })
  }

  // The callback requires the current Clerk session. A user ID kept in a
  // browser cookie is not an authentication credential and is never trusted.
  const { userId } = await auth()
  if (!userId) {
    return redirectToDiscordPage(req, { discord: 'error', reason: 'not_authenticated' })
  }

  try {
    const redirectUri = new URL('/api/discord/oauth/callback', req.url).toString()
    const token = await exchangeDiscordCodeForToken({ code, redirectUri })
    const discordUser = await fetchDiscordUser(token.access_token)

    // Hole E-Mail des Users für Stripe-Fallback-Lookup
    let userEmail: VerifiedEmailAddress | null = null
    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      userEmail = getVerifiedPrimaryEmail(user)
    } catch {
      // non-critical
    }

    // 1) Stripe Customer suchen (mit Email-Fallback)
    const stripeCustomer = await findStripeCustomer(userId, userEmail)

    // 2) Falls kein Stripe Customer: PayPal-Check
    //    PayPal-Subscriber haben keinen Stripe Customer, sollen aber trotzdem Discord-Zugang bekommen
    const hasPayPalAccess = await checkPayPalAccess(userId)

    if (!stripeCustomer && !hasPayPalAccess) {
      return redirectToDiscordPage(req, { discord: 'error', reason: 'no_stripe_customer' })
    }

    // 3) Zugriff prüfen — hasPayPalAccess = bereits bestätigt, Stripe-Pfad via hasActiveSubscription
    let allowed: boolean
    if (hasPayPalAccess) {
      allowed = true
    } else {
      // Prüfe via Stripe-Subscription (inkl. PayPal-Doppelcheck in hasActiveSubscription)
      const { hasActiveSubscription } = await import('@/lib/stripe')
      allowed = await hasActiveSubscription(userId, userEmail ?? undefined)
    }

    if (allowed) {
      // Provider-unabhaengige DB-Verknuepfung ist die Quelle fuer spaetere
      // PayPal-/Stripe-Revocations. Stripe-Metadata bleibt nur ein Spiegel.
      await prisma.userDiscordAccount.upsert({
        where: { userId },
        create: { userId, discordUserId: discordUser.id },
        update: { discordUserId: discordUser.id },
      })

      if (stripeCustomer) {
        await stripe.customers
          .update(stripeCustomer.id, { metadata: { discordUserId: discordUser.id } })
          .catch((error) => {
            console.error('Failed to update Stripe customer discordUserId metadata:', error)
          })
      }

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
