// app/api/videos/[id]/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

const BUNNY_LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID
const BUNNY_API_KEY = process.env.BUNNY_API_KEY

// Warnung, falls Bunny-Credentials fehlen (z. B. in Dev ohne .env)
if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
  console.warn('⚠️ Bunny.net API-Key oder Library-ID fehlt – Löschen bei Bunny wird übersprungen')
}

// PATCH – Titel, PDF, bunnyGuid updaten (dein bestehender Code, leicht angepasst)
export async function PATCH(request: Request,{ params }: { params: Promise<{ id: string }> }) {

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })
  const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const updateData: { title?: string; pdfUrl?: string | null; bunnyGuid?: string | null } = {}

  if ('title' in body && typeof body.title === 'string') {
    updateData.title = body.title.trim() || undefined
  }

  if ('pdfUrl' in body) {
    updateData.pdfUrl = body.pdfUrl === '' || body.pdfUrl == null ? null : body.pdfUrl
  }

  if ('bunnyGuid' in body) {
    updateData.bunnyGuid = body.bunnyGuid || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Daten zum Updaten' }, { status: 400 })
  }

  try {
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updatedVideo)
  } catch (error) {
    console.error('Video update error:', error)
    return NextResponse.json({ error: 'Konnte Video nicht updaten' }, { status: 500 })
  }
}

// DELETE – Video aus DB + Bunny.net löschen
export async function DELETE(_request: Request,{ params }: { params: Promise<{ id: string }> }) {

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })
  const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    // 1. Video holen, um bunnyGuid zu bekommen
    const video = await prisma.video.findUnique({
      where: { id },
      select: { bunnyGuid: true },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video nicht gefunden' }, { status: 404 })
    }

    // 2. Bei Bunny.net löschen – fehlertolerant!
    if (video.bunnyGuid && BUNNY_API_KEY && BUNNY_LIBRARY_ID) {
      try {
        const response = await fetch(
          `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${video.bunnyGuid}`,
          {
            method: 'DELETE',
            headers: {
              AccessKey: BUNNY_API_KEY,
            },
          }
        )
    
        if (response.ok) {
          console.log(`✅ Bunny Video gelöscht: ${video.bunnyGuid}`)
        } else if (response.status === 404) {
          console.warn(`ℹ️ Bunny Video ${video.bunnyGuid} war bereits gelöscht (404)`)
        } else {
          console.error(`❌ Bunny Fehler: ${response.status} ${await response.text()}`)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Netzwerkfehler beim Löschen bei Bunny:', message)
        // Kein Abbruch – DB-Löschung geht weiter
      }
    }

    // 3. Aus Prisma-DB löschen
    await prisma.video.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Video erfolgreich gelöscht' })
  } catch (error) {
    console.error('Fehler beim Löschen des Videos:', error)
    return NextResponse.json({ error: 'Interner Serverfehler beim Löschen' }, { status: 500 })
  }
}