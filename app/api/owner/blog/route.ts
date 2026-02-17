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

// GET — List all blog posts from GitHub
export async function GET() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    let files: Array<{ name: string; sha: string; path: string }>
    try {
      files = await githubAPI(`/contents/${CONTENT_PATH}?ref=${BRANCH}`)
    } catch {
      // Directory doesn't exist yet (e.g. first deploy) — return empty list
      return NextResponse.json({ posts: [] })
    }
    const mdxFiles = files.filter((f: { name: string }) => f.name.endsWith('.mdx'))

    const posts = await Promise.all(
      mdxFiles.map(async (file: { name: string; sha: string; path: string }) => {
        const content = await githubAPI(`/contents/${file.path}?ref=${BRANCH}`)
        const decoded = Buffer.from(content.content, 'base64').toString('utf-8')

        // Parse frontmatter
        const fmMatch = decoded.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
        const frontmatter: Record<string, string> = {}
        if (fmMatch) {
          fmMatch[1].split('\n').forEach((line) => {
            const [key, ...val] = line.split(':')
            if (key && val.length) {
              frontmatter[key.trim()] = val.join(':').trim().replace(/^"(.*)"$/, '$1')
            }
          })
        }

        return {
          slug: file.name.replace('.mdx', ''),
          sha: content.sha,
          title: frontmatter.title || file.name,
          date: frontmatter.date || '',
          draft: frontmatter.draft === 'true',
        }
      })
    )

    posts.sort((a: { date: string }, b: { date: string }) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Blog API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST — Create a new blog post
export async function POST(req: Request) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_BLOG_TOKEN not configured' }, { status: 500 })
  }

  try {
    const { slug, content } = await req.json()

    if (!slug || !content) {
      return NextResponse.json({ error: 'slug and content required' }, { status: 400 })
    }

    const filePath = `${CONTENT_PATH}/${slug}.mdx`

    await githubAPI(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `blog: add "${slug}"`,
        content: Buffer.from(content).toString('base64'),
        branch: BRANCH,
      }),
    })

    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Blog create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
