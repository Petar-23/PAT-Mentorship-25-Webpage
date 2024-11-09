'use client'

import { useEffect, useRef } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

interface MatrixRainProps {
  color?: string
}

export function MatrixRain({ color = 'rgba(128, 128, 128, 0.3)' }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match window size with proper pixel ratio
    const resizeCanvas = () => {
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * pixelRatio
      canvas.height = window.innerHeight * pixelRatio
      
      // Scale the context to ensure correct drawing operations
      ctx.scale(pixelRatio, pixelRatio)
      
      // Set canvas CSS size
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Matrix rain characters (using numbers for a more trading-focused look)
    const chars = '0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ+-<>'
    
    // Adjust font size based on device
    const fontSize = isMobile ? 10 : 12
    const columns = Math.floor(window.innerWidth / fontSize)
    const drops: number[] = []

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * canvas.height/fontSize) * -1
    }

    const draw = () => {
      // Semi-transparent fade effect for trailing characters
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

      ctx.fillStyle = color
      ctx.font = `${fontSize}px monospace`
      ctx.textAlign = 'center'
      
      // Adjust character spacing based on device
      const charSpacing = isMobile ? fontSize * 0.8 : fontSize

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        const x = i * charSpacing
        const y = drops[i] * fontSize
        
        // Only draw if within visible bounds
        if (y > 0 && y < window.innerHeight && x < window.innerWidth) {
          ctx.fillText(text, x, y)
        }

        // Move drops down and reset when needed
        if (y > window.innerHeight && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, 50)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [color, isMobile])

  return (
    <canvas 
      ref={canvasRef}
      className="absolute inset-0"
      style={{ 
        width: '100%',
        height: '100%',
        fontSmooth: 'never',
        WebkitFontSmoothing: 'none',
        MozOsxFontSmoothing: 'none'
      }}
    />
  )
}