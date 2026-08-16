import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  coverMeshBackgroundImage,
  getCoverGradient,
} from '@/lib/module-cover-gradients'

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`
)

const GRAIN_URL = `url("data:image/svg+xml,${GRAIN_SVG}")`

type GradientProps = {
  seed: string
  className?: string
}

export function ModuleCoverGradient({ seed, className }: GradientProps) {
  const palette = getCoverGradient(seed)

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: palette.base,
          backgroundImage: coverMeshBackgroundImage(palette),
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          opacity: palette.grain,
          backgroundImage: GRAIN_URL,
          backgroundSize: '180px 180px',
        }}
      />
    </div>
  )
}

type CoverProps = {
  id: string
  name: string
  imageUrl?: string | null
  className?: string
}

export function ModuleCardCover({ id, name, imageUrl, className }: CoverProps) {
  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden bg-muted',
        className
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${name} Thumbnail`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={false}
        />
      ) : (
        <ModuleCoverGradient seed={id} />
      )}
    </div>
  )
}
