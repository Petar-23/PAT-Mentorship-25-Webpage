import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogFrontmatter {
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  image: string
  keywords: string[]
  draft: boolean
}

export interface BlogPost {
  slug: string
  frontmatter: BlogFrontmatter
  content: string
  readingTime: string
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))

  const posts = files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '')
      return getPostBySlug(slug)
    })
    .filter((post): post is BlogPost => {
      if (!post) return false
      if (process.env.NODE_ENV === 'production' && post.frontmatter.draft) return false
      return true
    })
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())

  return posts
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  const stats = readingTime(content)

  return {
    slug,
    frontmatter: {
      title: data.title ?? '',
      description: data.description ?? '',
      date: data.date ?? '',
      author: data.author ?? 'Petar',
      tags: data.tags ?? [],
      image: data.image ?? '/images/pat-banner.jpeg',
      keywords: data.keywords ?? [],
      draft: data.draft ?? false,
    },
    content,
    readingTime: `${Math.ceil(stats.minutes)} Min. Lesezeit`,
  }
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''))
}

export function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
