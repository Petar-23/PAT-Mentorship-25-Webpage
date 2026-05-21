import BlogEditor from '@/components/blog/blog-editor'
import Link from 'next/link'

export default function NewBlogPostPage() {
  return (
    <section className="min-h-screen bg-slate-950 px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="mb-2 text-sm text-gray-500">
            <Link href="/owner/blog" className="hover:text-orange-400">← Blog verwalten</Link>
          </div>
          <h1 className="font-sora text-3xl font-bold text-white">Neuer Artikel</h1>
          <p className="mt-1 text-gray-400">Erstelle einen neuen Blog-Artikel.</p>
        </div>

        <BlogEditor isNew />
      </div>
    </section>
  )
}
