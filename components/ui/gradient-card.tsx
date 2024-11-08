'use client'

import React, { useState, useRef} from 'react'
import { cn } from '@/lib/utils'

interface GradientPosition {
  x: number
  y: number
}

interface GradientCardProps {
  children: React.ReactNode
  className?: string
  gradientColor?: string
  initialGradientPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'center-left' | 'center-right'
  showGradientWithoutHover?: boolean
}

const getInitialPosition = (position: GradientCardProps['initialGradientPosition'], width: number, height: number): GradientPosition => {
  const positions: Record<NonNullable<GradientCardProps['initialGradientPosition']>, GradientPosition> = {
    'center': { x: width / 2, y: height / 2 },
    'top-left': { x: 0, y: 0 },
    'top-right': { x: width, y: 0 },
    'bottom-left': { x: 0, y: height },
    'bottom-right': { x: width, y: height },
    'top-center': { x: width / 2, y: 0 },
    'bottom-center': { x: width / 2, y: height },
    'center-left': { x: 0, y: height / 2 },
    'center-right': { x: width, y: height / 2 }
  }
  return positions[position || 'center']
}

export function GradientCard({ 
  children, 
  className,
  gradientColor = "rgba(56, 189, 248, 0.2)",
  initialGradientPosition = 'center',
  showGradientWithoutHover = false
}: GradientCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<GradientPosition>({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseEnter = () => {
    setIsHovering(true)
    if (!cardRef.current) return
    
    if (!isHovering && !showGradientWithoutHover) {
      const rect = cardRef.current.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    if (!cardRef.current) return

    if (showGradientWithoutHover) {
      const rect = cardRef.current.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }
  }

  React.useEffect(() => {
    if (cardRef.current && showGradientWithoutHover) {
      const rect = cardRef.current.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }
  }, [initialGradientPosition, showGradientWithoutHover])

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
          opacity: isHovering || showGradientWithoutHover ? 1 : 0,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 40%)`,
        }}
      />
      
      {/* Border Gradient */}
      <div 
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-xl"
        style={{
          opacity: isHovering || showGradientWithoutHover ? 1 : 0,
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