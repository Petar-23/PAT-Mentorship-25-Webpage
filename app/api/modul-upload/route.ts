// app/api/module-upload/route.ts

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'

export const runtime = 'nodejs'

export async function POST(request: Request) {

  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  let body: HandleUploadBody

  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Hier kannst du später z. B. Auth prüfen
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          addRandomSuffix: true,
          // Optional: Ordner-Struktur
          // pathname: `modules/${pathname}`,
        }
      },
    })

    // Wichtig: Immer eine Response zurückgeben!
    return NextResponse.json(response)
  } catch (error) {
    console.error('Vercel Blob Upload Fehler:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Upload fehlgeschlagen' },
      { status: 500 }
    )
  }
}
