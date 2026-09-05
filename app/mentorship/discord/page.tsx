import { MentorshipCommunityContent } from '@/components/mentorship/community-content'
import { getSidebarData } from '@/lib/sidebar-data'
import { auth } from '@clerk/nextjs/server'
import { Sidebar } from '@/components/Sidebar'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { fetchDiscordGuildMember } from '@/lib/discord'
import { getIsAdmin } from '@/lib/authz'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  searchParams: Promise<SearchParams> | undefined
}

async function getConnectedDiscordAccount(userId: string | null): Promise<{
  userId: string | null
  label: string | null
}> {
  if (!userId) {
    return { userId: null, label: null }
  }

  try {
    // Prefer DB-cached customerId, fallback to Stripe search
    const sub = await prisma.userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    let stripeCustomerId = sub?.stripeCustomerId ?? null

    if (!stripeCustomerId) {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })
      stripeCustomerId = customers.data[0]?.id ?? null
    }

    let connectedDiscordUserId: string | null = null

    if (stripeCustomerId) {
      const customer = await stripe.customers.retrieve(stripeCustomerId)
      if (!('deleted' in customer && customer.deleted)) {
        const raw = customer.metadata?.discordUserId
        connectedDiscordUserId = typeof raw === 'string' && raw.length > 0 ? raw : null
      }
    }

    if (!connectedDiscordUserId) {
      return { userId: null, label: null }
    }

    const guildId = process.env.DISCORD_GUILD_ID
    if (!guildId) {
      return { userId: connectedDiscordUserId, label: 'Discord verbunden' }
    }

    try {
      const member = await fetchDiscordGuildMember({
        guildId,
        discordUserId: connectedDiscordUserId,
      })
      const user = member.user
      return {
        userId: connectedDiscordUserId,
        label: member.nick ?? (user?.global_name ?? user?.username ?? null),
      }
    } catch {
      return { userId: connectedDiscordUserId, label: 'Discord verbunden' }
    }
  } catch (err) {
    console.error('Failed to resolve connected Discord account:', err)
    return { userId: null, label: null }
  }
}

export default async function DiscordPage({
  searchParams = Promise.resolve({}),
}: PageProps) {
  const authPromise = auth()
  const searchParamsPromise = searchParams
  const sidebarPromise = getSidebarData()
  const { userId, sessionClaims } = await authPromise
  const isAdminPromise = userId ? getIsAdmin(userId, sessionClaims) : Promise.resolve(false)
  const connectedDiscordPromise = getConnectedDiscordAccount(userId)
  const [{ kurseForSidebar, pagesForSidebar, savedSidebarOrder }, resolvedParams, isAdmin, connectedDiscord] = await Promise.all([
    sidebarPromise,
    searchParamsPromise,
    isAdminPromise,
    connectedDiscordPromise,
  ])

  const discord = typeof resolvedParams.discord === 'string' ? resolvedParams.discord : undefined
  const reason = typeof resolvedParams.reason === 'string' ? resolvedParams.reason : undefined

  const connectedDiscordUserId = connectedDiscord.userId
  const connectedDiscordLabel = connectedDiscord.label

  return (
    <div className="flex h-full min-h-0">
      <div className={isAdmin ? "hidden lg:block" : "hidden xl:block"}><Sidebar kurse={kurseForSidebar} pages={pagesForSidebar} savedSidebarOrder={savedSidebarOrder} isAdmin={isAdmin} /></div>
      <div className="m-page-scroll">
        <MentorshipCommunityContent connected={Boolean(connectedDiscordUserId)} accountLabel={connectedDiscordLabel} status={discord} reason={reason} />
      </div>
    </div>
  )
}
