'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'

type LazyYouTubeEmbedProps = {
  videoId: string
  title: string
  className?: string
}

export function LazyYouTubeEmbed({ videoId, title, className }: LazyYouTubeEmbedProps) {
  const [isActivated, setIsActivated] = useState(false)
  const [thumbnailIndex, setThumbnailIndex] = useState(0)

  const embedUrl = useMemo(
    () => `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
    [videoId]
  )

  const thumbnailCandidates = useMemo(
    () => [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/0.jpg`,
    ],
    [videoId]
  )

  const hasThumbnail = thumbnailIndex < thumbnailCandidates.length

  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm', className)}>
      <div className="relative aspect-video w-full bg-slate-100">
        {isActivated ? (
          <iframe
            className="h-full w-full"
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsActivated(true)}
            aria-label={`${title} abspielen`}
            className="group relative h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {hasThumbnail ? (
              <Image
                src={thumbnailCandidates[thumbnailIndex]}
                alt={`${title} Video-Vorschau`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px"
                className="object-cover"
                onError={() => setThumbnailIndex((prev) => prev + 1)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                <p className="px-4 text-center text-sm sm:text-base opacity-90">Video-Vorschau derzeit nicht verfügbar</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/25" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-[3px] transition-transform group-hover:scale-105">
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Video abspielen
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
