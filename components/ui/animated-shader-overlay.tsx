'use client'

import { useEffect, useRef, useState } from 'react'

const fallbackBackground =
  'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(6, 182, 212, 0.15) 100%)'

const shouldAnimateShader = () => {
  if (typeof window === 'undefined') return false
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return window.innerWidth >= 1024 && !('ontouchstart' in window) && !prefersReducedMotion
}

export function AnimatedShaderOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let disposeShader: (() => void) | null = null
    let isLoading = false
    let isVisible = false
    let isDocumentVisible = document.visibilityState === 'visible'
    let loadVersion = 0

    const stopShader = () => {
      loadVersion += 1
      disposeShader?.()
      disposeShader = null
    }

    const updateFallback = () => {
      setShowFallback(!shouldAnimateShader() && window.innerWidth >= 1024)
    }

    const startShader = async () => {
      if (
        disposed ||
        !isVisible ||
        !isDocumentVisible ||
        isLoading ||
        disposeShader ||
        !shouldAnimateShader()
      ) return

      const version = loadVersion
      isLoading = true
      try {
        const { mountAnimatedShader } = await import('@/components/ui/animated-shader-runtime')
        if (
          disposed ||
          version !== loadVersion ||
          !isVisible ||
          !isDocumentVisible ||
          !shouldAnimateShader()
        ) return

        const cleanup = await mountAnimatedShader(container)
        if (
          disposed ||
          version !== loadVersion ||
          !isVisible ||
          !isDocumentVisible ||
          !shouldAnimateShader()
        ) {
          cleanup()
          return
        }

        disposeShader = cleanup
        setShowFallback(false)
      } finally {
        isLoading = false
      }
    }

    updateFallback()

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) {
          void startShader()
        } else {
          stopShader()
          updateFallback()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(container)

    const handleViewportChange = () => {
      if (!isVisible || !isDocumentVisible || !shouldAnimateShader()) {
        stopShader()
      } else {
        void startShader()
      }
      updateFallback()
    }

    const handleVisibilityChange = () => {
      isDocumentVisible = document.visibilityState === 'visible'
      handleViewportChange()
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    window.addEventListener('resize', handleViewportChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    reducedMotionQuery.addEventListener?.('change', handleViewportChange)

    return () => {
      disposed = true
      observer.disconnect()
      window.removeEventListener('resize', handleViewportChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotionQuery.removeEventListener?.('change', handleViewportChange)
      stopShader()
    }
  }, [])

  return (
    <div ref={containerRef} aria-hidden="true" className="absolute inset-0 z-0">
      <div
        className={showFallback ? 'absolute inset-0 opacity-60' : 'absolute inset-0 opacity-60 lg:hidden'}
        style={{ background: fallbackBackground }}
      />
    </div>
  )
}
