import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ModulDetailClient } from '@/components/modul-detail-client'
import { getIsAdmin } from '@/lib/authz'
import { auth } from '@clerk/nextjs/server'

type SearchParams = { [key: string]: string | string[] | undefined }

interface Props {
  params: Promise<{ id: string }>
  searchParams?: Promise<SearchParams> | undefined
}

export default async function MentorshipModulPage({
  params,
  searchParams = Promise.resolve({}),
}: Props) {
  const { id } = await params
  const isAdmin = await getIsAdmin()
  const { userId } = await auth()
  const resolvedParams = await searchParams
  const requestedVideoId = typeof resolvedParams.video === 'string' ? resolvedParams.video : undefined

  // Sidebar-Daten – schlank: nur Count statt ganze Module laden
  const [kurseRaw, savedSetting] = await Promise.all([
    prisma.playlist.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: { select: { modules: true } },
      },
    }),
    prisma.adminSetting.findUnique({
      where: { key: 'sidebarOrder' },
    }),
  ])

  const kurseForSidebar = kurseRaw.map((k) => ({
    id: k.id,
    name: k.name,
    slug: k.slug,
    description: k.description ?? null,
    iconUrl: k.iconUrl ?? null,
    modulesLength: k._count.modules,
  }))

  const savedSidebarOrder: string[] | null = savedSetting ? (savedSetting.value as string[]) : null

  // Modul laden
  const modul = await prisma.module.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      playlist: {
        select: {
          id: true,
          name: true,
        },
      },
      chapters: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          order: true,
          videos: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              bunnyGuid: true,
              pdfUrl: true,
              order: true,
            },
          },
        },
      },
    },
  })

  if (!modul) notFound()

  const allVideos = modul.chapters.flatMap((ch) => ch.videos)
  const defaultInitialVideoId =
    allVideos.find((v) => v.bunnyGuid !== null)?.id ?? allVideos[0]?.id ?? null
  const initialVideoId =
    (requestedVideoId && allVideos.some((v) => v.id === requestedVideoId) ? requestedVideoId : null) ??
    defaultInitialVideoId

  const activeCourseId = modul.playlist?.id ?? null

  // Performance: Fortschritt direkt serverseitig laden → kein extra Client-Fetch nötig.
  const initialWatchedVideoIds =
    !isAdmin && userId && allVideos.length
      ? (
          await prisma.videoProgress.findMany({
            where: {
              userId,
              watched: true,
              videoId: { in: allVideos.map((v) => v.id) },
            },
            select: { videoId: true },
          })
        ).map((r) => r.videoId)
      : []

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          activeCourseId={activeCourseId}
          isAdmin={isAdmin}
        />
      </div>

      <ModulDetailClient
        modul={modul}
        initialVideoId={initialVideoId}
        initialWatchedVideoIds={initialWatchedVideoIds}
        isAdmin={isAdmin}
        sidebar={{
          kurse: kurseForSidebar,
          savedSidebarOrder,
          activeCourseId,
        }}
      />
    </div>
  )
}


