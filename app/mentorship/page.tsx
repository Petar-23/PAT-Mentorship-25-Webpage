// app/mentorship/page.tsx

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getIsAdmin } from '@/lib/authz'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'

type SearchParams = { [key: string]: string | string[] | undefined }

interface PageProps {
  searchParams?: Promise<SearchParams> | undefined
}

async function getKurse() {
  const kurse = await prisma.playlist.findMany({
    include: {
      modules: {
        include: { chapters: true },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Lade gespeicherte Sidebar-Reihenfolge (falls vorhanden)
  const savedSetting = await prisma.adminSetting.findUnique({
    where: { key: 'sidebarOrder' },
  })

  const savedSidebarOrder: string[] | null = savedSetting 
    ? (savedSetting.value as string[]) 
    : null

  // Für die Sidebar: Nur ID, Name und Anzahl der Module
  const kurseForSidebar = kurse.map((kurs) => ({
    id: kurs.id,
    name: kurs.name,
    slug: kurs.slug,
    description: kurs.description ?? null,
    iconUrl: kurs.iconUrl ?? null,
    modulesLength: kurs.modules.length,  // Nur die Anzahl
  }))

  return { kurse, kurseForSidebar, savedSidebarOrder }
}

export default async function CoursesDashboard({ searchParams = Promise.resolve({}) }: PageProps) {
  const { kurse, kurseForSidebar, savedSidebarOrder } = await getKurse()
  const isAdmin = await getIsAdmin()
  const resolvedParams = await searchParams
  const create = typeof resolvedParams.create === 'string' ? resolvedParams.create : undefined
  const openCreateCourseModal = create === '1' || create === 'true'

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
          openCreateCourseModal={isAdmin && openCreateCourseModal}
        />
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-12 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12">
        <MobileCoursesDrawer
          variant="bottomBar"
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          isAdmin={isAdmin}
          openCreateCourseModal={isAdmin && openCreateCourseModal}
        />

        <h1 className="mb-6 sm:mb-10 lg:mb-12 text-2xl sm:text-3xl lg:text-4xl font-bold">
          Alle Module
        </h1>

        {kurse.length === 0 ? (
          <p className="text-xl text-muted-foreground">Noch keine Kurse angelegt.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {kurse.flatMap((kurs) =>
              kurs.modules.map((modul) => (
                <Link key={modul.id} href={`/mentorship/${modul.id}`} className="block">
                  <Card className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <span className="text-5xl">📚</span>
                    </div>

                    <CardHeader>
                      <CardTitle className="text-xl">{modul.name}</CardTitle>
                      <CardDescription>
                        {modul.chapters.length} Kapitel • Kurs: {kurs.name}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <Button variant="secondary" className="w-full">
                        Öffnen
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}

            <Card className="border-dashed border-2 border-muted-foreground/40 hover:border-muted-foreground/70 transition-colors cursor-pointer flex items-center justify-center">
              <CardContent className="p-10 sm:p-12 text-center">
                <div className="text-6xl mb-4 text-muted-foreground">+</div>
                <p className="text-lg font-medium">Neues Modul anlegen</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}