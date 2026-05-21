import 'server-only'

type GitHubFile = {
  name: string
  sha: string
  path: string
}

type GitHubContent = {
  content: string
  sha: string
}

type OwnerBlogConfig = {
  token: string
  repoOwner: string
  repoName: string
  branch: string
  contentPath: string
}

const GITHUB_BLOG_API_TIMEOUT_MS = 10_000

export type OwnerBlogPostSummary = {
  slug: string
  sha: string
  title: string
  date: string
  draft: boolean
}

export type OwnerBlogPost = {
  slug: string
  sha: string
  content: string
}

class GitHubBlogError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

function getOwnerBlogConfig(): OwnerBlogConfig {
  const token = process.env.GITHUB_BLOG_TOKEN
  if (!token) {
    throw new Error('GITHUB_BLOG_TOKEN not configured')
  }

  return {
    token,
    repoOwner: 'Petar-23',
    repoName: 'PAT-Mentorship-25-Webpage',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'dev',
    contentPath: 'content/blog',
  }
}

async function githubBlogApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config = getOwnerBlogConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GITHUB_BLOG_API_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.github.com/repos/${config.repoOwner}/${config.repoName}${endpoint}`,
      {
        ...options,
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      }
    )

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new GitHubBlogError(
        `GitHub API error: ${res.status} - ${JSON.stringify(error)}`,
        res.status
      )
    }

    return (await res.json()) as T
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GitHubBlogError(
        `GitHub API timeout after ${GITHUB_BLOG_API_TIMEOUT_MS}ms`,
        504
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function parseFrontmatter(content: string): Record<string, string> {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const frontmatter: Record<string, string> = {}
  if (!fmMatch) return frontmatter

  fmMatch[1].split('\n').forEach((line) => {
    const [key, ...val] = line.split(':')
    if (key && val.length) {
      frontmatter[key.trim()] = val.join(':').trim().replace(/^"(.*)"$/, '$1')
    }
  })

  return frontmatter
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )

  return results
}

export async function listOwnerBlogPosts(): Promise<OwnerBlogPostSummary[]> {
  const config = getOwnerBlogConfig()

  let files: GitHubFile[]
  try {
    files = await githubBlogApi<GitHubFile[]>(
      `/contents/${config.contentPath}?ref=${config.branch}`
    )
  } catch (error) {
    if (error instanceof GitHubBlogError && error.status === 404) {
      return []
    }
    throw error
  }

  const mdxFiles = files.filter((file) => file.name.endsWith('.mdx'))
  const posts = await mapWithConcurrency(
    mdxFiles,
    4,
    async (file) => {
      const content = await githubBlogApi<GitHubContent>(
        `/contents/${file.path}?ref=${config.branch}`
      )
      const decoded = Buffer.from(content.content, 'base64').toString('utf-8')
      const frontmatter = parseFrontmatter(decoded)

      return {
        slug: file.name.replace('.mdx', ''),
        sha: content.sha,
        title: frontmatter.title || file.name,
        date: frontmatter.date || '',
        draft: frontmatter.draft === 'true',
      }
    }
  )

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getOwnerBlogPost(slug: string): Promise<OwnerBlogPost> {
  const config = getOwnerBlogConfig()
  const filePath = `${config.contentPath}/${slug}.mdx`
  const file = await githubBlogApi<GitHubContent>(`/contents/${filePath}?ref=${config.branch}`)
  const content = Buffer.from(file.content, 'base64').toString('utf-8')

  return { slug, sha: file.sha, content }
}

export async function createOwnerBlogPost(params: {
  slug: string
  content: string
}): Promise<void> {
  const config = getOwnerBlogConfig()
  const filePath = `${config.contentPath}/${params.slug}.mdx`

  await githubBlogApi(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `blog: add "${params.slug}"`,
      content: Buffer.from(params.content).toString('base64'),
      branch: config.branch,
    }),
  })
}

export async function updateOwnerBlogPost(params: {
  slug: string
  content: string
  sha: string
}): Promise<void> {
  const config = getOwnerBlogConfig()
  const filePath = `${config.contentPath}/${params.slug}.mdx`

  await githubBlogApi(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `blog: update "${params.slug}"`,
      content: Buffer.from(params.content).toString('base64'),
      sha: params.sha,
      branch: config.branch,
    }),
  })
}

export async function deleteOwnerBlogPost(slug: string): Promise<void> {
  const config = getOwnerBlogConfig()
  const filePath = `${config.contentPath}/${slug}.mdx`
  const file = await githubBlogApi<GitHubContent>(`/contents/${filePath}?ref=${config.branch}`)

  await githubBlogApi(`/contents/${filePath}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `blog: delete "${slug}"`,
      sha: file.sha,
      branch: config.branch,
    }),
  })
}

export async function uploadOwnerBlogImage(file: File): Promise<{
  path: string
  fileName: string
}> {
  const config = getOwnerBlogConfig()
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  if (!allowed.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP and GIF allowed')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Max file size: 5MB')
  }

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
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  await githubBlogApi(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `blog: upload image "${fileName}"`,
      content: base64,
      branch: config.branch,
    }),
  })

  return {
    path: `/images/blog/${fileName}`,
    fileName,
  }
}
