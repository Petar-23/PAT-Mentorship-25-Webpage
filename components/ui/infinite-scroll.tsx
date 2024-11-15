import React, { useRef, useEffect, useState } from 'react'

interface InfiniteScrollProps {
  children: React.ReactNode[]
  direction?: 'left' | 'right'
  speed?: number
  className?: string
  pauseOnHover?: boolean
  gap?: number
}

export default function InfiniteScroll({
  children,
  direction = 'left',
  speed = 20,
  className = '',
  pauseOnHover = true,
  gap = 16
}: InfiniteScrollProps) {
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [itemWidth, setItemWidth] = useState(0)
  const [items, setItems] = useState<React.ReactNode[]>([...children])
  const [position, setPosition] = useState(0)
  const animationFrameRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const velocityRef = useRef(0)
  const targetVelocityRef = useRef(0)

  useEffect(() => {
    setItems([...children, ...children, ...children])
  }, [children])

  useEffect(() => {
    if (!containerRef.current || !scrollRef.current) return

    const updateMeasurements = () => {
      if (!containerRef.current || !scrollRef.current) return
      
      const firstItem = scrollRef.current.children[0] as HTMLElement
      if (!firstItem) return

      const itemFullWidth = firstItem.offsetWidth + gap
      setItemWidth(itemFullWidth)
      setContainerWidth(containerRef.current.offsetWidth)
    }

    updateMeasurements()
    
    const resizeObserver = new ResizeObserver(updateMeasurements)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [gap])

  useEffect(() => {
    if (!itemWidth || !containerWidth) return

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const elapsed = timestamp - lastTimeRef.current
      
      targetVelocityRef.current = isHovered ? 0 : (direction === 'left' ? -speed : speed)
      velocityRef.current += (targetVelocityRef.current - velocityRef.current) * 0.1

      const delta = (elapsed * velocityRef.current) / 20
      const newPosition = position + delta
      
      if (direction === 'left' && Math.abs(newPosition) >= itemWidth) {
        setPosition(0)
        setItems(prev => [...prev.slice(1), prev[0]])
      } else if (direction === 'right' && newPosition >= 0) {
        setPosition(-itemWidth)
        setItems(prev => [prev[prev.length - 1], ...prev.slice(0, -1)])
      } else {
        setPosition(newPosition)
      }
      
      lastTimeRef.current = timestamp
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [itemWidth, containerWidth, direction, speed, isHovered, position])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`} // Removed h-full and w-full
    >
      <div
        ref={scrollRef}
        className="flex" // Removed absolute positioning and h-full
        style={{
          gap: `${gap}px`,
          transform: `translateX(${position}px)`,
          width: 'max-content'
        }}
      >
        {items.map((child, index) => (
          <div
            key={index}
            className="flex-shrink-0"
            onMouseEnter={() => pauseOnHover && setIsHovered(true)}
            onMouseLeave={() => {
              if (pauseOnHover) {
                setIsHovered(false)
                velocityRef.current = 0
              }
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}