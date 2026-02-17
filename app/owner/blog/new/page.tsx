'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import BlogEditor from '@/components/blog/blog-editor'

export default function NewBlogPostPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const isAdmin =
    user?.organizationMemberships?.some((membership) => membership.role === 'org:admin') || false

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !isAdmin) {
      router.replace('/')
    }
  }, [isLoaded, isSignedIn, isAdmin, router])

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
          <h1 className="font-sora text-3xl font-bold text-white">Neuer Artikel</h1>
          <p className="mt-1 text-gray-400">Erstelle einen neuen Blog-Artikel.</p>
        </div>

        <BlogEditor isNew />
      </div>
    </section>
  )
}
