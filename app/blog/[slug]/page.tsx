import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllSlugs, getPostBySlug, formatDateDE } from '@/lib/blog'
import { useMDXComponents, customComponents } from '@/components/blog/mdx-components'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    keywords: post.frontmatter.keywords,
    openGraph: {
      title: `${post.frontmatter.title} | PAT Mentorship`,
      description: post.frontmatter.description,
      url: `https://www.price-action-trader.de/blog/${slug}`,
      type: 'article',
      publishedTime: post.frontmatter.date,
      authors: [post.frontmatter.author],
      images: [{ url: post.frontmatter.image || '/images/pat-banner.jpeg', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      images: [post.frontmatter.image || '/images/pat-banner.jpeg'],
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  }
}

function extractTOC(content: string): Array<{ level: number; text: string; id: string }> {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const toc: Array<{ level: number; text: string; id: string }> = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2]
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s-]/g, '')
      .replace(/\s+/g, '-')
    toc.push({ level, text, id })
  }
  return toc
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const toc = extractTOC(post.content)
  const components = useMDXComponents()

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.frontmatter.title,
    description: post.frontmatter.description,
    author: { '@type': 'Person' as const, name: post.frontmatter.author },
    datePublished: post.frontmatter.date,
    image: post.frontmatter.image
      ? `https://www.price-action-trader.de${post.frontmatter.image}`
      : 'https://www.price-action-trader.de/images/pat-banner.jpeg',
    publisher: {
      '@type': 'Organization' as const,
      name: 'Price Action Trader',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem' as const, position: 1, name: 'Home', item: 'https://www.price-action-trader.de' },
      { '@type': 'ListItem' as const, position: 2, name: 'Blog', item: 'https://www.price-action-trader.de/blog' },
      { '@type': 'ListItem' as const, position: 3, name: post.frontmatter.title },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <article className="min-h-screen bg-slate-950 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm text-gray-500">
            <Link href="/" className="hover:text-orange-400">Home</Link>
            <span className="mx-2">›</span>
            <Link href="/blog" className="hover:text-orange-400">Blog</Link>
            <span className="mx-2">›</span>
            <span className="text-gray-300">{post.frontmatter.title}</span>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <div className="mb-4 flex flex-wrap gap-2">
              {post.frontmatter.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="font-sora mb-4 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              {post.frontmatter.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Von {post.frontmatter.author}</span>
              <span>•</span>
              <time dateTime={post.frontmatter.date}>{formatDateDE(post.frontmatter.date)}</time>
              <span>•</span>
              <span>{post.readingTime}</span>
            </div>
          </header>

          <div className="flex gap-10">
            {/* Main Content */}
            <div className="min-w-0 flex-1">
              <MDXRemote source={post.content} components={components} />
            </div>

            {/* TOC Sidebar */}
            {toc.length > 0 && (
              <aside className="hidden w-64 shrink-0 lg:block">
                <div className="sticky top-24">
                  <h4 className="font-sora mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Inhaltsverzeichnis
                  </h4>
                  <nav className="space-y-2">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`block text-sm transition hover:text-orange-400 ${
                          item.level === 3 ? 'pl-4 text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </div>

          {/* Back link */}
          <div className="mt-16 border-t border-slate-800 pt-8">
            <Link href="/blog" className="text-orange-400 transition hover:text-orange-300">
              ← Zurück zum Blog
            </Link>
          </div>
        </div>
      </article>
    </>
  )
}
