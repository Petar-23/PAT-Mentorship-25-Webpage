"use client"

import dynamic from "next/dynamic"

type PageData = {
  id: string
  title: string
  slug: string
  content: Record<string, unknown> | null
  published: boolean
}

type Props = {
  page: PageData
}

const PageEditor = dynamic(() => import("@/components/page-editor").then((mod) => mod.PageEditor), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="mb-4 h-12 animate-pulse rounded-lg bg-muted" />
      <div className="h-[460px] animate-pulse rounded-xl border bg-background" />
    </div>
  ),
})

export function PageEditorLoader({ page }: Props) {
  return <PageEditor page={page} />
}
