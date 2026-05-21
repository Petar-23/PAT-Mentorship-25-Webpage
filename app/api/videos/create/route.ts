import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { createVideo, generateTusSignature, getBunnyLibraryId } from '@/lib/bunny'

export async function POST(req: NextRequest) {
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  try {
    const { title, description } = await req.json()
    const { guid } = await createVideo(title, description || '')
    const { signature, expire } = await generateTusSignature(guid, 60)
    return NextResponse.json({
      guid,
      signature,
      expire,
      libraryId: getBunnyLibraryId(),
    })
  } catch (error: unknown) {
    console.error('Video create failed:', error)
    return NextResponse.json({ error: 'Server Error' }, { status: 500 })
  }
}
