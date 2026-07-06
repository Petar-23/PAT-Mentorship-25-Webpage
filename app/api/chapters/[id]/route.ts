import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { deleteVideo } from '@/lib/bunny'
import { requireAdminApiAccess } from '@/lib/authz'

const BUNNY_DELETE_CONCURRENCY = 4

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const { name } = await request.json()

  try {
    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        order: true,
        moduleId: true,
      },
    })
    return NextResponse.json(updatedChapter)
  } catch (error) {
    console.error('Chapter update error:', error)
    return NextResponse.json({ error: 'Konnte Kapitel nicht umbenennen' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: {
        videos: { select: { bunnyGuid: true } },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Kapitel nicht gefunden' }, { status: 404 })
    }

    // Bunny Videos löschen (nicht fatal wenn fehlschlägt)
    await mapWithConcurrency(
      chapter.videos.filter((video): video is { bunnyGuid: string } => Boolean(video.bunnyGuid)),
      BUNNY_DELETE_CONCURRENCY,
      async (video) => {
        try {
          await deleteVideo(video.bunnyGuid)
        } catch (error) {
          console.error(`Bunny Video ${video.bunnyGuid} löschen fehlgeschlagen:`, error)
        }
      }
    )

    // DB löschen (Cascade löscht Videos)
    await prisma.chapter.delete({ where: { id }, select: { id: true } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chapter löschen Fehler:', error)
    return NextResponse.json({ error: 'Konnte Kapitel nicht löschen' }, { status: 500 })
  }
}
