// src/components/countdown-progress.tsx
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'

interface CountdownProgressProps {
  startDate: string
}

export function CountdownProgress({ startDate }: CountdownProgressProps) {
  const [progress, setProgress] = useState(0)
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateProgress = () => {
      const now = new Date().getTime()
      const start = new Date('2024-11-04').getTime() // Current date
      const end = new Date(startDate).getTime()
      const total = end - start
      const elapsed = now - start
      const percentage = (elapsed / total) * 100
      setProgress(Math.min(Math.max(percentage, 0), 100))

      // Calculate time left
      const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
      setTimeLeft(`${days} days until program starts`)
    }

    calculateProgress()
    const interval = setInterval(calculateProgress, 1000 * 60 * 60) // Update every hour
    return () => clearInterval(interval)
  }, [startDate])

  return (
    <div className="space-y-2">
      <Progress value={progress} className="h-2" />
      <p className="text-sm text-gray-600 text-center">{timeLeft}</p>
    </div>
  )
}