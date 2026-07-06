import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ModulDetailClient } from '@/components/modul-detail-client'
import { getIsAdmin } from '@/lib/authz'
import { auth } from '@clerk/nextjs/server'
import { getSidebarData } from '@/lib/sidebar-data'

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
  const authPromise = auth()
  const searchParamsPromise = searchParams
  const sidebarDataPromise = getSidebarData()
  const modulPromise = prisma.module.findUnique({
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
              thumbnailUrl: true,
              pdfUrl: true,
              duration: true,
              order: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  })
  const { userId, sessionClaims } = await authPromise
  const isAdminPromise = userId ? getIsAdmin(userId, sessionClaims) : Promise.resolve(false)
  const watchedProgressRowsPromise = isAdminPromise.then((isAdmin) =>
    !isAdmin && userId
      ? prisma.videoProgress.findMany({
          where: {
            userId,
            watched: true,
            video: { chapter: { moduleId: id } },
          },
          select: { videoId: true },
        })
      : Promise.resolve([])
  )
  const [resolvedParams, { kurseForSidebar, savedSidebarOrder }, modul, isAdmin, watchedProgressRows] =
    await Promise.all([
      searchParamsPromise,
      sidebarDataPromise,
      modulPromise,
      isAdminPromise,
      watchedProgressRowsPromise,
    ])
  const requestedVideoId = typeof resolvedParams.video === 'string' ? resolvedParams.video : undefined

  if (!modul) notFound()

  const allVideos = modul.chapters.flatMap((ch) => ch.videos)
  const defaultInitialVideoId =
    allVideos.find((v) => v.bunnyGuid !== null)?.id ?? allVideos[0]?.id ?? null
  const initialVideoId =
    (requestedVideoId && allVideos.some((v) => v.id === requestedVideoId) ? requestedVideoId : null) ??
    defaultInitialVideoId

  const activeCourseId = modul.playlist?.id ?? null

  // Performance: Fortschritt direkt serverseitig und parallel laden → kein extra Client-Fetch nötig.
  const initialWatchedVideoIds = watchedProgressRows.map((r) => r.videoId)

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
