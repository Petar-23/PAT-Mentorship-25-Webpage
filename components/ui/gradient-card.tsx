// src/components/ui/gradient-card.tsx
'use client'

import React, { useState, useRef} from 'react'
import { cn } from '@/lib/utils'

interface GradientCardProps {
  children: React.ReactNode
  className?: string
  gradientColor?: string
}

export function GradientCard({ 
  children, 
  className,
  gradientColor = "rgba(56, 189, 248, 0.2)" // Default color
}: GradientCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setPosition({ x, y })
  }

  const handleMouseEnter = () => {
    setIsHovering(true)
    setOpacity(1)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    setOpacity(0)
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-slate-900 p-8 border border-slate-800 transition-all duration-200",
        isHovering && "border-slate-700 shadow-lg shadow-slate-900/50",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Gradient */}
      <div 
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 40%)`,
        }}
      />
      
      {/* Border Gradient */}
      <div 
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-xl"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 40%)`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}