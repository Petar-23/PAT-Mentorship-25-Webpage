import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog'
import { BlogCard } from '@/components/blog/blog-card'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Trading-Wissen, ICT Konzepte und Smart Money Strategien — verständlich erklärt auf Deutsch.',
  openGraph: {
    title: 'Blog | PAT Mentorship',
    description: 'Trading-Wissen, ICT Konzepte und Smart Money Strategien — verständlich erklärt auf Deutsch.',
    url: 'https://www.price-action-trader.de/blog',
    images: [{ url: '/images/pat-banner.jpeg', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: '/blog',
  },
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h1 className="font-sora mb-4 text-4xl font-bold text-white md:text-5xl">Blog</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-400">
            Trading-Wissen, ICT Konzepte und Smart Money Strategien — verständlich erklärt auf Deutsch.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-gray-500">Noch keine Artikel veröffentlicht.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
