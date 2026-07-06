'use client'

import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

interface CardMatrixRainProps {
  color?: string
  backgroundColor?: string
}

export function CardMatrixRain({ 
  color = '#2CC5C6',
  backgroundColor = 'rgba(0, 0, 0, 0.05)'
}: CardMatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isInView, setIsInView] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  )
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setIsInView(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(media.matches)

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const updateVisibility = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }

    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    if (!isInView || !isDocumentVisible || prefersReducedMotion) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Increase padding for better coverage
    const padding = 40
    const chars = '0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ+-<>'
    const fontSize = isMobile ? 10 : 12

    // IMPORTANT: rect can change when the card height changes (e.g. min-h on desktop).
    // We keep it mutable and update it on each resize so rain fills the full card.
    let rect = container.getBoundingClientRect()
    let columns = Math.ceil((rect.width + padding) / fontSize)
    let drops: number[] = Array(columns).fill(1)

    const initDrops = () => {
      for (let i = 0; i < drops.length; i++) {
        drops[i] = Math.random() * -50 // Increased range for initial positions
      }
    }

    initDrops()

    const resizeCanvas = () => {
      rect = container.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1

      // Prevent scale accumulation on repeated resizes
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      canvas.width = (rect.width + padding) * pixelRatio
      canvas.height = (rect.height + padding) * pixelRatio

      ctx.scale(pixelRatio, pixelRatio)

      canvas.style.width = `${rect.width + padding}px`
      canvas.style.height = `${rect.height + padding}px`
      canvas.style.left = `${-padding / 2}px`
      canvas.style.top = `${-padding / 2}px`

      const nextColumns = Math.ceil((rect.width + padding) / fontSize)
      if (nextColumns !== columns) {
        columns = nextColumns
        drops = Array(columns).fill(1)
        initDrops()
      }
    }

    resizeCanvas()

    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(container)

    const draw = () => {
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, rect.width + padding, rect.height + padding)

      ctx.fillStyle = color
      ctx.font = `${fontSize}px monospace`
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        const x = i * fontSize
        const y = drops[i] * fontSize

        ctx.fillText(text, x, y)

        // Reset drops with varied positions above
        if (y > rect.height + padding) {
          drops[i] = Math.random() * -10 - 1 // Varied reset positions
        }
        drops[i] += Math.random() * 0.5 + 0.5 // Varied drop speeds
      }
    }

    const interval = setInterval(draw, isMobile ? 80 : 50)

    return () => {
      clearInterval(interval)
      resizeObserver.disconnect()
    }
  }, [color, backgroundColor, isMobile, isInView, isDocumentVisible, prefersReducedMotion])

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 overflow-hidden"
    >
      <canvas 
        ref={canvasRef}
        className="absolute"
        style={{ 
          fontSmooth: 'never',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'none'
        }}
      />
    </div>
  )
}
