// app/api/upload/pdf/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { auth, clerkClient } from '@clerk/nextjs/server'
import sanitizeFilename from 'sanitize-filename' // neu – für sichere Namen// neu – für sichere Namen

export const POST = async (request: Request) => {
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

  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const videoId = formData.get('videoId') as string

    if (!pdfFile || !videoId) {
      return NextResponse.json({ error: 'PDF oder Video-ID fehlt' }, { status: 400 })
    }

    // Original-Dateinamen nehmen und sicher machen
    let originalName = pdfFile.name
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      originalName += '.pdf'
    }

    // Sichere den Dateinamen (entfernt ungültige Zeichen, Sonderzeichen, etc.)
    const safeFilename = sanitizeFilename(originalName)

    // Eindeutigen Pfad erstellen: videoId + Originalname
    const blobPath = `pdfs/${videoId}-${safeFilename}`

    // Hochladen mit Originalnamen
    const { url } = await put(blobPath, pdfFile, {
      access: 'public',
    })

    // In DB speichern
    await prisma.video.update({
      where: { id: videoId },
      data: { pdfUrl: url },
    })

    return NextResponse.json({ pdfUrl: url })
  } catch (error) {
    console.error('PDF Upload Fehler:', error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }
}