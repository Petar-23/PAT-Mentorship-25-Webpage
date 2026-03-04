// app/mentorship/page/[slug]/page.tsx

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { getIsAdmin } from '@/lib/authz'
import { getSidebarData } from '@/lib/sidebar-data'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { PageEditor } from '@/components/page-editor'
import { PageViewer } from '@/components/page-viewer'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PageSlugRoute({ params }: Props) {
  const { slug } = await params
  const [isAdmin, { kurseForSidebar, pagesForSidebar, savedSidebarOrder }] = await Promise.all([
    getIsAdmin(),
    getSidebarData(),
  ])

  const page = await prisma.page.findUnique({ where: { slug } })

  if (!page || (!isAdmin && !page.published)) {
    notFound()
  }

  const pageData = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content as Record<string, unknown> | null,
    published: page.published,
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
          <PageEditor page={pageData} />
        ) : (
          <PageViewer title={page.title} content={page.content as Record<string, unknown> | null} />
        )}
      </div>
    </div>
  )
}
