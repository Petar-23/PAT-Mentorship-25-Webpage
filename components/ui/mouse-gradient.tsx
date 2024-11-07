// src/components/ui/mouse-gradient.tsx
'use client'

import { useEffect, useState } from 'react'

interface MouseGradientProps {
  children: React.ReactNode
}

export function MouseGradient({ children }: MouseGradientProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY + window.scrollY
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(79, 70, 229, 0.1), transparent 40%)`,
        }}
      />
      {children}
    </div>
  )
}