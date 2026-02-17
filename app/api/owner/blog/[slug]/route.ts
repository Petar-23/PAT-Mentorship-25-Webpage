import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_BLOG_TOKEN
const REPO_OWNER = 'Petar-23'
const REPO_NAME = 'PAT-Mentorship-25-Webpage'
const BRANCH = process.env.VERCEL_GIT_COMMIT_REF || 'dev'
const CONTENT_PATH = 'content/blog'

async function githubAPI(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(`GitHub API error: ${res.status} — ${JSON.stringify(error)}`)
  }
  return res.json()
}

async function checkAdmin() {
  const { userId } = await auth()
  if (!userId) return false
  const client = await clerkClient()
  const { data: memberships } = await client.users.getOrganizationMembershipList({ userId })
  return memberships.some((m) => m.role === 'org:admin')
}

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET — Read a single blog post
export async function GET(_req: Request, { params }: RouteParams) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    const { slug } = await params
    const filePath = `${CONTENT_PATH}/${slug}.mdx`
    const file = await githubAPI(`/contents/${filePath}?ref=${BRANCH}`)
    const content = Buffer.from(file.content, 'base64').toString('utf-8')

    return NextResponse.json({ slug, sha: file.sha, content })
  } catch (error) {
    console.error('Blog read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT — Update a blog post
export async function PUT(req: Request, { params }: RouteParams) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    const { slug } = await params
    const { content, sha } = await req.json()

    if (!content || !sha) {
      return NextResponse.json({ error: 'content and sha required' }, { status: 400 })
    }

    const filePath = `${CONTENT_PATH}/${slug}.mdx`

    await githubAPI(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `blog: update "${slug}"`,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch: BRANCH,
      }),
    })

    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Blog update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE — Delete a blog post
export async function DELETE(_req: Request, { params }: RouteParams) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    const { slug } = await params
    const filePath = `${CONTENT_PATH}/${slug}.mdx`

    // Get current SHA
    const file = await githubAPI(`/contents/${filePath}?ref=${BRANCH}`)

    await githubAPI(`/contents/${filePath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `blog: delete "${slug}"`,
        sha: file.sha,
        branch: BRANCH,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Blog delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
