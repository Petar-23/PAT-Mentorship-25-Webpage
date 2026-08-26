import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getMeshCoverSrc } from '@/lib/chapter-covers'

type MeshCoverProps = {
  seed: string
  name: string
  imageUrl?: string | null
  className?: string
  sizes?: string
}

export function MeshCover({
  seed,
  name,
  imageUrl,
  className,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: MeshCoverProps) {
  const src = imageUrl || getMeshCoverSrc(seed)
  const isCustom = Boolean(imageUrl)

  return (
    <div className={cn('relative aspect-video overflow-hidden bg-neutral-950', className)}>
      <Image
        src={src}
        alt={isCustom ? `${name} Cover` : ''}
        fill
        className="object-cover"
        sizes={sizes}
        priority={false}
        aria-hidden={isCustom ? undefined : true}
      />
    </div>
  )
}

type ChapterCoverThumbProps = {
  chapterId: string
  name: string
  className?: string
}

export function ChapterCoverThumb({ chapterId, name, className }: ChapterCoverThumbProps) {
  return (
    <MeshCover
      seed={chapterId}
      name={name}
      className={cn('h-10 w-[4.4rem] flex-shrink-0 rounded-md', className)}
      sizes="72px"
    />
  )
}
