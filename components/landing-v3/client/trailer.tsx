'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

type NetworkInformationLike = { saveData?: boolean }

const TRAILER_SRC = '/landing/trailer-v4.mp4'
const POSTER_SRC = '/landing/poster-v4.jpg'

/**
 * Trailer im Hero: Das Poster ist ein vorgeladenes Bild (LCP), das Video lädt erst beim Abspielen (preload none).
 * Es startet stumm im Loop, erst nach dem Laden der Seite und nur solange es sichtbar ist.
 * Kein Autostart bei reduzierter Bewegung oder Datensparmodus; dann startet es nur über die Taste.
 */
export function Trailer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const heldRef = useRef(false)
  const [paused, setPaused] = useState(true)
  const [ready, setReady] = useState(false)

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const promise = video.play()
    if (promise) promise.catch(() => setPaused(video.paused))
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // React setzt muted nicht zuverlässig als Attribut; iOS braucht es vor play() für den Autostart.
    video.muted = true
    video.defaultMuted = true

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
    heldRef.current = calm || connection?.saveData === true

    let visible = false
    let loaded = document.readyState === 'complete'
    const maybePlay = () => {
      if (!heldRef.current && visible && loaded && !document.hidden) play()
    }

    const sync = () => setPaused(video.paused)
    const onPlaying = () => setReady(true)
    video.addEventListener('play', sync)
    video.addEventListener('pause', sync)
    video.addEventListener('playing', onPlaying)

    const onLoad = () => {
      loaded = true
      maybePlay()
    }
    if (!loaded) window.addEventListener('load', onLoad)

    let observer: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? false
          if (visible) maybePlay()
          else video.pause()
        },
        { threshold: 0.25 }
      )
      observer.observe(video)
    } else {
      visible = true
      maybePlay()
    }

    const onVisibility = () => {
      if (document.hidden) video.pause()
      else maybePlay()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      observer?.disconnect()
      window.removeEventListener('load', onLoad)
      document.removeEventListener('visibilitychange', onVisibility)
      video.removeEventListener('play', sync)
      video.removeEventListener('pause', sync)
      video.removeEventListener('playing', onPlaying)
      video.pause()
    }
  }, [play])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      heldRef.current = false
      play()
    } else {
      heldRef.current = true
      video.pause()
    }
  }

  return (
    <figure className="video rise" data-ready={ready ? '' : undefined}>
      <Image
        className="poster"
        src={POSTER_SRC}
        alt=""
        fill
        preload
        fetchPriority="high"
        sizes="(max-width: 900px) calc(100vw - 32px), 540px"
      />
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        onClick={toggle}
        aria-label="Einblick in die Mentorship: Petar spricht, eine Lektion, der Mitgliederbereich, Kurse und die Community auf Discord. 15 Sekunden, ohne Ton."
      >
        <source src={TRAILER_SRC} type="video/mp4" />
      </video>
      <figcaption>
        <b>Ein Blick in die Mentorship</b>
        <span>Lektionen, Mitgliederbereich, Community</span>
      </figcaption>
      <button
        className="vctl"
        type="button"
        data-state={paused ? 'paused' : 'playing'}
        aria-label={paused ? 'Video abspielen' : 'Video pausieren'}
        onClick={toggle}
      >
        <svg className="i-pause" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 2.5h2.6v11H4zM9.4 2.5H12v11H9.4z" />
        </svg>
        <svg className="i-play" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 2.2v11.6L13.6 8z" />
        </svg>
      </button>
    </figure>
  )
}
