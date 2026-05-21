import type { ReactNode } from 'react'
import { AnimatedShaderOverlay } from '@/components/ui/animated-shader-overlay'

interface AnimatedShaderBackgroundProps {
  children?: ReactNode
  className?: string
}

const AnimatedShaderBackground = ({ children, className }: AnimatedShaderBackgroundProps) => {
  return (
    <div className={`relative overflow-hidden bg-neutral-950 ${className || ''}`}>
      <AnimatedShaderOverlay />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export default AnimatedShaderBackground
