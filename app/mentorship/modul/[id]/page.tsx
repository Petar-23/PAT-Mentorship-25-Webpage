import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ModulDetailClient } from '@/components/modul-detail-client'
import { getIsAdmin } from '@/lib/authz'
import { auth } from '@clerk/nextjs/server'
import { getSidebarData } from '@/lib/sidebar-data'
import { hasLearningMaterial } from '@/lib/mentorship-learning'

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
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          order: true,
          videos: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
  const [resolvedParams, { kurseForSidebar, pagesForSidebar, savedSidebarOrder }, modul, isAdmin, watchedProgressRows] =
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
    allVideos.find(hasLearningMaterial)?.id ?? allVideos[0]?.id ?? null
  const initialVideoId =
    (requestedVideoId && allVideos.some((v) => v.id === requestedVideoId) ? requestedVideoId : null) ??
    defaultInitialVideoId

  const activeCourseId = modul.playlist?.id ?? null

  // Performance: Fortschritt direkt serverseitig und parallel laden → kein extra Client-Fetch nötig.
  const initialWatchedVideoIds = watchedProgressRows.map((r) => r.videoId)

  return (
    <div className={isAdmin ? "flex h-full min-h-0 bg-background" : "m-workspace"}>
      <div className={isAdmin ? "hidden lg:block" : "m-desktop-sidebar hidden xl:block"}>
        <Sidebar
          kurse={kurseForSidebar}
          pages={pagesForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          activeCourseId={activeCourseId}
          isAdmin={isAdmin}
        />
      </div>

      <ModulDetailClient
        key={modul.id}
        modul={modul}
        initialVideoId={initialVideoId}
        initialWatchedVideoIds={initialWatchedVideoIds}
        isAdmin={isAdmin}
      />
    </div>
  )
}
