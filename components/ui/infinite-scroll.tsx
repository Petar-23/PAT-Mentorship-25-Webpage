import React, { useRef, useEffect, useMemo } from 'react'

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
  const isHoveredRef = useRef(false)
  const initializedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sequenceWidthRef = useRef(0)
  const positionRef = useRef(0)
  const animationFrameRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const velocityRef = useRef(0)
  const targetVelocityRef = useRef(0)

  const baseItems = useMemo(() => React.Children.toArray(children), [children])
  const baseCount = baseItems.length
  const items = useMemo(() => [...baseItems, ...baseItems], [baseItems])

  const applyTransform = (x: number) => {
    if (!scrollRef.current) return
    scrollRef.current.style.transform = `translateX(${x}px)`
  }

  useEffect(() => {
    if (!containerRef.current || !scrollRef.current) return

    const updateMeasurements = () => {
      if (!containerRef.current || !scrollRef.current) return

      // We render 2x the list. The second copy starts at index `baseCount`.
      // Measuring that offset gives us the full width of ONE sequence including gaps/margins.
      const first = scrollRef.current.children[0] as HTMLElement | undefined
      const secondStart = scrollRef.current.children[baseCount] as HTMLElement | undefined
      if (!first || !secondStart) return

      const sequenceWidth = secondStart.offsetLeft - first.offsetLeft
      if (!(sequenceWidth > 0)) return
      sequenceWidthRef.current = sequenceWidth

      if (!initializedRef.current) {
        const initial = direction === 'right' ? -sequenceWidth : 0
        positionRef.current = initial
        applyTransform(initial)
        initializedRef.current = true
      }
    }

    updateMeasurements()
    
    const resizeObserver = new ResizeObserver(updateMeasurements)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [gap, baseCount, direction])

  useEffect(() => {
    // Re-initialize when direction or content changes.
    initializedRef.current = false
  }, [direction, baseCount, gap])

  useEffect(() => {
    if (!baseCount) return

    // Reset timing when (re)starting the animation to avoid huge elapsed deltas.
    lastTimeRef.current = 0

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const elapsed = timestamp - lastTimeRef.current

      const sequenceWidth = sequenceWidthRef.current
      if (!(sequenceWidth > 0)) {
        lastTimeRef.current = timestamp
        animationFrameRef.current = requestAnimationFrame(animate)
        return
      }
      
      const isPaused = pauseOnHover && isHoveredRef.current
      targetVelocityRef.current = isPaused ? 0 : (direction === 'left' ? -speed : speed)
      velocityRef.current += (targetVelocityRef.current - velocityRef.current) * 0.1

      const delta = (elapsed * velocityRef.current) / 20
      let newPosition = positionRef.current + delta
      
      if (direction === 'left' && newPosition <= -sequenceWidth) {
        const steps = Math.floor(Math.abs(newPosition) / sequenceWidth)
        newPosition = newPosition + sequenceWidth * steps
      } else if (direction === 'right' && newPosition >= 0) {
        const steps = Math.floor(newPosition / sequenceWidth) + 1
        newPosition = newPosition - sequenceWidth * steps
      }

      positionRef.current = newPosition
      applyTransform(newPosition)
      
      lastTimeRef.current = timestamp
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [direction, speed, pauseOnHover, baseCount])

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
          width: 'max-content',
          willChange: 'transform',
        }}
      >
        {items.map((child, index) => (
          <div
            key={index}
            className="flex-shrink-0"
            onMouseEnter={() => {
              if (!pauseOnHover) return
              isHoveredRef.current = true
            }}
            onMouseLeave={() => {
              if (!pauseOnHover) return
              isHoveredRef.current = false
              velocityRef.current = 0
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}