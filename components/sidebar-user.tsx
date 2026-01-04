'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, ChevronDown, SquareKanban, Users } from 'lucide-react'
import patBanner from '@/public/images/pat-banner.jpeg'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { Button } from '@/components/ui/button'

type Kurs = {
  id: string
  name: string
  slug: string
  modulesLength: number
  description?: string | null
  iconUrl?: string | null
}

type SidebarItem = {
  id: string
  title: string
  subtitle: string
  href: string
  icon: ReactNode
  iconBg: string
}

type Props = {
  kurse: Kurs[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
}

export function SidebarUser({ kurse, savedSidebarOrder, activeCourseId }: Props) {
  const pathname = usePathname()
  const isMentorship = pathname?.startsWith('/mentorship')
  const { user, isLoaded } = useUser()
  const [mobileFooterOpen, setMobileFooterOpen] = useState(false)

  const activeItemId = useMemo(() => {
    if (pathname?.startsWith('/mentorship/discord')) return 'discord'
    if (activeCourseId) return activeCourseId

    const match = pathname?.match(/^\/mentorship\/([^/]+)$/)
    return match?.[1] ?? null
  }, [pathname, activeCourseId])

  const staticItems = useMemo<SidebarItem[]>(
    () => [
      {
        id: 'discord',
        title: 'Discord Community',
        subtitle: 'Live Streams & Chat',
        href: '/mentorship/discord',
        icon: <Users className="h-6 w-6 text-white" />,
        iconBg: 'from-indigo-700/80 to-indigo-600/70',
      },
      ...kurse.map((kurs) => ({
        id: kurs.id,
        title: kurs.name,
        subtitle: `${kurs.modulesLength} ${kurs.modulesLength === 1 ? 'Modul' : 'Module'}`,
        href: `/mentorship/${kurs.id}`,
        icon: kurs.iconUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={kurs.iconUrl}
              alt={`${kurs.name} Icon`}
              fill
              sizes="40px"
              className="object-cover"
              quality={70}
            />
          </div>
        ) : (
          <BookOpen className="h-6 w-6 text-white" />
        ),
        iconBg: 'from-slate-700/80 to-slate-600/70',
      })),
    ],
    [kurse]
  )

  const items = useMemo<SidebarItem[]>(() => {
    if (savedSidebarOrder) {
      const orderMap = new Map(savedSidebarOrder.map((id, index) => [id, index]))
      return [...staticItems].sort((a, b) => {
        const posA = orderMap.get(a.id) ?? staticItems.length
        const posB = orderMap.get(b.id) ?? staticItems.length
        return posA - posB
      })
    }
    return staticItems
  }, [savedSidebarOrder, staticItems])

  const displayName =
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mitglied'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  return (
    <div
      className={cn(
        'w-full lg:w-80 border-r border-border p-4 pb-0 flex flex-col h-full min-h-0 shadow-lg',
        isMentorship ? 'bg-gray-100/50' : 'bg-muted/40'
      )}
    >
      <div className="relative mb-1 -mx-4 -mt-4 h-48 overflow-hidden">
        <Image
          src={patBanner}
          alt="PAT Mentorship 2026 Banner"
          fill
          className="object-cover"
          sizes="320px"
          quality={70}
          placeholder="blur"
          priority
        />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 pb-2 flex justify-center">
          <div className="inline-block px-6 py-2 mx-auto rounded-lg border border-white/30 bg-white/60 supports-[backdrop-filter]:bg-white/20 backdrop-blur-md">
            <h2 className="text-xl font-bold text-white drop-shadow-md">PAT MENTORSHIP</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-1 overflow-y-auto">
        <Accordion type="single" collapsible defaultValue="mentorship">
          <AccordionItem value="mentorship">
            <AccordionTrigger className="text-gray-400 font-medium py-3 px-4 hover:text-black rounded-lg transition-colors [&&]:hover:no-underline justify-between">
              <span>PAT Mentorship 2026</span>
            </AccordionTrigger>

            <AccordionContent className="px-1">
              <div className="space-y-1.5 pt-3 sm:space-y-2 sm:pt-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block"
                    aria-current={item.id === activeItemId ? 'page' : undefined}
                  >
                    <div
                      className={cn(
                        'flex items-center space-x-3 sm:space-x-4 py-1.5 sm:py-2 px-2 rounded-lg transition-colors cursor-pointer border border-border',
                        item.id === activeItemId
                          ? 'bg-gray-200/50 dark:bg-gray-800/40 border-l-4 border-gray-200 dark:border-gray-700 border-l-gray-400 dark:border-l-gray-400'
                          : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/30'
                      )}
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 border bg-gradient-to-br ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[13px] sm:text-sm truncate">{item.title}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {isMentorship ? (
        <div className="mt-0 border-t rounded-t-xl border-gray-300 -mx-4 px-4 pb-4 bg-gray-100">
          {/* Desktop: Aktionen immer sichtbar */}
          <div className="hidden lg:block pt-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
            >
              <Link href="/mentorship">
                <span className="flex items-center justify-center shrink-0 w-8">
                  <SquareKanban className="!h-5 !w-5" />
                </span>
                <span>Dashboard</span>
              </Link>
            </Button>

            <ManageSubscriptionButton
              variant="ghost"
              size="sm"
              label="Mitgliedschaft verwalten"
              iconWrapperClassName="w-8"
              iconClassName="!h-5 !w-5"
              className="px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
            />

            <div className="mt-3 flex items-center gap-3">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8',
                  },
                }}
              />

              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">
                  {isLoaded ? displayName : '...'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{isLoaded ? email : ''}</p>
              </div>
            </div>
          </div>

          {/* Mobile: User immer sichtbar, Aktionen einklappbar */}
          <div className="lg:hidden pt-2">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                mobileFooterOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
              aria-hidden={!mobileFooterOpen}
            >
              <div
                className={cn(
                  'overflow-hidden space-y-1',
                  !mobileFooterOpen ? 'pointer-events-none' : ''
                )}
              >
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
                >
                  <Link href="/mentorship">
                    <span className="flex items-center justify-center shrink-0 w-8">
                      <SquareKanban className="!h-5 !w-5" />
                    </span>
                    <span>Dashboard</span>
                  </Link>
                </Button>

                <ManageSubscriptionButton
                  variant="ghost"
                  size="sm"
                  label="Mitgliedschaft verwalten"
                  iconWrapperClassName="w-8"
                  iconClassName="!h-5 !w-5"
                  className="px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8',
                  },
                }}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">
                  {isLoaded ? displayName : '...'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{isLoaded ? email : ''}</p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={mobileFooterOpen ? 'Aktionen einklappen' : 'Aktionen anzeigen'}
                aria-expanded={mobileFooterOpen}
                onClick={() => setMobileFooterOpen((v) => !v)}
              >
                <ChevronDown
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    mobileFooterOpen ? 'rotate-0' : 'rotate-180'
                  )}
                />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


