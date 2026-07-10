// app/api/modules/[id]/route.ts – Update & Delete für ein Modul
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { deleteVideo } from '@/lib/bunny'
import { put } from '@vercel/blob'
import sanitizeFilename from 'sanitize-filename'
import { requireAdminApiAccess } from '@/lib/authz'
import { revalidateSidebarData } from '@/lib/sidebar-data'

const BUNNY_DELETE_CONCURRENCY = 4
const ALLOWED_MODULE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_MODULE_IMAGE_BYTES = 8 * 1024 * 1024

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

export async function PATCH(request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdminApiAccess()
    if (!admin.ok) return admin.response

    const { id } = await params
    const formData = await request.formData()  // ← FormData statt json()!
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null

    let imageUrl = null
    const imageFile = formData.get('image') as File | null
    if (imageFile && imageFile.size > 0) {
    if (!ALLOWED_MODULE_IMAGE_TYPES.has(imageFile.type)) {
      return NextResponse.json({ error: 'Ungültiges Bildformat' }, { status: 400 })
    }
    if (imageFile.size > MAX_MODULE_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Bild darf maximal 8 MB groß sein' }, { status: 413 })
    }
    const safeFilename = sanitizeFilename(imageFile.name)
    const blobPath = `modules/${id}-${safeFilename}`
    const { url } = await put(blobPath, imageFile, { 
        access: 'public',
        addRandomSuffix: true  // ← NEU: Macht unique Namen (z.B. filename-abc123.png)
      })
    imageUrl = url
    }
  
    if (!name || !id) {
      return NextResponse.json({ error: 'Name oder ID fehlt' }, { status: 400 })
    }
  
    try {
      const updatedModule = await prisma.module.update({
        where: { id },
        data: { 
            name: name.trim(), 
            ...(description && description.trim() && { description: description.trim() }),
            ...(imageUrl && { imageUrl }),  // ← NEU: Speichere Bild-URL
          },
        select: { id: true },
      })
      return NextResponse.json(updatedModule)
    } catch (error) {
      console.error('Module update error:', error)
      return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
    }
  }

  export async function DELETE(_request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdminApiAccess()
    if (!admin.ok) return admin.response

    const { id } = await params

    try {
      // 1. Videos fetchen (für Bunny-Cleanup)
      const moduleWithVideos = await prisma.module.findUnique({
        where: { id },
        select: {
          chapters: {
            select: {
              videos: { select: { bunnyGuid: true } },
            },
          },
        },
      })
  
      if (!moduleWithVideos) {
        return NextResponse.json({ error: 'Modul nicht gefunden' }, { status: 404 })
      }
  
      // 2. Bunny-Videos löschen (parallel, Errors loggen)
      const videosToDelete = moduleWithVideos.chapters
        .flatMap(ch => ch.videos)
        .filter((video): video is { bunnyGuid: string } => Boolean(video.bunnyGuid))

      await mapWithConcurrency(videosToDelete, BUNNY_DELETE_CONCURRENCY, async (video) => {
          try {
            await deleteVideo(video.bunnyGuid)
          } catch (error) {
            console.error(`Bunny delete failed for ${video.bunnyGuid}:`, error)
            // Nicht stoppen – DB trotzdem löschen
          }
        }
      )
  
      // 3. DB löschen (Cascade)
      await prisma.module.delete({ where: { id }, select: { id: true } })
  
      revalidateSidebarData()
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Module delete error:', error)
      return NextResponse.json({ error: 'Delete fehlgeschlagen' }, { status: 500 })
    }
  }
