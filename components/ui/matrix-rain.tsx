// src/components/ui/matrix-rain.tsx
'use client'

import { useEffect, useRef } from 'react'

interface MatrixRainProps {
  color?: string
}

export function MatrixRain({ color = 'rgba(128, 128, 128, 0.3)' }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Matrix rain characters (using numbers for a more trading-focused look)
    const chars = '0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ+-<>'
    const fontSize = 12
    const columns = canvas.width / fontSize
    const drops: number[] = []

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * canvas.height/fontSize) * -1
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)' // Very subtle fade effect
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = color
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
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
  }, [color])

  return (
    <canvas 
      ref={canvasRef}
      className="absolute inset-0"
      style={{ 
        width: '100%',
        height: '100%'
      }}
    />
  )
}