'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, FilmStrip as Film } from '@phosphor-icons/react'

const THUMBNAIL_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000] as const

type Props = {
  bunnyGuid: string | null
  title: string
  isProcessing?: boolean
  isWatched?: boolean
  updatedAt?: string | Date | null
}

export function VideoThumbnail({
  bunnyGuid,
  title,
  isProcessing = false,
  isWatched = false,
  updatedAt = null,
}: Props) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'fallback'>('idle')

  useEffect(() => {
    if (!bunnyGuid || isProcessing) {
      setAttempt(0)
      setStatus('idle')
      return
    }

    setAttempt(0)
    setStatus('loading')
  }, [bunnyGuid, isProcessing, updatedAt])

  useEffect(() => {
    if (!bunnyGuid || isProcessing || status !== 'fallback') return

    const delay = THUMBNAIL_RETRY_DELAYS_MS[attempt]
    if (delay == null) return

    const timer = window.setTimeout(() => {
      setAttempt((prev) => prev + 1)
      setStatus('loading')
    }, delay)

    return () => window.clearTimeout(timer)
  }, [attempt, bunnyGuid, isProcessing, status])

  const thumbnailSrc = useMemo(() => {
    if (!bunnyGuid) return null

    const version = updatedAt ? new Date(updatedAt).getTime() : 0
    return `https://vz-dc8da426-d71.b-cdn.net/${bunnyGuid}/thumbnail.jpg?v=${version}-${attempt}`
  }, [attempt, bunnyGuid, updatedAt])

  const showWatchedOverlay = isWatched && !isProcessing
  const showImage = Boolean(bunnyGuid && thumbnailSrc && !isProcessing && status !== 'fallback')
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
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('fallback')}
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
