import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_BLOG_TOKEN
const REPO_OWNER = 'Petar-23'
const REPO_NAME = 'PAT-Mentorship-25-Webpage'
const BRANCH = process.env.VERCEL_GIT_COMMIT_REF || 'dev'

async function checkAdmin() {
  const { userId } = await auth()
  if (!userId) return false
  const client = await clerkClient()
  const { data: memberships } = await client.users.getOrganizationMembershipList({ userId })
  return memberships.some((m) => m.role === 'org:admin')
}

// POST — Upload an image to the repo
export async function POST(req: Request) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP and GIF allowed' }, { status: 400 })
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max file size: 5MB' }, { status: 400 })
    }

    // Generate filename: sanitized original name
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const baseName = file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const timestamp = Date.now()
    const fileName = `${baseName}-${timestamp}.${ext}`
    const filePath = `public/images/blog/${fileName}`

    // Read file as base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Upload to GitHub
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `blog: upload image "${fileName}"`,
          content: base64,
          branch: BRANCH,
        }),
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(`GitHub API: ${res.status} — ${JSON.stringify(error)}`)
    }

    // Return the public path (without /public prefix — Next.js serves from /public as root)
    const publicPath = `/images/blog/${fileName}`

    return NextResponse.json({ success: true, path: publicPath, fileName })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
