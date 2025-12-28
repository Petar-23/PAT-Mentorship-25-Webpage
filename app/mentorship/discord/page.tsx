import Image from 'next/image'
import { auth } from '@clerk/nextjs/server'
import { Sidebar } from '@/components/Sidebar'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { fetchDiscordGuildMember } from '@/lib/discord'
import { DiscordLinkButton } from '@/components/discord/discord-link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getIsAdmin } from '@/lib/authz'
import { Check } from 'lucide-react'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  searchParams: Promise<SearchParams> | undefined
}

export default async function DiscordPage({
  searchParams = Promise.resolve({}),
}: PageProps) {
  const { userId } = await auth()
  const isAdmin = await getIsAdmin()
  // Lade Kurse aus DB
  const kurse = await prisma.playlist.findMany({
    include: {
      modules: true, // Nur für .length
    },
    orderBy: { createdAt: 'desc' },
  })

  // Lade gespeicherte Sidebar-Reihenfolge
  const savedSetting = await prisma.adminSetting.findUnique({
    where: { key: 'sidebarOrder' },
  })

  const savedSidebarOrder: string[] | null = savedSetting
    ? (savedSetting.value as string[])
    : null

  // Für die Sidebar
  const kurseForSidebar = kurse.map((kurs) => ({
    id: kurs.id,
    name: kurs.name,
    slug: kurs.slug,
    description: kurs.description ?? null,
    iconUrl: kurs.iconUrl ?? null,
    modulesLength: kurs.modules.length,
  }))

  const resolvedParams = await searchParams
  const discord = typeof resolvedParams.discord === 'string' ? resolvedParams.discord : undefined
  const reason = typeof resolvedParams.reason === 'string' ? resolvedParams.reason : undefined

  // Falls User bereits Discord verknüpft hat: Account-Namen anzeigen
  let connectedDiscordUserId: string | null = null
  let connectedDiscordLabel: string | null = null

  if (userId) {
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

      if (stripeCustomerId) {
        const customer = await stripe.customers.retrieve(stripeCustomerId)
        if (!('deleted' in customer && customer.deleted)) {
          const raw = customer.metadata?.discordUserId
          connectedDiscordUserId = typeof raw === 'string' && raw.length > 0 ? raw : null
        }
      }

      if (connectedDiscordUserId) {
        const guildId = process.env.DISCORD_GUILD_ID
        if (guildId) {
          try {
            const member = await fetchDiscordGuildMember({
              guildId,
              discordUserId: connectedDiscordUserId,
            })
            const u = member.user
            connectedDiscordLabel = member.nick ?? (u?.global_name ?? u?.username ?? null)
          } catch {
            connectedDiscordLabel = 'Discord verbunden'
          }
        } else {
          connectedDiscordLabel = 'Discord verbunden'
        }
      }
    } catch (err) {
      console.error('Failed to resolve connected Discord account:', err)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar kurse={kurseForSidebar} savedSidebarOrder={savedSidebarOrder} isAdmin={isAdmin} />
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-12 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12">
        <MobileCoursesDrawer
          variant="bottomBar"
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
        />

        <Card className="mx-auto w-full max-w-2xl overflow-hidden">
          <div className="bg-gradient-to-b from-slate-950 to-slate-900 px-6 py-10">
            <div className="mx-auto w-fit">
              <div className="relative">
                <Image
                  src="/images/PAT_Discord.png"
                  alt="Price Action Trader Discord"
                  width={192}
                  height={192}
                  className="rounded-2xl ring-1 ring-white/10"
                  priority
                />
              </div>
            </div>
          </div>

          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Discord Account verbinden</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            {discord === 'linked' && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                Discord ist verknüpft, aber dein Abo ist nicht aktiv.
              </div>
            )}

            {discord === 'error' && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                Discord verbinden hat nicht geklappt.
                {reason ? ` Grund: ${reason}` : null}
              </div>
            )}

            <p className="text-lg">
              {connectedDiscordUserId
                ? 'Du hast bereits Zugriff auf die Community und kannst an den Live-Streams teilnehmen.'
                : 'Verbinde deinen Discord Account, damit du Zugriff auf die Community bekommst.'}
            </p>

            <div className="mx-auto w-full max-w-md space-y-2">
              {connectedDiscordUserId ? (
                <div className="space-y-1 text-left">
                  <p className="text-xs text-muted-foreground">Dein verbundener Discord-Account</p>
                  <div className="flex h-10 items-center justify-between rounded-md border bg-muted/40 px-3">
                    <span className="truncate font-medium">
                      {connectedDiscordLabel ?? 'Discord verbunden'}
                    </span>
                    <span className="ml-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-green-500 text-green-600">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              ) : null}

              <DiscordLinkButton connected={Boolean(connectedDiscordUserId)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}