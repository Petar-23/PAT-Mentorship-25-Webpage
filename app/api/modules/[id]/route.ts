// app/api/modules/[id]/route.ts – Update & Delete für ein Modul
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { deleteVideo } from '@/lib/bunny'
import { put } from '@vercel/blob'
import sanitizeFilename from 'sanitize-filename'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function PATCH(request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({ userId, limit: 100 })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const formData = await request.formData()  // ← FormData statt json()!
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null

    let imageUrl = null
    const imageFile = formData.get('image') as File | null
    if (imageFile && imageFile.size > 0) {
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
      })
      return NextResponse.json(updatedModule)
    } catch (error) {
      console.error('Module update error:', error)
      return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
    }
  }

  export async function DELETE(_request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({ userId, limit: 100 })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    try {
      // 1. Videos fetchen (für Bunny-Cleanup)
      const moduleWithVideos = await prisma.module.findUnique({
        where: { id },
        include: {
          chapters: {
            include: {
              videos: true  // Alle Videos
            }
          }
        }
      })
  
      if (!moduleWithVideos) {
        return NextResponse.json({ error: 'Modul nicht gefunden' }, { status: 404 })
      }
  
      // 2. Bunny-Videos löschen (parallel, Errors loggen)
      const bunnyDeletes = moduleWithVideos.chapters
        .flatMap((ch: any) => ch.videos)
        .filter((v: any) => v.bunnyGuid)
        .map(async (video: any) => {
          try {
            await deleteVideo(video.bunnyGuid!)
          } catch (error) {
            console.error(`Bunny delete failed for ${video.bunnyGuid}:`, error)
            // Nicht stoppen – DB trotzdem löschen
          }
        })
  
      await Promise.allSettled(bunnyDeletes)  // Parallel safe
  
      // 3. DB löschen (Cascade)
      await prisma.module.delete({ where: { id } })
  
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Module delete error:', error)
      return NextResponse.json({ error: 'Delete fehlgeschlagen' }, { status: 500 })
    }
  }