import Image from 'next/image'
import Link from 'next/link'
import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'

function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip'; children: ReactNode }) {
  const styles = {
    info: 'border-blue-500 bg-blue-500/10 text-blue-300',
    warning: 'border-yellow-500 bg-yellow-500/10 text-yellow-300',
    tip: 'border-green-500 bg-green-500/10 text-green-300',
  }
  const icons = { info: 'ℹ️', warning: '⚠️', tip: '💡' }

  return (
    <div className={`my-6 rounded-lg border-l-4 p-4 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icons[type]}</span>
        <div className="prose-sm">{children}</div>
      </div>
    </div>
  )
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative my-8 aspect-video w-full overflow-hidden rounded-xl">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}

function CTABanner() {
  return (
    <div className="my-10 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-slate-900 p-8 text-center">
      <h3 className="font-sora mb-3 text-2xl font-bold text-white">Bereit für den nächsten Schritt?</h3>
      <p className="mb-6 text-gray-300">
        Lerne Trading nach ICT Konzepten im Live-Mentoring — auf Deutsch, mit persönlicher Betreuung.
      </p>
      <Link
        href="/lp-v2"
        className="inline-block rounded-lg bg-orange-500 px-8 py-3 font-semibold text-white transition hover:bg-orange-600"
      >
        Zum Mentorship →
      </Link>
    </div>
  )
}

export const customComponents = {
  Callout,
  YouTubeEmbed,
  CTABanner,
}

export function useMDXComponents(): MDXComponents {
  return {
    ...customComponents,
    h1: ({ children }) => (
      <h1 className="font-sora mb-6 mt-10 text-4xl font-bold text-white">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-sora mb-4 mt-8 text-2xl font-bold text-white">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-sora mb-3 mt-6 text-xl font-semibold text-white">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="font-sora mb-2 mt-4 text-lg font-semibold text-gray-200">{children}</h4>
    ),
    p: ({ children }) => <p className="mb-4 leading-relaxed text-gray-300">{children}</p>,
    ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6 text-gray-300">{children}</ul>,
    ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6 text-gray-300">{children}</ol>,
    li: ({ children }) => <li className="text-gray-300">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-orange-500 pl-4 italic text-gray-400">{children}</blockquote>
    ),
    a: ({ href, children }) => (
      <Link href={href ?? '#'} className="text-orange-400 underline decoration-orange-400/30 transition hover:decoration-orange-400">
        {children}
      </Link>
    ),
    img: ({ src, alt }) => (
      <span className="my-6 block overflow-hidden rounded-xl">
        <Image src={src ?? ''} alt={alt ?? ''} width={800} height={450} className="w-full rounded-xl" />
      </span>
    ),
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-')
      if (isBlock) {
        return (
          <code className={`block overflow-x-auto rounded-lg bg-slate-800 p-4 text-sm text-gray-200 ${className ?? ''}`}>
            {children}
          </code>
        )
      }
      return <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-orange-300">{children}</code>
    },
    pre: ({ children }) => (
      <pre className="my-6 overflow-x-auto rounded-xl bg-slate-800/80 p-4 text-sm">{children}</pre>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm text-gray-300">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-slate-700 bg-slate-800 px-4 py-2 text-left font-semibold text-white">{children}</th>
    ),
    td: ({ children }) => <td className="border border-slate-700 px-4 py-2">{children}</td>,
    hr: () => <hr className="my-8 border-slate-700" />,
  }
}
