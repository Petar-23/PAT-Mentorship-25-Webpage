import { requireAdminApiAccess } from '@/lib/authz'
import { uploadOwnerBlogImage } from '@/lib/owner-blog'
import { NextResponse } from 'next/server'

// POST - Upload an image to the repo
export async function POST(req: Request) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const uploaded = await uploadOwnerBlogImage(file)
    return NextResponse.json({ success: true, ...uploaded })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
