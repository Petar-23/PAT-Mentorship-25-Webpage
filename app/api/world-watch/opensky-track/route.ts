import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24');

  if (!icao24) return NextResponse.json({ error: 'Missing icao24' }, { status: 400 });

  try {
    const res = await fetch(
      `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`,
      {
        headers: { 'User-Agent': 'OPTICON/1.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return NextResponse.json({ track: [] });

    const data = await res.json();
    const path = (data.path || []).map((p: any) => [p[2], p[1]]); // [lng, lat]

    return NextResponse.json({
      icao24: data.icao24,
      callsign: (data.callsign || '').trim(),
      track: path,
      startTime: data.startTime,
      endTime: data.endTime,
    });
  } catch {
    return NextResponse.json({ track: [] });
  }
}
