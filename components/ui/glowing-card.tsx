// src/components/ui/glowing-card.tsx
'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface GlowingCardProps {
  children: React.ReactNode
  className?: string
}

export function GlowingCard({ children, className = '' }: GlowingCardProps) {
  const [glowPosition, setGlowPosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setGlowPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden rounded-xl backdrop-blur-sm ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(200px circle at ${glowPosition.x}px ${glowPosition.y}px, rgba(255,255,255,0.1), transparent 40%)`,
        }}
      />
      <div className="absolute inset-[1px] rounded-xl bg-gradient-to-t from-white/[0.05] to-transparent" />
      <div className="relative">{children}</div>
    </motion.div>
  )
}