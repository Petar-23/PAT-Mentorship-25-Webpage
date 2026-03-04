import { NextResponse } from 'next/server';

const FR24_URL =
  'https://data-cloud.flightradar24.com/zones/fcgi/feed.js?faa=1&satellite=1&mlat=1&adsb=1&air=1&gnd=0&vehicles=0&maxage=14400&gliders=0&stats=0';

export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch(FR24_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorldWatch/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://www.flightradar24.com/',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `FR24 upstream ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 502 });
  }
}
