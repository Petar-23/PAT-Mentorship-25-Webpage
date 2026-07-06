import BlogEditor from '@/components/blog/blog-editor'
import { getOwnerBlogPost } from '@/lib/owner-blog'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function EditBlogPostPage({ params }: PageProps) {
  const { slug } = await params
  let post: Awaited<ReturnType<typeof getOwnerBlogPost>> | null = null
  let error: string | null = null

  try {
    post = await getOwnerBlogPost(slug)
  } catch (err) {
    console.error('Failed to load owner blog post:', err)
    error = err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden'
  }

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="mb-2 text-sm text-gray-500">
            <Link href="/owner/blog" className="hover:text-orange-400">← Blog verwalten</Link>
          </div>
          <h1 className="font-sora text-3xl font-bold text-white">Artikel bearbeiten</h1>
          <p className="mt-1 text-gray-400">/blog/{slug}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {post && (
          <BlogEditor slug={slug} initialContent={post.content} initialSha={post.sha} />
        )}
      </div>
    </section>
  )
}
