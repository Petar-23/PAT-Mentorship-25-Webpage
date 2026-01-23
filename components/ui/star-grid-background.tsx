"use client"

import React, { useEffect, useRef } from "react"

interface StarGridBackgroundProps {
  className?: string
  showGrid?: boolean
  particleColor?: string
  gridColor?: string
}

export function StarGridBackground({
  className = "",
  showGrid = true,
  particleColor = "rgba(100, 100, 120, 0.6)",
  gridColor = "rgba(200, 200, 210, 0.4)",
}: StarGridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const setSize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    setSize()

    type Particle = {
      x: number
      y: number
      speed: number
      opacity: number
      fadeDelay: number
      fadeStart: number
      fadingOut: boolean
    }

    let particles: Particle[] = []
    let raf = 0

    const count = () => Math.floor((canvas.width * canvas.height) / 10000)

    const make = (): Particle => {
      const fadeDelay = Math.random() * 600 + 100
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: Math.random() / 5 + 0.1,
        opacity: 0.7,
        fadeDelay,
        fadeStart: Date.now() + fadeDelay,
        fadingOut: false,
      }
    }

    const reset = (p: Particle) => {
      p.x = Math.random() * canvas.width
      p.y = Math.random() * canvas.height
      p.speed = Math.random() / 5 + 0.1
      p.opacity = 0.7
      p.fadeDelay = Math.random() * 600 + 100
      p.fadeStart = Date.now() + p.fadeDelay
      p.fadingOut = false
    }

    const init = () => {
      particles = []
      for (let i = 0; i < count(); i++) particles.push(make())
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.y -= p.speed
        if (p.y < 0) reset(p)
        if (!p.fadingOut && Date.now() > p.fadeStart) p.fadingOut = true
        if (p.fadingOut) {
          p.opacity -= 0.008
          if (p.opacity <= 0) reset(p)
        }
        ctx.fillStyle = particleColor.replace("0.6", String(p.opacity))
        ctx.fillRect(p.x, p.y, 0.8, Math.random() * 2 + 1)
      })
      raf = requestAnimationFrame(draw)
    }

    const onResize = () => {
      setSize()
      init()
    }

    window.addEventListener("resize", onResize)
    init()
    raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(raf)
    }
  }, [particleColor])

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-80"
      />

      {/* Animated Grid Lines */}
      {showGrid && (
        <div className="absolute inset-0">
          {/* Horizontal Lines */}
          <div
            className="absolute left-0 right-0 h-px animate-draw-x"
            style={{ 
              top: "20%", 
              background: gridColor,
              animationDelay: "150ms",
            }}
          />
          <div
            className="absolute left-0 right-0 h-px animate-draw-x"
            style={{ 
              top: "50%", 
              background: gridColor,
              animationDelay: "280ms",
            }}
          />
          <div
            className="absolute left-0 right-0 h-px animate-draw-x"
            style={{ 
              top: "80%", 
              background: gridColor,
              animationDelay: "410ms",
            }}
          />

          {/* Vertical Lines */}
          <div
            className="absolute top-0 bottom-0 w-px animate-draw-y"
            style={{ 
              left: "20%", 
              background: gridColor,
              animationDelay: "520ms",
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-px animate-draw-y"
            style={{ 
              left: "50%", 
              background: gridColor,
              animationDelay: "640ms",
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-px animate-draw-y"
            style={{ 
              left: "80%", 
              background: gridColor,
              animationDelay: "760ms",
            }}
          />
        </div>
      )}
    </div>
  )
}
