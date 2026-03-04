import { NextResponse } from 'next/server';

export const revalidate = 600; // 10 min cache

const CATEGORY_MAP: Record<string, string> = {
  'Wildfires': 'natural-disaster',
  'Severe Storms': 'natural-disaster',
  'Volcanoes': 'natural-disaster',
  'Floods': 'natural-disaster',
  'Earthquakes': 'natural-disaster',
  'Landslides': 'natural-disaster',
  'Sea and Lake Ice': 'natural-disaster',
  'Drought': 'natural-disaster',
};

export async function GET() {
  try {
    const res = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50',
      { next: { revalidate: 600 } }
    );
    const data = await res.json();

    const events = (data.events || [])
      .filter((e: any) => e.geometry?.length > 0)
      .map((e: any) => {
        const geo = e.geometry[e.geometry.length - 1];
        const [lng, lat] = geo.coordinates;
        const catTitle = e.categories?.[0]?.title || 'Unknown';

        let severity: 1 | 2 | 3 | 4 = 1;
        if (catTitle === 'Severe Storms') severity = 3;
        else if (catTitle === 'Volcanoes') severity = 3;
        else if (catTitle === 'Wildfires') severity = 2;
        else if (catTitle === 'Floods') severity = 2;

        const titleLower = e.title.toLowerCase();
        if (titleLower.includes('hurricane') || titleLower.includes('typhoon')) severity = 4;
        if (titleLower.includes('tropical cyclone')) severity = 3;

        return {
          id: `eonet-${e.id}`,
          title: e.title,
          description: `${catTitle}: ${e.title}. Source: NASA EONET.`,
          lat,
          lng,
          severity,
          category: CATEGORY_MAP[catTitle] || 'natural-disaster',
          source: 'NASA',
          timestamp: geo.date || new Date().toISOString(),
          country: e.title.split(', ').pop()?.trim() || 'Unknown',
          sourceUrl: e.sources?.[0]?.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`,
        };
      });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
