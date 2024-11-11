'use client'

import { useState } from 'react'
import { GradientCard } from '@/components/ui/gradient-card'
import { CardMatrixRain } from '@/components/ui/card-matrix-rain'

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
  gradientColor,
  className,
  children
}: CardWithMatrixProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Add type guard to ensure title is provided when there's no value
  if (!value && !title) {
    throw new Error('CardWithMatrix requires either a value or a title')
  }

  return (
    <GradientCard
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      gradientColor={gradientColor}
    >
      {/* Matrix Rain Background */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 0.2 : 0.1,
        }}
      >
        <CardMatrixRain 
          color={rainColor}
          backgroundColor="rgba(0, 0, 0, 0.05)"
        />
      </div>

      {/* Content */}
      {children ? (
        <div className="relative z-10">
          {children}
        </div>
      ) : (
        <div className="relative z-10 p-6">
          {value ? (
            // Stats Card Layout
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 ${iconColor}`}>
                {icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-400">{subtitle}</p>
              </div>
            </div>
          ) : (
            // Feature Card Layout
            <>
              <div className={`h-8 w-8 ${iconColor} mb-4`}>
                {icon}
              </div>
              <h3 className="font-semibold text-white text-base mb-3">
                {title}
              </h3>
              <p className="text-sm text-gray-300">
                {description}
              </p>
            </>
          )}
        </div>
      )}
    </GradientCard>
  )
}