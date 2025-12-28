// app/courses/page.tsx

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getIsAdmin } from '@/lib/authz'

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
      <Sidebar
        kurse={kurseForSidebar}
        savedSidebarOrder={savedSidebarOrder}
        isAdmin={isAdmin}
        openCreateCourseModal={isAdmin && openCreateCourseModal}
      />

      <div className="flex-1 p-12">
        <h1 className="mb-12 text-4xl font-bold">Alle Module</h1>

        {kurse.length === 0 ? (
          <p className="text-xl text-muted-foreground">Noch keine Kurse angelegt.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {kurse.flatMap((kurs) =>
              kurs.modules.map((modul) => (
                <Link key={modul.id} href={`/courses/${modul.id}`} className="block">
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
              <CardContent className="p-12 text-center">
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