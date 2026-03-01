import { NextResponse } from 'next/server';

export const revalidate = 300; // cache 5 min

export async function GET() {
  try {
    const res = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
      { next: { revalidate: 300 } }
    );
    const data = await res.json();

    const events = data.features.map((f: any) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const mag = p.mag;

      return {
        id: `usgs-${f.id}`,
        title: p.title,
        description: `Magnitude ${mag} earthquake. ${p.place}. Depth: ${f.geometry.coordinates[2]}km.`,
        lat,
        lng,
        severity: mag >= 7 ? 4 : mag >= 6 ? 3 : mag >= 5 ? 2 : 1,
        category: 'natural-disaster' as const,
        source: 'USGS',
        timestamp: new Date(p.time).toISOString(),
        country: p.place?.split(', ').pop() || 'Unknown',
        sourceUrl: p.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
