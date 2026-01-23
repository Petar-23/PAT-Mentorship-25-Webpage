"use client"

import { useEffect, useRef, useState } from "react"

interface Vector2D {
  x: number
  y: number
}

// Scattered color when particles are far from target
const SCATTERED_COLOR = { r: 255, g: 100, b: 100 } // Red-ish when scattered

class Particle {
  pos: Vector2D = { x: 0, y: 0 }
  vel: Vector2D = { x: 0, y: 0 }
  acc: Vector2D = { x: 0, y: 0 }
  target: Vector2D = { x: 0, y: 0 }

  closeEnoughTarget = 50
  maxSpeed = 1.0
  maxForce = 0.1

  startColor = { r: 0, g: 0, b: 0 }
  targetColor = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.01

  getDistanceFromTarget(): number {
    return Math.sqrt(Math.pow(this.pos.x - this.target.x, 2) + Math.pow(this.pos.y - this.target.y, 2))
  }

  move() {
    let proximityMult = 1
    const distance = this.getDistanceFromTarget()

    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }

    const magnitude = Math.sqrt(towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y)
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    }

    const steerMagnitude = Math.sqrt(steer.x * steer.x + steer.y * steer.y)
    if (steerMagnitude > 0) {
      steer.x = (steer.x / steerMagnitude) * this.maxForce
      steer.y = (steer.y / steerMagnitude) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y

    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  // Repel from mouse position
  repel(mouseX: number, mouseY: number, radius: number, force: number) {
    const dx = this.pos.x - mouseX
    const dy = this.pos.y - mouseY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < radius && distance > 0) {
      const strength = (radius - distance) / radius * force
      this.vel.x += (dx / distance) * strength
      this.vel.y += (dy / distance) * strength
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }

    // Calculate base color from animation
    const baseColor = {
      r: Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight),
      g: Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight),
      b: Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight),
    }

    // Calculate scatter factor based on distance from target
    const distance = this.getDistanceFromTarget()
    const scatterThreshold = 15 // Start color change after this distance
    const maxScatterDistance = 80 // Full scatter color at this distance
    
    let scatterFactor = 0
    if (distance > scatterThreshold) {
      scatterFactor = Math.min((distance - scatterThreshold) / (maxScatterDistance - scatterThreshold), 1)
    }

    // Blend between base color and scattered color
    const currentColor = {
      r: Math.round(baseColor.r + (SCATTERED_COLOR.r - baseColor.r) * scatterFactor),
      g: Math.round(baseColor.g + (SCATTERED_COLOR.g - baseColor.g) * scatterFactor),
      b: Math.round(baseColor.b + (SCATTERED_COLOR.b - baseColor.b) * scatterFactor),
    }

    ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
    ctx.fillRect(this.pos.x, this.pos.y, 1.5, 1.5)
  }
}

interface ParticleTextRevealProps {
  text: string
  className?: string
  fontSize?: number
}

// Fixed colors: purple, blue, cyan
const COLORS = [
  { r: 168, g: 85, b: 247 },  // purple-500
  { r: 59, g: 130, b: 246 },  // blue-500
  { r: 6, g: 182, b: 212 },   // cyan-500
]

export function ParticleTextReveal({
  text,
  className = "",
  fontSize = 100,
}: ParticleTextRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })

  const pixelSteps = 2 // More particles for better text quality
  const padding = 80 // Extra space around text for particles to fly into
  const [textDimensions, setTextDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Measure text size first with temp canvas
    const tempCanvas = document.createElement("canvas")
    const tempCtx = tempCanvas.getContext("2d")!
    tempCtx.font = `bold ${fontSize}px Arial`
    const metrics = tempCtx.measureText(text)
    
    const textWidth = Math.ceil(metrics.width + 20)
    const textHeight = Math.ceil(fontSize * 1.3)
    setTextDimensions({ width: textWidth, height: textHeight })
    
    // Canvas is larger with padding
    const canvasWidth = textWidth + padding * 2
    const canvasHeight = textHeight + padding * 2
    
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    
    const ctx = canvas.getContext("2d")!

    const generateRandomPos = (centerX: number, centerY: number, mag: number): Vector2D => {
      const angle = Math.random() * Math.PI * 2
      return {
        x: centerX + Math.cos(angle) * mag,
        y: centerY + Math.sin(angle) * mag,
      }
    }

    // Create offscreen canvas to get text pixels (original text size)
    const offscreenCanvas = document.createElement("canvas")
    offscreenCanvas.width = textWidth
    offscreenCanvas.height = textHeight
    const offscreenCtx = offscreenCanvas.getContext("2d")!

    offscreenCtx.fillStyle = "white"
    offscreenCtx.font = `bold ${fontSize}px Arial`
    offscreenCtx.textAlign = "center"
    offscreenCtx.textBaseline = "middle"
    offscreenCtx.fillText(text, textWidth / 2, textHeight / 2)

    const imageData = offscreenCtx.getImageData(0, 0, textWidth, textHeight)
    const pixels = imageData.data

    const particles: Particle[] = []
    
    // Collect all text pixel coordinates (offset by padding)
    for (let y = 0; y < textHeight; y += pixelSteps) {
      for (let x = 0; x < textWidth; x += pixelSteps) {
        const i = (y * textWidth + x) * 4
        const alpha = pixels[i + 3]

        if (alpha > 0) {
          const particle = new Particle()

          const randomPos = generateRandomPos(canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight))
          particle.pos.x = randomPos.x
          particle.pos.y = randomPos.y

          // Target position offset by padding
          particle.target.x = x + padding
          particle.target.y = y + padding

          particle.maxSpeed = Math.random() * 5 + 3
          particle.maxForce = particle.maxSpeed * 0.04
          particle.colorBlendRate = Math.random() * 0.015 + 0.005

          // Pick random color from our palette
          const color = COLORS[Math.floor(Math.random() * COLORS.length)]
          particle.startColor = { r: 180, g: 180, b: 180 }
          particle.targetColor = color
          particle.colorWeight = 0

          particles.push(particle)
        }
      }
    }

    particlesRef.current = particles

    const animate = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      for (const particle of particlesRef.current) {
        // Repel from mouse
        particle.repel(mouseRef.current.x, mouseRef.current.y, 50, 3)
        particle.move()
        particle.draw(ctx)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    // Mouse event handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000
      mouseRef.current.y = -1000
    }

    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseleave", handleMouseLeave)

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [text, fontSize])

  return (
    <span 
      className={`inline-block relative ${className}`} 
      style={{ 
        verticalAlign: "middle",
        // Use text dimensions for sizing (not canvas dimensions)
        width: textDimensions.width > 0 ? textDimensions.width : "auto",
        height: textDimensions.height > 0 ? textDimensions.height : "auto",
      }}
    >
      {/* Invisible placeholder text to maintain correct inline sizing */}
      <span 
        style={{ 
          visibility: "hidden",
          font: `bold ${fontSize}px Arial`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      
      {/* Canvas positioned absolutely, centered over the placeholder */}
      <canvas
        ref={canvasRef}
        style={{ 
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%)`,
          cursor: "default",
          pointerEvents: "auto",
        }}
      />
    </span>
  )
}
