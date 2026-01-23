'use client'

import { useState } from 'react'
import { CardMatrixRain } from '@/components/ui/card-matrix-rain'
import { GlowingEffect } from '@/components/ui/glowing-effect'

interface CardWithMatrixProps extends React.PropsWithChildren {
  icon: React.ReactNode
  title?: string // Make title optional
  value?: string
  subtitle?: string
  description?: string
  iconColor: string
  rainColor?: string
  gradientColor?: string
  className?: string
}

export function CardWithMatrix({ 
  icon, 
  title, 
  value, 
  subtitle, 
  description, 
  iconColor,
  rainColor = "#2CC5C6",
  className,
  children
}: CardWithMatrixProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Add type guard to ensure title is provided when there's no value
  if (!value && !title) {
    throw new Error('CardWithMatrix requires either a value or a title')
  }

  return (
    <div 
      className={`relative h-full rounded-xl border border-slate-700 p-0.5 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={3}
        variant="custom"
        color={rainColor}
      />
      <div className="relative flex h-full flex-col rounded-lg bg-slate-900 overflow-hidden">
        {/* Matrix Rain Background */}
        <div 
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.2 : 0.1,
          }}
        >
          <CardMatrixRain 
            color={rainColor}
            backgroundColor="rgba(15, 23, 42, 0.05)"
          />
        </div>

        {/* Content */}
        {children ? (
          <div className="relative z-10">
            {children}
          </div>
        ) : (
          <div className="relative z-10 p-2.5 sm:p-6">
            {value ? (
              // Stats Card Layout
              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`h-6 w-6 sm:h-10 sm:w-10 ${iconColor}`}>
                  {icon}
                </div>
                <div>
                  <p className="text-sm sm:text-2xl font-bold text-white">{value}</p>
                  <p className="text-[10px] sm:text-sm text-gray-400">{subtitle}</p>
                </div>
              </div>
            ) : (
              // Feature Card Layout
              <>
                <div className={`h-6 w-6 sm:h-8 sm:w-8 ${iconColor} mb-2 sm:mb-4`}>
                  {icon}
                </div>
                <h3 className="font-semibold text-white text-sm sm:text-base mb-2 sm:mb-3">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-300">
                  {description}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}