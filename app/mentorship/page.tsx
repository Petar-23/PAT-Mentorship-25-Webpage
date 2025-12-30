// app/mentorship/page.tsx

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getIsAdmin } from '@/lib/authz'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { Progress } from '@/components/ui/progress'
import { auth } from '@clerk/nextjs/server'
import { ArrowRight, Sparkles } from 'lucide-react'
import { MentorshipWelcomeName } from '@/components/mentorship/welcome-name'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  searchParams?: Promise<SearchParams> | undefined
}

type SidebarKurs = {
  id: string
  name: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  modulesLength: number
}

type ContinueLearning = {
  videoId: string
  videoTitle: string
  moduleId: string
  moduleName: string
  courseId: string | null
  courseName: string | null
  watchedLessons: number
  totalLessons: number
  percent: number
} | null

type NewContentItem = {
  videoId: string
  videoTitle: string
  moduleId: string
  moduleName: string
  courseName: string | null
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function getSidebarData() {
  const [kurse, savedSetting] = await Promise.all([
    prisma.playlist.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: { select: { modules: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.adminSetting.findUnique({
      where: { key: 'sidebarOrder' },
    }),
  ])

  const savedSidebarOrder: string[] | null = savedSetting ? (savedSetting.value as string[]) : null

  const kurseForSidebar: SidebarKurs[] = kurse.map((kurs) => ({
    id: kurs.id,
    name: kurs.name,
    slug: kurs.slug,
    description: kurs.description ?? null,
    iconUrl: kurs.iconUrl ?? null,
    modulesLength: kurs._count.modules,
  }))

  return { kurseForSidebar, savedSidebarOrder }
}

async function getContinueLearning(userId: string | null, isAdmin: boolean): Promise<ContinueLearning> {
  if (!userId || isAdmin) return null

  // 1) Prefer: zuletzt angesehen (sehr präzise fürs "Weiter machen")
  let lastViewedVideo:
    | {
        id: string
        title: string
        chapter: {
          module: {
            id: string
            name: string
            playlist: { id: string; name: string } | null
          }
        }
      }
    | null = null

  try {
    const state = await prisma.userPlaybackState.findUnique({
      where: { userId },
      select: { lastVideoId: true },
    })

    const lastVideoId = state?.lastVideoId ?? null
    if (lastVideoId) {
      lastViewedVideo = await prisma.video.findUnique({
        where: { id: lastVideoId },
        select: {
          id: true,
          title: true,
          chapter: {
            select: {
              module: {
                select: {
                  id: true,
                  name: true,
                  playlist: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })
    }
  } catch {
    // Falls die Migration noch nicht gelaufen ist, soll das Dashboard trotzdem funktionieren.
    lastViewedVideo = null
  }

  // 2) Fallback: zuletzt abgeschlossenes Video
  const lastWatched = lastViewedVideo
    ? null
    : await prisma.videoProgress.findFirst({
        where: { userId, watched: true },
        orderBy: [{ watchedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          video: {
            select: {
              id: true,
              title: true,
              chapter: {
                select: {
                  module: {
                    select: {
                      id: true,
                      name: true,
                      playlist: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })

  const video = lastViewedVideo ?? lastWatched?.video ?? null
  if (!video) return null

  const moduleId = video.chapter.module.id

  const [totalLessons, watchedLessons] = await Promise.all([
    prisma.video.count({
      where: { chapter: { moduleId } },
    }),
    prisma.videoProgress.count({
      where: { userId, watched: true, video: { chapter: { moduleId } } },
    }),
  ])

  const percent = totalLessons > 0 ? clampPercent((watchedLessons / totalLessons) * 100) : 0
  const mod = video.chapter.module

  return {
    videoId: video.id,
    videoTitle: video.title,
    moduleId: mod.id,
    moduleName: mod.name,
    courseId: mod.playlist?.id ?? null,
    courseName: mod.playlist?.name ?? null,
    watchedLessons,
    totalLessons,
    percent,
  }
}

async function getNewContent(limit: number): Promise<NewContentItem[]> {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      chapter: {
        select: {
          module: {
            select: {
              id: true,
              name: true,
              playlist: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  return videos.map((v) => ({
    videoId: v.id,
    videoTitle: v.title,
    moduleId: v.chapter.module.id,
    moduleName: v.chapter.module.name,
    courseName: v.chapter.module.playlist?.name ?? null,
  }))
}

export default async function MentorshipDashboard({ searchParams = Promise.resolve({}) }: PageProps) {
  const isAdmin = await getIsAdmin()
  const { userId } = await auth()

  const resolvedParams = await searchParams
  const create = typeof resolvedParams.create === 'string' ? resolvedParams.create : undefined
  const openCreateCourseModal = create === '1' || create === 'true'

  const [{ kurseForSidebar, savedSidebarOrder }, continueLearning, newContent] = await Promise.all([
    getSidebarData(),
    getContinueLearning(userId ?? null, isAdmin),
    getNewContent(3),
  ])

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
          openCreateCourseModal={isAdmin && openCreateCourseModal}
        />
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-10 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <MobileCoursesDrawer
          variant="bottomBar"
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
          openCreateCourseModal={isAdmin && openCreateCourseModal}
        />

        <div className="w-full max-w-[1920px]">
          {/* Willkommensbereich (leichtgewichtig) */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              Willkommen zurück<MentorshipWelcomeName />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hier findest du deinen nächsten Schritt und die neuesten Inhalte.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-6 auto-rows-fr">
            {/* Weiterlernen */}
            <Card className="md:col-span-2 xl:col-span-2 min-[1800px]:col-span-2">
              <CardHeader>
                <CardTitle>Weiterlernen</CardTitle>
                <CardDescription>Mach genau dort weiter, wo du aufgehört hast.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {continueLearning ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{continueLearning.moduleName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {continueLearning.videoTitle}
                        </p>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{continueLearning.percent}%</div>
                    </div>

                    <Progress value={continueLearning.percent} className="h-2.5" />

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {continueLearning.watchedLessons} von {continueLearning.totalLessons} Lektionen abgeschlossen
                      </p>
                      <Button asChild className="sm:w-auto w-full">
                        <Link
                          href={`/mentorship/modul/${continueLearning.moduleId}?video=${continueLearning.videoId}`}
                        >
                          Weiter machen <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Du hast noch kein Video gestartet. Öffne ein Modul über die Sidebar.
                    </p>
                    {kurseForSidebar[0]?.id ? (
                      <Button asChild variant="secondary" className="w-full sm:w-fit">
                        <Link href={`/mentorship/${kurseForSidebar[0].id}`}>
                          Module öffnen <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Neue Inhalte */}
            <Card className="md:col-span-2 xl:col-span-1 min-[1800px]:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Neue Inhalte
                </CardTitle>
                <CardDescription>Zuletzt hinzugefügte Videos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {newContent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aktuell sind keine neuen Inhalte verfügbar.</p>
                ) : (
                  <div className="space-y-2">
                    {newContent.map((item) => (
                      <Link
                        key={item.videoId}
                        href={`/mentorship/modul/${item.moduleId}?video=${item.videoId}`}
                        className="block rounded-md border border-border p-3 hover:bg-muted/40 transition-colors"
                      >
                        <p className="text-sm font-medium leading-snug overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                          {item.videoTitle}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {item.courseName ? `${item.courseName} • ` : ''}
                          {item.moduleName}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Tipp: Inhalte findest du immer auch strukturiert in der Sidebar.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}