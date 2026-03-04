import { NextResponse } from 'next/server';

export const revalidate = 900; // 15 min cache

const QUERIES = [
  { query: 'conflict OR war OR military OR attack', category: 'conflict' },
  { query: 'protest OR riot OR demonstration OR unrest', category: 'political' },
  { query: 'pandemic OR outbreak OR epidemic OR disease', category: 'health' },
];

export async function GET() {
  try {
    const allEvents: any[] = [];

    for (const { query, category } of QUERIES) {
      try {
        const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&format=GeoJSON&maxpoints=15&timespan=24h`;
        const res = await fetch(url, {
          next: { revalidate: 900 },
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const text = await res.text();
        const data = JSON.parse(text);

        if (data?.features) {
          for (const f of data.features) {
            const props = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            const name = props.name || 'Unknown';
            const count = props.count || 0;

            const titleMatch = props.html?.match(/title="([^"]+)"/);
            const articleTitle = titleMatch ? titleMatch[1] : `${category} activity in ${name}`;

            // Extract first article URL from HTML
            const urlMatch = props.html?.match(/href="([^"]+)"/);
            const sourceUrl = urlMatch ? urlMatch[1] : undefined;

            const severity: 1 | 2 | 3 | 4 = count >= 5000 ? 4 : count >= 2000 ? 3 : count >= 500 ? 2 : 1;

            allEvents.push({
              id: `gdelt-${category}-${name.toLowerCase().replace(/\s+/g, '-')}`,
              title: articleTitle.slice(0, 120),
              description: `${count.toLocaleString()} articles in last 24h covering ${category} in ${name}.`,
              lat,
              lng,
              severity,
              category,
              source: 'GDELT',
              timestamp: new Date().toISOString(),
              country: name,
              ...(sourceUrl && { sourceUrl }),
            });
          }
        }
      } catch (e) {
        console.error(`GDELT query failed: ${query}`, e);
      }
    }

    // Deduplicate by country+category (keep highest severity)
    const deduped = new Map<string, any>();
    for (const ev of allEvents) {
      const key = `${ev.country}-${ev.category}`;
      if (!deduped.has(key) || deduped.get(key).severity < ev.severity) {
        deduped.set(key, ev);
      }
    }

    return NextResponse.json(Array.from(deduped.values()));
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
