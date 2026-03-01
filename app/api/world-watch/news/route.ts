import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export const revalidate = 900; // 15 min cache

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'OPTICON/1.0' },
});

const FEEDS: { url: string; category: string; region?: string; priority: number }[] = [
  // ─── GEOPOLITICS & WORLD ───
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World', priority: 3 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'World', priority: 3 },
  { url: 'https://feeds.reuters.com/reuters/worldNews', category: 'World', priority: 3 },
  { url: 'https://www.theguardian.com/world/rss', category: 'World', priority: 2 },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'World', priority: 2 },
  // ─── DEFENSE & INTELLIGENCE ───
  { url: 'https://www.defenseone.com/rss/', category: 'Defense', priority: 3 },
  { url: 'https://breakingdefense.com/feed/', category: 'Defense', priority: 3 },
  { url: 'https://www.bellingcat.com/feed/', category: 'Intel', priority: 3 },
  // ─── MIDDLE EAST ───
  { url: 'https://www.timesofisrael.com/feed/', category: 'MENA', region: 'Middle East', priority: 2 },
  { url: 'https://english.alarabiya.net/tools/rss', category: 'MENA', region: 'Middle East', priority: 2 },
  // ─── EUROPE ───
  { url: 'https://www.kyivindependent.com/feed/', category: 'Europe', region: 'Europe', priority: 3 },
  { url: 'https://www.dw.com/rss/en/top-stories/rss-en-all', category: 'Europe', region: 'Europe', priority: 2 },
  // ─── ASIA-PACIFIC ───
  { url: 'https://thediplomat.com/feed/', category: 'Asia', region: 'Asia', priority: 2 },
  // ─── ENERGY & RESOURCES ───
  { url: 'https://oilprice.com/rss/main', category: 'Energy', priority: 2 },
  // ─── THINK TANKS ───
  { url: 'https://www.foreignaffairs.com/rss.xml', category: 'Think Tank', priority: 2 },
  { url: 'https://www.atlanticcouncil.org/feed/', category: 'Think Tank', priority: 2 },
  { url: 'https://www.crisisgroup.org/rss.xml', category: 'Crisis', priority: 3 },
  // ─── CRISIS & HUMANITARIAN ───
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', category: 'UN', priority: 2 },
  { url: 'https://reliefweb.int/headlines/rss.xml', category: 'Crisis', priority: 2 },
];

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'ukraine': [49.0, 31.0],
  'russia': [55.75, 37.62],
  'china': [35.0, 105.0],
  'taiwan': [23.7, 121.0],
  'israel': [31.5, 34.8],
  'gaza': [31.5, 34.47],
  'palestine': [31.9, 35.2],
  'iran': [32.4, 53.7],
  'iraq': [33.2, 43.7],
  'syria': [35.0, 38.0],
  'yemen': [15.5, 48.5],
  'libya': [26.3, 17.2],
  'sudan': [15.0, 32.5],
  'somalia': [5.2, 46.2],
  'ethiopia': [9.0, 38.7],
  'congo': [-4.3, 15.3],
  'nigeria': [9.1, 7.5],
  'myanmar': [19.8, 96.2],
  'afghanistan': [33.9, 67.7],
  'pakistan': [30.4, 69.3],
  'india': [20.6, 78.9],
  'north korea': [40.0, 127.0],
  'south korea': [35.9, 127.8],
  'japan': [36.2, 138.3],
  'turkey': [39.9, 32.9],
  'egypt': [26.8, 30.8],
  'saudi': [23.9, 45.1],
  'lebanon': [33.9, 35.5],
  'jordan': [30.6, 36.2],
  'mexico': [23.6, -102.6],
  'venezuela': [6.4, -66.6],
  'colombia': [4.6, -74.3],
  'brazil': [-14.2, -51.9],
  'united states': [38.9, -77.0],
  'u.s.': [38.9, -77.0],
  'america': [38.9, -77.0],
  'pentagon': [38.87, -77.06],
  'nato': [50.87, 4.42],
  'europe': [48.85, 2.35],
  'uk': [51.5, -0.13],
  'britain': [51.5, -0.13],
  'france': [48.85, 2.35],
  'germany': [52.52, 13.4],
  'poland': [52.23, 21.0],
  'romania': [44.4, 26.1],
  'baltic': [56.9, 24.1],
  'arctic': [71.0, 25.0],
  'red sea': [20.0, 38.5],
  'south china sea': [12.0, 114.0],
  'taiwan strait': [24.5, 119.5],
  'black sea': [43.5, 34.0],
  'mediterranean': [35.0, 18.0],
  'strait of hormuz': [26.5, 56.3],
  'sahel': [14.5, 2.0],
  'africa': [0.0, 25.0],
  'asia': [34.0, 100.0],
  'houthi': [15.5, 44.2],
  'hezbollah': [33.9, 35.5],
  'hamas': [31.5, 34.47],
  'kremlin': [55.75, 37.62],
  'beijing': [39.9, 116.4],
  'washington': [38.9, -77.0],
  'kyiv': [50.45, 30.52],
  'moscow': [55.75, 37.62],
  'tehran': [35.69, 51.39],
};

function geocodeTitle(title: string, description?: string): { lat: number; lng: number; country: string } | null {
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  const sorted = Object.entries(COUNTRY_CENTROIDS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, [lat, lng]] of sorted) {
    if (text.includes(keyword)) {
      return { lat, lng, country: keyword.charAt(0).toUpperCase() + keyword.slice(1) };
    }
  }
  return null;
}

export async function GET() {
  try {
    const allItems: any[] = [];

    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          return (parsed.items || []).slice(0, 10).map(item => ({
            title: item.title || '',
            link: item.link || '',
            pubDate: item.pubDate || (item as any).isoDate || '',
            description: ((item as any).contentSnippet || item.content || '').slice(0, 200),
            source: parsed.title || feed.url,
            category: feed.category,
            region: feed.region || '',
            priority: feed.priority,
          }));
        } catch {
          return [];
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    const seen = new Set<string>();
    const unique = allItems.filter(item => {
      const key = item.title.toLowerCase().trim().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime() || 0;
      const dateB = new Date(b.pubDate).getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.priority - a.priority;
    });

    const top = unique.slice(0, 100);

    const geocoded = top.map((item, i) => {
      const geo = geocodeTitle(item.title, item.description);
      return {
        id: `news-${i}-${Date.now()}`,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
        source: item.source,
        category: item.category,
        region: item.region,
        priority: item.priority,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        country: geo?.country || '',
      };
    });

    return NextResponse.json({
      items: geocoded,
      totalFeeds: FEEDS.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News RSS error:', error);
    return NextResponse.json({ items: [], error: 'Failed to fetch news' }, { status: 500 });
  }
}
