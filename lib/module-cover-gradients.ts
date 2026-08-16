/**
 * In-repo mesh/grain cover palette for Mentorship module cards.
 * Inspired by Gradientora's mesh / textured / silk / aero collections,
 * but original CSS — no downloaded or hotlinked Gradientora assets.
 *
 * Assignment is hashed from a stable seed (module id) so the same
 * module always gets the same look across reloads and users.
 */

export type MeshBlob = {
  x: string
  y: string
  w: string
  h: string
  color: string
  stop: number
  shape?: 'ellipse' | 'circle'
}

export type CoverGradient = {
  id: string
  base: string
  blobs: MeshBlob[]
  wash?: string
  vignette: string
  grain: number
}

export const MODULE_COVER_GRADIENTS: CoverGradient[] = [
  {
    id: 'dusk-ember',
    base: '#2a1810',
    blobs: [
      { x: '18%', y: '28%', w: '78%', h: '72%', color: '#c45c2a', stop: 58 },
      { x: '82%', y: '18%', w: '64%', h: '58%', color: '#e8a04a', stop: 52 },
      { x: '70%', y: '86%', w: '70%', h: '50%', color: '#6b2a1c', stop: 55 },
      { x: '8%', y: '88%', w: '48%', h: '42%', color: '#1a0e0a', stop: 50 },
    ],
    wash: 'linear-gradient(155deg, rgba(255,186,120,0.18) 0%, transparent 42%, rgba(40,16,10,0.35) 100%)',
    vignette: 'rgba(12,6,4,0.38)',
    grain: 0.2,
  },
  {
    id: 'aero-navy',
    base: '#0b1220',
    blobs: [
      { x: '22%', y: '20%', w: '70%', h: '64%', color: '#1d4e7a', stop: 56 },
      { x: '88%', y: '36%', w: '58%', h: '70%', color: '#3d7ea6', stop: 50 },
      { x: '48%', y: '88%', w: '80%', h: '48%', color: '#0e2a3a', stop: 54 },
      { x: '10%', y: '70%', w: '42%', h: '40%', color: '#6aa8b8', stop: 42 },
    ],
    wash: 'linear-gradient(168deg, rgba(140,190,210,0.14) 0%, transparent 48%, rgba(6,10,18,0.4) 100%)',
    vignette: 'rgba(4,8,14,0.42)',
    grain: 0.16,
  },
  {
    id: 'silk-sand',
    base: '#efe4d4',
    blobs: [
      { x: '16%', y: '30%', w: '72%', h: '68%', color: '#e0c4a4', stop: 58 },
      { x: '84%', y: '22%', w: '60%', h: '56%', color: '#d4b08c', stop: 50 },
      { x: '62%', y: '84%', w: '74%', h: '52%', color: '#c9a08a', stop: 54 },
      { x: '30%', y: '70%', w: '40%', h: '36%', color: '#f6efe6', stop: 46 },
    ],
    wash: 'linear-gradient(150deg, rgba(255,250,244,0.55) 0%, transparent 50%, rgba(180,140,110,0.18) 100%)',
    vignette: 'rgba(120,90,70,0.12)',
    grain: 0.1,
  },
  {
    id: 'saas-mist',
    base: '#e8eef2',
    blobs: [
      { x: '20%', y: '24%', w: '68%', h: '62%', color: '#c5d8e4', stop: 56 },
      { x: '86%', y: '30%', w: '58%', h: '64%', color: '#d5e8dc', stop: 50 },
      { x: '55%', y: '88%', w: '76%', h: '48%', color: '#dce0ea', stop: 52 },
      { x: '8%', y: '78%', w: '40%', h: '38%', color: '#f4f7f8', stop: 44 },
    ],
    wash: 'linear-gradient(162deg, rgba(255,255,255,0.55) 0%, transparent 46%, rgba(170,190,200,0.2) 100%)',
    vignette: 'rgba(90,110,120,0.1)',
    grain: 0.08,
  },
  {
    id: 'ocean-depth',
    base: '#062428',
    blobs: [
      { x: '24%', y: '32%', w: '74%', h: '70%', color: '#0d5c5a', stop: 58 },
      { x: '80%', y: '16%', w: '56%', h: '52%', color: '#2aa8a0', stop: 48 },
      { x: '68%', y: '86%', w: '72%', h: '50%', color: '#083838', stop: 54 },
      { x: '12%', y: '82%', w: '44%', h: '40%', color: '#041618', stop: 48 },
    ],
    wash: 'linear-gradient(158deg, rgba(90,210,200,0.16) 0%, transparent 44%, rgba(4,16,18,0.4) 100%)',
    vignette: 'rgba(2,10,12,0.4)',
    grain: 0.17,
  },
  {
    id: 'pine-gold',
    base: '#1a2214',
    blobs: [
      { x: '18%', y: '26%', w: '70%', h: '66%', color: '#3d5a2e', stop: 56 },
      { x: '84%', y: '24%', w: '54%', h: '50%', color: '#c4a05a', stop: 46 },
      { x: '60%', y: '86%', w: '76%', h: '48%', color: '#2a381c', stop: 54 },
      { x: '10%', y: '80%', w: '40%', h: '38%', color: '#0e140a', stop: 48 },
    ],
    wash: 'linear-gradient(154deg, rgba(210,180,100,0.16) 0%, transparent 46%, rgba(16,22,10,0.38) 100%)',
    vignette: 'rgba(8,12,6,0.36)',
    grain: 0.15,
  },
  {
    id: 'clay-bloom',
    base: '#3a221c',
    blobs: [
      { x: '22%', y: '28%', w: '72%', h: '68%', color: '#b86a4e', stop: 56 },
      { x: '86%', y: '20%', w: '58%', h: '54%', color: '#e8b4a0', stop: 48 },
      { x: '64%', y: '88%', w: '70%', h: '46%', color: '#7a3c32', stop: 52 },
      { x: '8%', y: '76%', w: '42%', h: '40%', color: '#2a1612', stop: 48 },
    ],
    wash: 'linear-gradient(152deg, rgba(255,210,190,0.2) 0%, transparent 44%, rgba(40,18,14,0.32) 100%)',
    vignette: 'rgba(20,10,8,0.32)',
    grain: 0.14,
  },
  {
    id: 'glacier',
    base: '#d7e4ea',
    blobs: [
      { x: '18%', y: '22%', w: '66%', h: '60%', color: '#b8d4de', stop: 54 },
      { x: '82%', y: '34%', w: '62%', h: '68%', color: '#8eb8c8', stop: 52 },
      { x: '48%', y: '88%', w: '78%', h: '46%', color: '#eef4f6', stop: 50 },
      { x: '12%', y: '78%', w: '38%', h: '36%', color: '#6a8a98', stop: 40 },
    ],
    wash: 'linear-gradient(166deg, rgba(255,255,255,0.5) 0%, transparent 48%, rgba(90,120,130,0.16) 100%)',
    vignette: 'rgba(70,90,100,0.12)',
    grain: 0.09,
  },
  {
    id: 'ink-wash',
    base: '#16181c',
    blobs: [
      { x: '26%', y: '24%', w: '68%', h: '62%', color: '#3a4048', stop: 54 },
      { x: '84%', y: '30%', w: '56%', h: '60%', color: '#6a727c', stop: 48 },
      { x: '52%', y: '88%', w: '80%', h: '50%', color: '#0e1014', stop: 56 },
      { x: '10%', y: '72%', w: '40%', h: '38%', color: '#9aa4ae', stop: 38 },
    ],
    wash: 'linear-gradient(160deg, rgba(200,210,220,0.12) 0%, transparent 46%, rgba(6,8,10,0.45) 100%)',
    vignette: 'rgba(4,6,8,0.4)',
    grain: 0.18,
  },
  {
    id: 'wine-dusk',
    base: '#2a1218',
    blobs: [
      { x: '20%', y: '30%', w: '74%', h: '68%', color: '#7a2c40', stop: 56 },
      { x: '84%', y: '18%', w: '56%', h: '52%', color: '#c47880', stop: 48 },
      { x: '66%', y: '86%', w: '70%', h: '48%', color: '#3a1820', stop: 54 },
      { x: '8%', y: '80%', w: '42%', h: '38%', color: '#14080c', stop: 48 },
    ],
    wash: 'linear-gradient(156deg, rgba(220,150,150,0.16) 0%, transparent 44%, rgba(20,8,10,0.4) 100%)',
    vignette: 'rgba(10,4,6,0.38)',
    grain: 0.16,
  },
  {
    id: 'brass-haze',
    base: '#2c2414',
    blobs: [
      { x: '20%', y: '26%', w: '70%', h: '64%', color: '#8a7038', stop: 56 },
      { x: '86%', y: '22%', w: '54%', h: '50%', color: '#d4b86a', stop: 46 },
      { x: '58%', y: '88%', w: '76%', h: '48%', color: '#4a3c1c', stop: 54 },
      { x: '10%', y: '78%', w: '40%', h: '36%', color: '#1a160c', stop: 48 },
    ],
    wash: 'linear-gradient(150deg, rgba(240,210,140,0.18) 0%, transparent 46%, rgba(24,18,8,0.36) 100%)',
    vignette: 'rgba(12,10,4,0.34)',
    grain: 0.14,
  },
  {
    id: 'storm-silk',
    base: '#c8cdd4',
    blobs: [
      { x: '16%', y: '28%', w: '68%', h: '64%', color: '#a8b0ba', stop: 56 },
      { x: '84%', y: '24%', w: '60%', h: '58%', color: '#8a94a0', stop: 50 },
      { x: '50%', y: '86%', w: '78%', h: '48%', color: '#e4e7ec', stop: 52 },
      { x: '28%', y: '70%', w: '36%', h: '34%', color: '#f2f4f6', stop: 42 },
    ],
    wash: 'linear-gradient(164deg, rgba(255,255,255,0.45) 0%, transparent 48%, rgba(90,100,110,0.18) 100%)',
    vignette: 'rgba(60,70,80,0.14)',
    grain: 0.11,
  },
  {
    id: 'citrus-olive',
    base: '#2a2814',
    blobs: [
      { x: '22%', y: '24%', w: '70%', h: '62%', color: '#8a7a2e', stop: 54 },
      { x: '84%', y: '28%', w: '56%', h: '58%', color: '#c4a43a', stop: 48 },
      { x: '58%', y: '88%', w: '74%', h: '46%', color: '#4a4a22', stop: 52 },
      { x: '10%', y: '76%', w: '40%', h: '38%', color: '#16140a', stop: 48 },
    ],
    wash: 'linear-gradient(158deg, rgba(230,200,90,0.16) 0%, transparent 44%, rgba(20,18,8,0.36) 100%)',
    vignette: 'rgba(10,10,4,0.34)',
    grain: 0.15,
  },
  {
    id: 'fog-harbor',
    base: '#d8dde2',
    blobs: [
      { x: '20%', y: '26%', w: '70%', h: '64%', color: '#b4c0cc', stop: 56 },
      { x: '82%', y: '20%', w: '58%', h: '54%', color: '#9ab0c8', stop: 48 },
      { x: '60%', y: '86%', w: '74%', h: '48%', color: '#c8d0d6', stop: 52 },
      { x: '12%', y: '80%', w: '38%', h: '36%', color: '#eef1f4', stop: 44 },
    ],
    wash: 'linear-gradient(160deg, rgba(255,255,255,0.5) 0%, transparent 46%, rgba(120,140,150,0.16) 100%)',
    vignette: 'rgba(80,95,105,0.12)',
    grain: 0.09,
  },
  {
    id: 'copper-velvet',
    base: '#2a1a12',
    blobs: [
      { x: '18%', y: '30%', w: '74%', h: '70%', color: '#a85a32', stop: 58 },
      { x: '86%', y: '18%', w: '54%', h: '50%', color: '#e09058', stop: 46 },
      { x: '62%', y: '88%', w: '72%', h: '48%', color: '#5a2c1a', stop: 54 },
      { x: '8%', y: '78%', w: '42%', h: '40%', color: '#140c08', stop: 48 },
    ],
    wash: 'linear-gradient(154deg, rgba(255,180,120,0.18) 0%, transparent 44%, rgba(24,12,8,0.38) 100%)',
    vignette: 'rgba(12,6,4,0.36)',
    grain: 0.18,
  },
  {
    id: 'kelp-steam',
    base: '#14241c',
    blobs: [
      { x: '24%', y: '28%', w: '72%', h: '66%', color: '#2e6a4e', stop: 56 },
      { x: '84%', y: '22%', w: '56%', h: '52%', color: '#7ab89a', stop: 46 },
      { x: '56%', y: '88%', w: '76%', h: '48%', color: '#1c3830', stop: 54 },
      { x: '10%', y: '74%', w: '40%', h: '36%', color: '#d4c4a0', stop: 36 },
    ],
    wash: 'linear-gradient(156deg, rgba(170,210,180,0.14) 0%, transparent 46%, rgba(10,18,14,0.36) 100%)',
    vignette: 'rgba(6,12,10,0.34)',
    grain: 0.13,
  },
  {
    id: 'parchment',
    base: '#efe6d2',
    blobs: [
      { x: '18%', y: '26%', w: '70%', h: '64%', color: '#e0cda8', stop: 56 },
      { x: '84%', y: '28%', w: '58%', h: '56%', color: '#c8a878', stop: 50 },
      { x: '58%', y: '86%', w: '74%', h: '48%', color: '#d8c49a', stop: 52 },
      { x: '28%', y: '72%', w: '38%', h: '34%', color: '#f7f1e4', stop: 44 },
    ],
    wash: 'linear-gradient(152deg, rgba(255,250,240,0.55) 0%, transparent 48%, rgba(170,140,90,0.16) 100%)',
    vignette: 'rgba(130,110,70,0.1)',
    grain: 0.1,
  },
  {
    id: 'midnight-horizon',
    base: '#0c1018',
    blobs: [
      { x: '16%', y: '70%', w: '70%', h: '50%', color: '#c46a3a', stop: 48 },
      { x: '78%', y: '22%', w: '58%', h: '56%', color: '#1a3050', stop: 52 },
      { x: '50%', y: '42%', w: '80%', h: '40%', color: '#243044', stop: 50 },
      { x: '88%', y: '80%', w: '40%', h: '36%', color: '#081018', stop: 46 },
    ],
    wash: 'linear-gradient(180deg, rgba(20,36,56,0.2) 0%, transparent 40%, rgba(180,90,40,0.18) 100%)',
    vignette: 'rgba(4,6,10,0.4)',
    grain: 0.16,
  },
  {
    id: 'mauve-smoke',
    base: '#2a2428',
    blobs: [
      { x: '22%', y: '28%', w: '70%', h: '64%', color: '#6a5864', stop: 56 },
      { x: '84%', y: '24%', w: '56%', h: '54%', color: '#b49aa4', stop: 48 },
      { x: '58%', y: '88%', w: '74%', h: '46%', color: '#3a3236', stop: 52 },
      { x: '10%', y: '76%', w: '40%', h: '36%', color: '#161214', stop: 48 },
    ],
    wash: 'linear-gradient(158deg, rgba(210,190,200,0.14) 0%, transparent 46%, rgba(16,12,14,0.36) 100%)',
    vignette: 'rgba(10,8,10,0.34)',
    grain: 0.13,
  },
  {
    id: 'jade-mist',
    base: '#dce8e2',
    blobs: [
      { x: '20%', y: '24%', w: '68%', h: '62%', color: '#a8c8b8', stop: 54 },
      { x: '84%', y: '32%', w: '58%', h: '60%', color: '#7aa890', stop: 50 },
      { x: '52%', y: '88%', w: '76%', h: '46%', color: '#e8f0ea', stop: 50 },
      { x: '12%', y: '78%', w: '38%', h: '36%', color: '#c8b890', stop: 38 },
    ],
    wash: 'linear-gradient(162deg, rgba(255,255,255,0.5) 0%, transparent 46%, rgba(100,130,110,0.14) 100%)',
    vignette: 'rgba(70,90,80,0.1)',
    grain: 0.09,
  },
  {
    id: 'graphite-dawn',
    base: '#1c1e22',
    blobs: [
      { x: '18%', y: '22%', w: '64%', h: '58%', color: '#4a5058', stop: 52 },
      { x: '80%', y: '70%', w: '62%', h: '56%', color: '#c4a078', stop: 44 },
      { x: '48%', y: '48%', w: '70%', h: '50%', color: '#2a2e34', stop: 54 },
      { x: '8%', y: '80%', w: '40%', h: '36%', color: '#0e1014', stop: 48 },
    ],
    wash: 'linear-gradient(170deg, rgba(180,190,200,0.1) 0%, transparent 42%, rgba(180,140,90,0.16) 100%)',
    vignette: 'rgba(6,8,10,0.38)',
    grain: 0.17,
  },
  {
    id: 'desert-dusk',
    base: '#3a2a1c',
    blobs: [
      { x: '20%', y: '26%', w: '72%', h: '66%', color: '#c4844a', stop: 56 },
      { x: '86%', y: '20%', w: '54%', h: '50%', color: '#e8c48a', stop: 46 },
      { x: '64%', y: '86%', w: '70%', h: '48%', color: '#6a3c22', stop: 54 },
      { x: '8%', y: '78%', w: '42%', h: '38%', color: '#1e140c', stop: 48 },
    ],
    wash: 'linear-gradient(152deg, rgba(255,210,150,0.18) 0%, transparent 44%, rgba(40,24,12,0.34) 100%)',
    vignette: 'rgba(16,10,6,0.32)',
    grain: 0.15,
  },
  {
    id: 'fjord',
    base: '#122028',
    blobs: [
      { x: '22%', y: '26%', w: '70%', h: '64%', color: '#2a5464', stop: 56 },
      { x: '84%', y: '28%', w: '56%', h: '58%', color: '#6a9aaa', stop: 48 },
      { x: '50%', y: '88%', w: '80%', h: '46%', color: '#0e1a20', stop: 54 },
      { x: '10%', y: '72%', w: '40%', h: '36%', color: '#c8d4c0', stop: 34 },
    ],
    wash: 'linear-gradient(164deg, rgba(150,190,200,0.14) 0%, transparent 46%, rgba(8,14,18,0.4) 100%)',
    vignette: 'rgba(6,10,14,0.38)',
    grain: 0.14,
  },
  {
    id: 'espresso-cream',
    base: '#241810',
    blobs: [
      { x: '20%', y: '28%', w: '72%', h: '66%', color: '#5a3c28', stop: 56 },
      { x: '84%', y: '22%', w: '56%', h: '52%', color: '#d4b090', stop: 46 },
      { x: '58%', y: '88%', w: '74%', h: '48%', color: '#3a2818', stop: 54 },
      { x: '10%', y: '76%', w: '40%', h: '36%', color: '#120c08', stop: 48 },
    ],
    wash: 'linear-gradient(154deg, rgba(230,200,170,0.16) 0%, transparent 44%, rgba(20,12,8,0.38) 100%)',
    vignette: 'rgba(10,6,4,0.36)',
    grain: 0.16,
  },
]

/** FNV-1a 32-bit — stable across JS runtimes, no Math.random. */
export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getCoverGradient(seed: string): CoverGradient {
  const index = hashSeed(seed) % MODULE_COVER_GRADIENTS.length
  return MODULE_COVER_GRADIENTS[index]
}

export function coverMeshBackgroundImage(palette: CoverGradient): string {
  const blobs = palette.blobs.map((blob) => {
    const shape = blob.shape ?? 'ellipse'
    return `radial-gradient(${shape} ${blob.w} ${blob.h} at ${blob.x} ${blob.y}, ${blob.color} 0%, transparent ${blob.stop}%)`
  })
  if (palette.wash) blobs.push(palette.wash)
  blobs.push(
    `radial-gradient(ellipse 88% 82% at 50% 42%, transparent 42%, ${palette.vignette} 100%)`
  )
  return blobs.join(', ')
}
