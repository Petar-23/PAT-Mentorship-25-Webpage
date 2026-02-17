import Image from 'next/image'
import Link from 'next/link'
import { formatDateDE, type BlogPost } from '@/lib/blog'

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 transition duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5">
        <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
          <Image
            src={post.frontmatter.image || '/images/pat-banner.jpeg'}
            alt={post.frontmatter.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {post.frontmatter.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-400">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="font-sora mb-2 text-lg font-bold text-white transition group-hover:text-orange-400">
            {post.frontmatter.title}
          </h2>
          <p className="mb-4 line-clamp-2 text-sm text-gray-400">{post.frontmatter.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDateDE(post.frontmatter.date)}</span>
            <span>{post.readingTime}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
