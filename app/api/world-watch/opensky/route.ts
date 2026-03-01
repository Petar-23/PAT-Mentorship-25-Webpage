import { NextResponse } from 'next/server';

export const revalidate = 60; // 1 min cache

// Known military ICAO24 hex prefixes
const MIL_HEX_PREFIXES = [
  'ae', 'af',  // US Military
  '43',        // UK Military
  '3f',        // Germany (Bundeswehr)
  '3a', '3b',  // France Military
  '33',        // Italy Military
  '34',        // Spain Military
  '50',        // Israel Military
  'c0',        // Canada Military
];

// Known military/gov callsign prefixes
const MIL_CALLSIGN_PREFIXES = [
  'RCH', 'REACH', 'DUKE', 'EVAC', 'IRON', 'GIANT', 'TOPCAT',
  'COBRA', 'VIPER', 'HAWK', 'EAGLE', 'REAPER', 'FORGE',
  'SAM', 'SPAR', 'EXEC', 'KNIFE', 'BOLT', 'BRASS', 'JAKE',
  'DARK', 'GHOST', 'MANTA', 'SHARK', 'OPR', 'SIGINT',
  'NAF', 'GAF', 'RRR', 'CNV', 'MMF', 'IAM', 'FAF', 'BAF', 'PAF', 'TAF',
  'ROCKY', 'BALL', 'FAMUS', 'OUTLW',
];

export async function GET() {
  try {
    const res = await fetch('https://opensky-network.org/api/states/all', {
      next: { revalidate: 60 },
      headers: { 'User-Agent': 'OPTICON/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const states = data.states || [];

    const aircraft: any[] = [];
    for (const s of states) {
      const icao = (s[0] || '').toLowerCase();
      const callsign = (s[1] || '').trim();
      const lat = s[6];
      const lng = s[5];

      if (!lat || !lng) continue;

      const isMilHex = MIL_HEX_PREFIXES.some(p => icao.startsWith(p));
      const isMilCs = MIL_CALLSIGN_PREFIXES.some(p => callsign.toUpperCase().startsWith(p));

      if (!isMilHex && !isMilCs) continue;

      aircraft.push({
        icao24: icao,
        callsign: callsign || icao.toUpperCase(),
        country: s[2] || 'Unknown',
        lat,
        lng,
        altitude: Math.round(s[7] || 0),
        velocity: Math.round((s[9] || 0) * 1.944), // m/s → knots
        heading: Math.round(s[10] || 0),
        onGround: s[8] || false,
      });
    }

    // Limit to 100 most interesting (airborne first, sorted by altitude desc)
    const sorted = aircraft
      .sort((a, b) => {
        if (a.onGround !== b.onGround) return a.onGround ? 1 : -1;
        return b.altitude - a.altitude;
      })
      .slice(0, 100);

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('OpenSky error:', error);
    return NextResponse.json([]);
  }
}
