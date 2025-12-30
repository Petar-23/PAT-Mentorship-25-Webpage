'use client'

import dynamic from 'next/dynamic'
import { ModuleGridUser } from './module-grid-user'

const ModuleGridAdmin = dynamic(
  () => import('./module-grid-admin').then((m) => m.ModuleGridAdmin),
  { ssr: false }
)

type Props = {
  modules: Array<{
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    chaptersCount: number
    totalDurationSeconds: number | null
  }>
  playlistId: string
  playlistName?: string
  isAdmin: boolean
  initialProgressByModuleId?: Record<
    string,
    { percent: number; completedLessons: number; totalLessons: number }
  >
}

export function ModuleGridClient({
  modules,
  playlistId,
  playlistName,
  isAdmin,
  initialProgressByModuleId,
}: Props) {
  if (isAdmin) {
    return <ModuleGridAdmin modules={modules} playlistId={playlistId} playlistName={playlistName} />
  }

  return (
    <ModuleGridUser
      modules={modules}
      playlistId={playlistId}
      playlistName={playlistName}
      initialProgressByModuleId={initialProgressByModuleId}
    />
  )
}