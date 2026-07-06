import { requireAdminApiAccess } from '@/lib/authz'
import { createOwnerBlogPost, listOwnerBlogPosts } from '@/lib/owner-blog'
import { NextResponse } from 'next/server'

// GET - List all blog posts from GitHub
export async function GET() {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const posts = await listOwnerBlogPosts()
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Blog API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create a new blog post
export async function POST(req: Request) {
  const access = await requireAdminApiAccess()
  if (!access.ok) return access.response

  try {
    const { slug, content } = await req.json()

    if (!slug || !content) {
      return NextResponse.json({ error: 'slug and content required' }, { status: 400 })
    }

    await createOwnerBlogPost({ slug, content })
    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Blog create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
