'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Users } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

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

  return (
    <div className="w-full lg:w-80 border-r border-border bg-muted/40 p-4 flex flex-col h-full min-h-0">
      <div className="relative mb-1 -mx-4 -mt-4 h-48 overflow-hidden">
        <Image
          src="/images/pat-banner.jpeg"
          alt="PAT Mentorship 2026 Banner"
          fill
          className="object-cover"
          sizes="320px"
          quality={70}
        />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 pb-2 flex justify-center">
          <div className="inline-block px-6 py-2 mx-auto bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
            <h2 className="text-xl font-bold text-white drop-shadow-md">PAT Mentorship 2026</h2>
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
              <div className="space-y-2 pt-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block"
                    aria-current={item.id === activeItemId ? 'page' : undefined}
                  >
                    <div
                      className={cn(
                        'flex items-center space-x-4 py-2 px-2 rounded-lg transition-colors cursor-pointer border border-border',
                        item.id === activeItemId
                          ? 'bg-gray-200/50 dark:bg-gray-800/40 border-l-4 border-gray-200 dark:border-gray-700 border-l-gray-400 dark:border-l-gray-400'
                          : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/30'
                      )}
                    >
                      <div
                        className={`w-10 h-10 border bg-gradient-to-br ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}


