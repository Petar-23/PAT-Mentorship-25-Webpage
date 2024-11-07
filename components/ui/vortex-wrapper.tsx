// src/components/ui/vortex-wrapper.tsx
'use client'

import { Vortex } from "@/components/ui/vortex"

export function VortexBackground() {
  return (
    <div className="absolute inset-0">
      <Vortex
        particleCount={800}
        baseHue={240}
        baseSpeed={1.0}
        rangeSpeed={1.5}
        baseRadius={1.0}
        rangeRadius={2.0}
        backgroundColor="transparent"
        containerClassName="opacity-30"
      />
    </div>
  )
}