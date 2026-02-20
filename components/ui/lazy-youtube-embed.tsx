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
            <div className="absolute inset-0 bg-black/12 transition-colors group-hover:bg-black/18" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-14 w-14 translate-y-[14%] items-center justify-center rounded-full border border-white/45 bg-white/18 text-white shadow-md backdrop-blur-[3px] transition-transform group-hover:scale-105 sm:h-16 sm:w-16">
                <Play className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
