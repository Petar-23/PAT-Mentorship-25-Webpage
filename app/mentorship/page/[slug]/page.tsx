// app/mentorship/page/[slug]/page.tsx

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { getIsAdmin } from '@/lib/authz'
import { getSidebarData } from '@/lib/sidebar-data'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { PageEditorLoader } from '@/components/page-editor-loader'
import { PageViewer } from '@/components/page-viewer'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PageSlugRoute({ params }: Props) {
  const { slug } = await params
  const authPromise = auth()
  const pagePromise = prisma.page.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      published: true,
      updatedAt: true,
    },
  })
  const isAdminPromise = authPromise.then(({ userId, sessionClaims }) =>
    userId ? getIsAdmin(userId, sessionClaims) : false
  )
  const sidebarDataPromise = getSidebarData()
  const [page, isAdmin] = await Promise.all([pagePromise, isAdminPromise])

  if (!page || (!isAdmin && !page.published)) {
    notFound()
  }

  const { kurseForSidebar, pagesForSidebar, savedSidebarOrder } = await sidebarDataPromise

  const pageData = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content as Record<string, unknown> | null,
    published: page.published,
    updatedAt: page.updatedAt,
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          pages={pagesForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="lg:hidden p-4">
          <MobileCoursesDrawer
            variant="icon"
            kurse={kurseForSidebar}
            savedSidebarOrder={savedSidebarOrder}
            isAdmin={isAdmin}
          />
        </div>

        {isAdmin ? (
          <PageEditorLoader page={pageData} />
        ) : (
          <PageViewer
            pageId={page.id}
            title={page.title}
            content={page.content as Record<string, unknown> | null}
            updatedAt={page.updatedAt}
          />
        )}
      </div>
    </div>
  )
}
