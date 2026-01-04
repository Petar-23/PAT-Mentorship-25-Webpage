// src/components/subscription-success-modal.tsx
'use client'

import { useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import confetti from 'canvas-confetti'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SubscriptionSuccessModal({ isOpen, onClose }: SuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Fire confetti from the left
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.1, y: 0.5 }
      })

      // Fire confetti from the right
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.9, y: 0.5 }
      })

      // Create a confetti interval
      const interval = setInterval(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 }
        })

        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 }
        })
      }, 650)

      // Cleanup
      setTimeout(() => {
        clearInterval(interval)
      }, 3000)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Willkommen bei der Mentorship 2026!
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Dein Platz ist gesichert. Die Mentorship startet am 01. März 2026
          </p>
          <Button onClick={onClose} className="w-full">
            Zum Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Add custom fire confetti function
export function fireConfetti() {
  const count = 200
  const defaults = {
    origin: { y: 0.7 }
  }

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    })
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  })

  fire(0.2, {
    spread: 60,
  })

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  })
}