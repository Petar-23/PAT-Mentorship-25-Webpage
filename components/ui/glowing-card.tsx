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
      className={`relative group ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Animated border gradient */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-xl opacity-75 group-hover:opacity-100 blur animate-gradient-xy"></div>
      
      {/* Inner glow and content container */}
      <div className="relative rounded-xl overflow-hidden">
        {/* Inner gradient glow effect */}
        <div
          className="absolute inset-0 opacity-50 transition-opacity duration-200 group-hover:opacity-75"
          style={{
            background: `radial-gradient(200px circle at ${glowPosition.x}px ${glowPosition.y}px, rgba(255,255,255,0.1), transparent 40%)`,
          }}
        />
        
        {/* Background with blur */}
        <div className="relative bg-slate-900/90 backdrop-blur-sm p-[1px] rounded-xl">
          <div className="relative bg-slate-900/90 rounded-xl">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  )
}