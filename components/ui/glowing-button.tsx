// src/components/ui/glowing-button.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface GlowingButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function GlowingButton({ children, onClick, className = '' }: GlowingButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState<number | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const button = buttonRef.current
    if (!button) return

    const updateMousePosition = (ev: MouseEvent) => {
      const rect = button.getBoundingClientRect()
      const x = ev.clientX - rect.left
      setMousePosition(x)
    }

    button.addEventListener('mousemove', updateMousePosition)
    return () => button.removeEventListener('mousemove', updateMousePosition)
  }, [])

  return (
    <motion.div 
      className="relative"
      style={{ zIndex: isHovered ? 50 : 1 }}
    >
      <motion.div
        ref={buttonRef}
        className={`relative bg-white rounded-full cursor-pointer ${className}`}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => {
          setIsHovered(false)
          setMousePosition(null)
        }}
        onClick={onClick}
        animate={{
          boxShadow: isHovered
            ? `${mousePosition && mousePosition > (buttonRef.current?.offsetWidth ?? 0) / 2 ? '8px' : '-8px'} 0 20px rgba(255, 177, 66, 0.3)`
            : '8px 0 20px rgba(255, 177, 66, 0)'
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Internal gradient glow */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-0"
            animate={{
              background: isHovered
                ? `linear-gradient(180deg, 
                    transparent 0%, 
                    rgba(255, 177, 66, 0) ${(mousePosition ?? 0) - 100}px,
                    rgba(255, 177, 66, 0.5) ${mousePosition ?? 0}px,
                    rgba(255, 177, 66, 0) ${(mousePosition ?? 0) + 100}px,
                    transparent 100%)`
                : 'linear-gradient(90deg, transparent 0%, rgba(255, 177, 66, 0) 40%, rgba(255, 177, 66, 0.5) 50%, rgba(255, 177, 66, 0) 60%, transparent 100%)'
            }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Border */}
        <div className="absolute inset-0 rounded-full border border-amber-500/20" />

        {/* Content */}
        <div className="relative px-6 py-2 text-gray-900">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}