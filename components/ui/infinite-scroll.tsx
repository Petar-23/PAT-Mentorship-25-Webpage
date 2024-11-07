// src/components/ui/infinite-scroll.tsx
'use client'

import { useRef } from "react"
import { motion } from "framer-motion"

interface InfiniteScrollProps {
  children: React.ReactNode
  direction?: "left" | "right"
  speed?: number
  className?: string
}

export function InfiniteScroll({ 
  children, 
  direction = "left", 
  speed = 20,
  className = "" 
}: InfiniteScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        ref={scrollRef}
        className="flex gap-4 whitespace-nowrap"
        animate={{
          x: direction === "left" ? 
            ["0%", "-50%"] : 
            ["-50%", "0%"]
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: speed,
            ease: "linear",
          },
        }}
      >
        {children}
        {children} {/* Duplicate for seamless loop */}
      </motion.div>
    </div>
  )
}