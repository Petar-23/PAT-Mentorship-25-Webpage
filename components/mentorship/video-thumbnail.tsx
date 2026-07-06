'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check } from '@phosphor-icons/react/Check'
import { FilmStrip as Film } from '@phosphor-icons/react/FilmStrip'
import { normalizeBunnyThumbnailUrl } from '@/lib/bunny-thumbnail'

const THUMBNAIL_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000] as const

type Props = {
  bunnyGuid: string | null
  thumbnailUrl?: string | null
  title: string
  isProcessing?: boolean
  isWatched?: boolean
  updatedAt?: string | Date | null
}

type ThumbnailLoadState = {
  key: string
  attempt: number
  status: 'idle' | 'loading' | 'loaded' | 'fallback'
}

export function VideoThumbnail({
  bunnyGuid,
  thumbnailUrl = null,
  title,
  isProcessing = false,
  isWatched = false,
  updatedAt = null,
}: Props) {
  const stateKey = `${bunnyGuid ?? 'none'}:${thumbnailUrl ?? 'none'}:${isProcessing ? 'processing' : 'ready'}:${updatedAt ? new Date(updatedAt).getTime() : 0}`
  const initialStatus: ThumbnailLoadState['status'] = !bunnyGuid || isProcessing ? 'idle' : 'loading'
  const [loadState, setLoadState] = useState<ThumbnailLoadState>(() => ({
    key: stateKey,
    attempt: 0,
    status: initialStatus,
  }))

  const attempt = loadState.key === stateKey ? loadState.attempt : 0
  const status = loadState.key === stateKey ? loadState.status : initialStatus

  useEffect(() => {
    if (!bunnyGuid || isProcessing || status !== 'fallback') return

    const delay = THUMBNAIL_RETRY_DELAYS_MS[attempt]
    if (delay == null) return

    const timer = window.setTimeout(() => {
      setLoadState((prev) => ({
        key: stateKey,
        attempt: prev.key === stateKey ? prev.attempt + 1 : 1,
        status: 'loading',
      }))
    }, delay)

    return () => window.clearTimeout(timer)
  }, [attempt, bunnyGuid, isProcessing, stateKey, status])

  const thumbnailSrc = useMemo(() => {
    const version = updatedAt ? new Date(updatedAt).getTime() : 0
    const cacheBust = `v=${version}-${attempt}`

    const appendCacheBust = (src: string) =>
      `${src}${src.includes('?') ? '&' : '?'}${cacheBust}`

    const normalizedThumbnailUrl = normalizeBunnyThumbnailUrl(thumbnailUrl, bunnyGuid)
    if (normalizedThumbnailUrl) {
      return appendCacheBust(normalizedThumbnailUrl)
    }

    return null
  }, [attempt, bunnyGuid, thumbnailUrl, updatedAt])

  const showWatchedOverlay = isWatched && !isProcessing
  const showImage = Boolean(thumbnailSrc && !isProcessing && status !== 'fallback')
  const showRetryHint = status === 'fallback' && attempt < THUMBNAIL_RETRY_DELAYS_MS.length

  return (
    <div className="relative w-24 h-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-md bg-gray-200">
      {isProcessing ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 w-6 h-6 rounded-full border-2 border-gray-500" />
            <div className="absolute inset-0 w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </div>
      ) : showImage && thumbnailSrc ? (
        <Image
          key={thumbnailSrc}
          src={thumbnailSrc}
          alt={title}
          fill
          sizes="96px"
          className={[
            'object-cover transition-opacity duration-200',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          unoptimized
          referrerPolicy="origin"
          onLoad={() => setLoadState({ key: stateKey, attempt, status: 'loaded' })}
          onError={() => setLoadState({ key: stateKey, attempt, status: 'fallback' })}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {showRetryHint ? (
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 w-5 h-5 rounded-full border-2 border-gray-400" />
              <div className="absolute inset-0 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <Film className="h-5 w-5 text-muted-foreground/70" />
          )}
        </div>
      )}

      {showWatchedOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-600/30">
          <div className="h-7 w-7 rounded-full border border-white/60 bg-white/40 flex items-center justify-center shadow-sm">
            <Check className="h-4 w-4 text-black/70" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
