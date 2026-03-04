import { NextResponse } from 'next/server';
import type { LayerPolygon } from '@/app/(dashboard)/world-watch/types';

export const revalidate = 300; // 5 min

// Static airspace closures based on current geopolitical situation
// Updated manually; in future can pull from ICAO API or FAA NOTAM service
const STATIC_CLOSURES: LayerPolygon[] = [
  {
    id: 'fir-iran',
    name: 'Iran FIR',
    country: 'Iran',
    status: 'RESTRICTED',
    color: '#fab387',
    coordinates: [
      [44.0, 39.5], [48.0, 39.8], [50.0, 37.5], [54.0, 37.0],
      [57.0, 37.5], [60.5, 36.5], [63.3, 35.0], [63.2, 31.0],
      [61.5, 29.0], [60.5, 25.0], [58.0, 22.5], [56.5, 24.0],
      [55.0, 25.5], [52.5, 26.5], [51.5, 24.5], [49.0, 27.0],
      [47.0, 29.5], [44.5, 31.0], [44.0, 33.0], [44.0, 37.0],
      [44.0, 39.5],
    ],
  },
  {
    id: 'fir-iraq',
    name: 'Iraq FIR',
    country: 'Iraq',
    status: 'RESTRICTED',
    color: '#fab387',
    coordinates: [
      [38.8, 37.1], [42.0, 37.3], [44.0, 37.0], [44.0, 33.0],
      [44.5, 31.0], [47.0, 29.5], [48.5, 29.5], [48.5, 31.0],
      [46.5, 32.0], [45.0, 33.5], [43.5, 35.5], [41.0, 36.5],
      [38.8, 37.1],
    ],
  },
  {
    id: 'fir-ukraine-east',
    name: 'Eastern Ukraine Danger Zone',
    country: 'Ukraine',
    status: 'DANGER',
    color: '#f9e2af',
    coordinates: [
      [32.0, 52.5], [36.0, 52.5], [40.5, 51.0], [40.5, 47.0],
      [37.5, 46.5], [34.0, 45.5], [32.0, 46.5], [31.0, 48.5],
      [32.0, 52.5],
    ],
  },
  {
    id: 'fir-israel',
    name: 'Israel/Gaza Restricted',
    country: 'Israel',
    status: 'RESTRICTED',
    color: '#fab387',
    coordinates: [
      [34.3, 33.3], [35.9, 33.3], [35.9, 31.5], [35.0, 29.5],
      [34.3, 29.5], [34.1, 31.5], [34.3, 33.3],
    ],
  },
  {
    id: 'fir-lebanon',
    name: 'Lebanon/Syria Restricted',
    country: 'Lebanon',
    status: 'DANGER',
    color: '#f9e2af',
    coordinates: [
      [35.0, 34.7], [37.5, 34.7], [42.0, 36.5], [42.0, 33.0],
      [38.5, 32.5], [36.5, 33.0], [35.0, 33.5], [35.0, 34.7],
    ],
  },
  {
    id: 'fir-sudan',
    name: 'Sudan Conflict Zone',
    country: 'Sudan',
    status: 'DANGER',
    color: '#f9e2af',
    coordinates: [
      [23.5, 22.0], [37.0, 22.0], [37.0, 15.0], [36.5, 12.0],
      [33.0, 11.0], [28.0, 12.5], [24.0, 19.5], [23.5, 22.0],
    ],
  },
  {
    id: 'fir-myanmar',
    name: 'Myanmar Conflict Zone',
    country: 'Myanmar',
    status: 'DANGER',
    color: '#f9e2af',
    coordinates: [
      [92.0, 28.5], [98.5, 28.5], [101.5, 22.0], [100.0, 16.0],
      [98.5, 16.5], [97.5, 18.0], [94.0, 21.5], [92.5, 24.0],
      [92.0, 28.5],
    ],
  },
];

export async function GET() {
  // Future: attempt live ICAO NOTAM API fetch and merge with static data
  // For now, return curated static closures
  return NextResponse.json(STATIC_CLOSURES);
}
