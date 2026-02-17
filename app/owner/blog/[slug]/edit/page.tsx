'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import BlogEditor from '@/components/blog/blog-editor'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function EditBlogPostPage({ params }: PageProps) {
  const { slug } = use(params)
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const isAdmin =
    user?.organizationMemberships?.some((membership) => membership.role === 'org:admin') || false

  const [content, setContent] = useState<string | null>(null)
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !isAdmin) {
      router.replace('/')
      return
    }

    fetch(`/api/owner/blog/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setContent(data.content)
          setSha(data.sha)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isLoaded, isSignedIn, isAdmin, router, slug])

  if (!isLoaded || !isSignedIn || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
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

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        )}

        {!loading && content !== null && sha !== null && (
          <BlogEditor slug={slug} initialContent={content} initialSha={sha} />
        )}
      </div>
    </section>
  )
}
