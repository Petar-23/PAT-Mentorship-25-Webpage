import { NextResponse } from 'next/server';

export const revalidate = 60; // 1 min cache

// Known military ICAO24 hex prefixes (first 2 chars)
const MIL_HEX_PREFIXES = [
  'ae', 'af', // US Military (Army, Air Force, Navy, Marines, Coast Guard)
  '43',       // UK Military
  '3f',       // Germany (Bundeswehr)
  '3a', '3b', // France Military
  '33',       // Italy Military
  '34',       // Spain Military
  '50',       // Israel Military
  '70', '71', // Pakistan/Iran region military
  '78',       // China Military
  'e8',       // Brazil Military
  'c0',       // Canada Military
];

// Known military/gov callsign prefixes
const MIL_CALLSIGN_PREFIXES = [
  'RCH', 'REACH', 'DUKE', 'EVAC', 'IRON', 'GIANT', 'TOPCAT', 'COBRA', 'VIPER',
  'HAWK', 'EAGLE', 'REAPER', 'FORGE', 'SAM', 'SPAR', 'EXEC', 'KNIFE', 'BOLT',
  'BRASS', 'JAKE', 'DARK', 'GHOST', 'MANTA', 'SHARK', 'OPR', 'SIGINT', 'NAF',
  'GAF', 'RRR', 'CNV', 'MMF', 'IAM', 'FAF', 'BAF', 'PAF', 'TAF', 'ROCKY',
  'BALL', 'FAMUS', 'OUTLW',
];

interface OpenSkyState {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  heading: number;
  onGround: boolean;
}

interface AircraftWithTrack extends OpenSkyState {
  track: [number, number][]; // [lng, lat] pairs
}

export async function GET() {
  try {
    const res = await fetch('https://opensky-network.org/api/states/all', {
      next: { revalidate: 60 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) return NextResponse.json([], { status: 502 });

    const data = await res.json();
    const states = data.states || [];

    const milAircraft: OpenSkyState[] = [];
    for (const s of states) {
      const icao = (s[0] || '').toLowerCase();
      const callsign = (s[1] || '').trim().toUpperCase();
      const lat = s[6];
      const lng = s[5];
      if (!lat || !lng) continue;

      const isMilHex = MIL_HEX_PREFIXES.some(p => icao.startsWith(p));
      const isMilCallsign = MIL_CALLSIGN_PREFIXES.some(p => callsign.startsWith(p));

      if (isMilHex || isMilCallsign) {
        milAircraft.push({
          icao24: icao,
          callsign: callsign || icao.toUpperCase(),
          country: s[2] || 'Unknown',
          lat,
          lng,
          altitude: Math.round(s[7] || 0),
          velocity: Math.round((s[9] || 0) * 1.944), // m/s to knots
          heading: Math.round(s[10] || 0),
          onGround: s[8] || false,
        });
      }
    }

    // Fetch tracks for up to 10 most interesting airborne aircraft
    const airborne = milAircraft
      .filter(a => !a.onGround && a.altitude > 100)
      .slice(0, 10);

    const aircraftWithTracks: AircraftWithTrack[] = await Promise.all(
      airborne.map(async (ac) => {
        try {
          const trackRes = await fetch(
            `https://opensky-network.org/api/tracks/all?icao24=${ac.icao24}&time=0`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
          );
          if (!trackRes.ok) return { ...ac, track: [] as [number, number][] };
          const trackData = await trackRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const path = (trackData.path || []).map((p: any) => [p[2], p[1]] as [number, number]);
          return { ...ac, track: path };
        } catch {
          return { ...ac, track: [] as [number, number][] };
        }
      })
    );

    const groundAircraft = milAircraft
      .filter(a => a.onGround || a.altitude <= 100)
      .slice(0, 10)
      .map(a => ({ ...a, track: [] as [number, number][] }));

    const all = [...aircraftWithTracks, ...groundAircraft];
    return NextResponse.json(all);
  } catch (error) {
    console.error('OpenSky API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
