'use client'

import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1
      
      // Increase padding for better coverage
      const padding = 40
      canvas.width = (rect.width + padding) * pixelRatio
      canvas.height = (rect.height + padding) * pixelRatio
      
      ctx.scale(pixelRatio, pixelRatio)
      
      canvas.style.width = `${rect.width + padding}px`
      canvas.style.height = `${rect.height + padding}px`
      canvas.style.left = `${-padding/2}px`
      canvas.style.top = `${-padding/2}px`
    }
    
    resizeCanvas()
    
    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(container)

    const chars = '0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ+-<>'
    
    const fontSize = isMobile ? 10 : 12
    const rect = container.getBoundingClientRect()
    const columns = Math.ceil((rect.width + 40) / fontSize)
    const drops: number[] = Array(columns).fill(1)

    // Initialize drops with better distribution
    for (let i = 0; i < drops.length; i++) {
      drops[i] = Math.random() * -50 // Increased range for initial positions
    }

    const draw = () => {
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = color
      ctx.font = `${fontSize}px monospace`
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        const x = i * fontSize
        const y = drops[i] * fontSize

        ctx.fillText(text, x, y)

        // Reset drops with varied positions above
        if (y > rect.height + 40) {
          drops[i] = Math.random() * -10 - 1 // Varied reset positions
        }
        drops[i] += Math.random() * 0.5 + 0.5 // Varied drop speeds
      }
    }

    const interval = setInterval(draw, 50)

    return () => {
      clearInterval(interval)
      resizeObserver.disconnect()
    }
  }, [color, backgroundColor, isMobile])

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