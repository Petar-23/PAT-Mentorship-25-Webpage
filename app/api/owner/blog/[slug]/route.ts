import { requireAdminApiAccess } from '@/lib/authz'
import {
  deleteOwnerBlogPost,
  getOwnerBlogPost,
  updateOwnerBlogPost,
} from '@/lib/owner-blog'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET - Read a single blog post
export async function GET(_req: Request, { params }: RouteParams) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const { slug } = await params
    const post = await getOwnerBlogPost(slug)
    return NextResponse.json(post)
  } catch (error) {
    console.error('Blog read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update a blog post
export async function PUT(req: Request, { params }: RouteParams) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const { slug } = await params
    const { content, sha } = await req.json()

    if (!content || !sha) {
      return NextResponse.json({ error: 'content and sha required' }, { status: 400 })
    }

    await updateOwnerBlogPost({ slug, content, sha })
    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Blog update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a blog post
export async function DELETE(_req: Request, { params }: RouteParams) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const { slug } = await params
    await deleteOwnerBlogPost(slug)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Blog delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
