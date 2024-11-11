'use client'

import React, { useState, useRef, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface GradientPosition {
  x: number
  y: number
}

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
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

export const GradientCard = forwardRef<HTMLDivElement, GradientCardProps>(({
  children, 
  className,
  gradientColor = "rgba(56, 189, 248, 0.2)",
  initialGradientPosition = 'center',
  showGradientWithoutHover = false,
  onMouseMove: externalMouseMove,
  onMouseEnter: externalMouseEnter,
  onMouseLeave: externalMouseLeave,
  ...props
}, ref) => {
  const innerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<GradientPosition>({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const element = (ref as React.RefObject<HTMLDivElement>)?.current || innerRef.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })

    externalMouseMove?.(e)
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovering(true)
    const element = (ref as React.RefObject<HTMLDivElement>)?.current || innerRef.current
    if (!element) return
    
    if (!isHovering && !showGradientWithoutHover) {
      const rect = element.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }

    externalMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovering(false)
    const element = (ref as React.RefObject<HTMLDivElement>)?.current || innerRef.current
    if (!element) return

    if (showGradientWithoutHover) {
      const rect = element.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }

    externalMouseLeave?.(e)
  }

  React.useEffect(() => {
    const element = (ref as React.RefObject<HTMLDivElement>)?.current || innerRef.current
    if (element && showGradientWithoutHover) {
      const rect = element.getBoundingClientRect()
      setPosition(getInitialPosition(initialGradientPosition, rect.width, rect.height))
    }
  }, [initialGradientPosition, showGradientWithoutHover, ref])

  return (
    <div
      ref={ref || innerRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 transition-all duration-200",
        isHovering && "border-slate-700 shadow-lg shadow-slate-900/50",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
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
})

GradientCard.displayName = 'GradientCard'