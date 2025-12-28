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
    chapters: { length: number }[]
    totalDurationSeconds: number | null
  }>
  playlistId: string
  playlistName?: string
  isAdmin: boolean
}

export function ModuleGridClient({ modules, playlistId, playlistName, isAdmin }: Props) {
  if (isAdmin) {
    return <ModuleGridAdmin modules={modules} playlistId={playlistId} playlistName={playlistName} />
  }

  return <ModuleGridUser modules={modules} playlistId={playlistId} playlistName={playlistName} />
}