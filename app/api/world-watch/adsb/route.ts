import { NextResponse } from 'next/server';

export const revalidate = 30;

// Coverage circles: [lat, lon, radius_nm]
const COVERAGE: [number, number, number][] = [
  [26.0, 52.0, 250],  // Persian Gulf
  [34.0, 32.0, 250],  // Eastern Mediterranean
  [48.5, 37.5, 250],  // Ukraine / Eastern Europe
];

interface AdsbAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  track?: number;
  gs?: number;
  t?: string;
  r?: string;
  squawk?: string;
}

interface AdsbResponse {
  ac?: AdsbAircraft[];
}

export async function GET() {
  try {
    const fetches = COVERAGE.map(([lat, lon, dist]) =>
      fetch(`https://opendata.adsb.lol/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WorldWatch/1.0)',
          'Accept': 'application/json',
        },
        next: { revalidate: 30 },
      })
        .then(r => r.ok ? r.json() as Promise<AdsbResponse> : Promise.resolve({ ac: [] }))
        .catch(() => ({ ac: [] } as AdsbResponse))
    );

    const results = await Promise.all(fetches);

    // Merge and deduplicate by hex
    const seen = new Set<string>();
    const merged: AdsbAircraft[] = [];

    for (const result of results) {
      for (const ac of result.ac || []) {
        if (!ac.hex) continue;
        const key = ac.hex.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(ac);
      }
    }

    return NextResponse.json({ ac: merged }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
