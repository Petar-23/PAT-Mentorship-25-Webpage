/**
 * Deterministic cinematic mesh-gradient covers for Mentorship chapters
 * (and module-card fallbacks). Seeded from a stable id so the same
 * chapter always gets the same look. No runtime image APIs.
 */

export const MESH_COVER_SLUGS = [
  'teal-01',
  'teal-02',
  'teal-03',
  'teal-04',
  'teal-05',
  'teal-06',
  'dusk-01',
  'dusk-02',
  'dusk-03',
  'dusk-04',
  'dusk-05',
  'dusk-06',
  'ice-01',
  'ice-02',
  'ice-03',
  'ice-04',
  'ice-05',
  'ice-06',
  'forest-01',
  'forest-02',
  'forest-03',
  'forest-04',
  'forest-05',
  'forest-06',
  'violet-01',
  'violet-02',
  'violet-03',
  'violet-04',
  'violet-05',
  'violet-06',
  'champagne-01',
  'champagne-02',
  'champagne-03',
  'champagne-04',
  'champagne-05',
  'champagne-06',
  'crimson-01',
  'crimson-02',
  'crimson-03',
  'crimson-04',
  'crimson-05',
  'crimson-06',
  'cobalt-01',
  'cobalt-02',
  'cobalt-03',
  'cobalt-04',
  'cobalt-05',
  'cobalt-06',
] as const

export type MeshCoverSlug = (typeof MESH_COVER_SLUGS)[number]

const COVER_DIR = '/covers/chapters'

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function getMeshCoverIndex(seed: string): number {
  return hashSeed(`mentorship-cover:${seed}`) % MESH_COVER_SLUGS.length
}

export function getMeshCoverSlug(seed: string): MeshCoverSlug {
  return MESH_COVER_SLUGS[getMeshCoverIndex(seed)]!
}

export function getMeshCoverSrc(seed: string): string {
  return `${COVER_DIR}/${getMeshCoverSlug(seed)}.webp`
}

export function withChapterCover<T extends { id: string }>(chapter: T): T & { coverSrc: string } {
  return { ...chapter, coverSrc: getMeshCoverSrc(chapter.id) }
}
