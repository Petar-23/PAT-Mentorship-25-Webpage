import { NextResponse } from 'next/server';

export const revalidate = 300; // cache 5 min

// Hotspot regions: geopolitical tension + nuclear test sites → lower threshold (4.0+)
const HOTSPOT_REGIONS = [
  { name: 'Iran/Middle East', minlat: 24, maxlat: 40, minlon: 44, maxlon: 63 },
  { name: 'Korean Peninsula', minlat: 33, maxlat: 43, minlon: 124, maxlon: 132 },
  { name: 'Pakistan/India', minlat: 23, maxlat: 37, minlon: 60, maxlon: 78 },
  { name: 'Turkey/Caucasus', minlat: 36, maxlat: 44, minlon: 26, maxlon: 50 },
  { name: 'Ukraine/Black Sea', minlat: 44, maxlat: 52, minlon: 22, maxlon: 40 },
  { name: 'Taiwan Strait', minlat: 21, maxlat: 28, minlon: 117, maxlon: 123 },
];

function mapEvent(f: any) {
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
}

export async function GET() {
  try {
    // 1. Global 4.5+ feed
    const globalRes = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
      { next: { revalidate: 300 } }
    );
    const globalData = await globalRes.json();
    const globalEvents = globalData.features.map(mapEvent);
    const seenIds = new Set(globalEvents.map((e: any) => e.id));

    // 2. Hotspot regions: 4.0+ via FDSNWS (last 7 days)
    const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const hotspotPromises = HOTSPOT_REGIONS.map(async (region) => {
      try {
        const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.0&maxmagnitude=4.499&starttime=${startTime}&minlatitude=${region.minlat}&maxlatitude=${region.maxlat}&minlongitude=${region.minlon}&maxlongitude=${region.maxlon}&limit=50`;
        const res = await fetch(url, { next: { revalidate: 300 } });
        const data = await res.json();
        return (data.features || [])
          .map(mapEvent)
          .filter((e: any) => !seenIds.has(e.id));
      } catch {
        return [];
      }
    });

    const hotspotResults = await Promise.all(hotspotPromises);
    const hotspotEvents = hotspotResults.flat();

    return NextResponse.json([...globalEvents, ...hotspotEvents]);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
