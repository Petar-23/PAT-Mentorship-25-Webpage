import { listOwnerBlogPosts } from '@/lib/owner-blog'
import type { OwnerBlogPostSummary } from '@/lib/owner-blog'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BlogAdminPage() {
  let posts: OwnerBlogPostSummary[] = []
  let error: string | null = null

  try {
    posts = await listOwnerBlogPosts()
  } catch (err) {
    console.error('Failed to load owner blog posts:', err)
    error = err instanceof Error ? err.message : 'Blog-Artikel konnten nicht geladen werden'
  }

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 text-sm text-gray-500">
              <Link href="/owner" className="hover:text-orange-400">← Dashboard</Link>
            </div>
            <h1 className="font-sora text-3xl font-bold text-white">Blog verwalten</h1>
            <p className="mt-1 text-gray-400">Artikel erstellen, bearbeiten und veröffentlichen.</p>
          </div>
          <Link
            href="/owner/blog/new"
            className="rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-white transition hover:bg-orange-600"
          >
            + Neuer Artikel
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Posts Table */}
        {!error && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            {posts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Noch keine Artikel. Erstelle deinen ersten!
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Titel</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Datum</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {posts.map((post) => (
                    <tr key={post.slug} className="transition hover:bg-slate-900/50">
                      <td className="px-5 py-4">
                        <span className="font-medium text-white">{post.title}</span>
                        <p className="mt-0.5 text-xs text-gray-500">/blog/{post.slug}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {post.date ? new Date(post.date).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {post.draft ? (
                          <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
                            Entwurf
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                            Veröffentlicht
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/owner/blog/${post.slug}/edit`}
                          className="text-sm text-orange-400 transition hover:text-orange-300"
                        >
                          Bearbeiten →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-xs text-gray-500">
          <strong className="text-gray-400">Hinweis:</strong> Änderungen werden als Git-Commit gespeichert.
          Vercel deployt automatisch in ~1 Minute. Artikel im Entwurf-Modus sind nur hier sichtbar.
        </div>
      </div>
    </section>
  )
}
