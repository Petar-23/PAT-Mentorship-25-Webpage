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
  'saudi': [23.9, 45.1], 'saudi arabia': [23.9, 45.1],
  'lebanon': [33.9, 35.5],
  'jordan': [30.6, 36.2],
  'dubai': [25.2, 55.3], 'abu dhabi': [24.5, 54.7],
  'bahrain': [26.1, 50.5], 'qatar': [25.3, 51.2], 'doha': [25.3, 51.5],
  'kuwait': [29.4, 47.9], 'oman': [23.6, 58.5],
  'strait of hormuz': [26.5, 56.3], 'hormuz': [26.5, 56.3],
  'persian gulf': [26.0, 52.0], 'gulf states': [25.0, 53.0],
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

// Weighted conflict keywords — weight = importance of this keyword for identifying the conflict
// Higher weight = stronger signal. Title matches get 2× bonus.
const CONFLICT_KEYWORDS: Record<string, { kw: string; weight: number }[]> = {
  'ru-ua': [
    { kw: 'ukraine', weight: 5 }, { kw: 'ukrainian', weight: 5 }, { kw: 'kyiv', weight: 5 },
    { kw: 'zelensky', weight: 5 }, { kw: 'zelenskyy', weight: 5 },
    { kw: 'donbas', weight: 4 }, { kw: 'donetsk', weight: 4 }, { kw: 'luhansk', weight: 4 },
    { kw: 'crimea', weight: 4 }, { kw: 'kherson', weight: 4 }, { kw: 'kharkiv', weight: 4 },
    { kw: 'bakhmut', weight: 4 }, { kw: 'avdiivka', weight: 4 }, { kw: 'kursk', weight: 3 },
    { kw: 'russian invasion', weight: 4 }, { kw: 'russian troops', weight: 3 },
  ],
  'il-ps': [
    { kw: 'gaza', weight: 6 }, { kw: 'hamas', weight: 5 }, { kw: 'palestinian', weight: 4 },
    { kw: 'west bank', weight: 5 }, { kw: 'rafah', weight: 5 }, { kw: 'netanyahu', weight: 3 },
    { kw: 'idf', weight: 3 }, { kw: 'ceasefire gaza', weight: 6 },
    { kw: 'hezbollah', weight: 3 }, { kw: 'hostage', weight: 2 },
    // "israel" alone is WEAK for this conflict — Iran articles also mention Israel
    { kw: 'israel', weight: 1 }, { kw: 'israeli', weight: 1 },
  ],
  'ir-us': [
    { kw: 'iran', weight: 6 }, { kw: 'iranian', weight: 6 }, { kw: 'tehran', weight: 5 },
    { kw: 'irgc', weight: 6 }, { kw: 'revolutionary guard', weight: 5 },
    { kw: 'strait of hormuz', weight: 6 }, { kw: 'hormuz', weight: 5 },
    { kw: 'persian gulf', weight: 4 }, { kw: 'houthi', weight: 4 }, { kw: 'red sea', weight: 3 },
    { kw: 'axis of resistance', weight: 5 }, { kw: 'proxy war', weight: 3 },
    { kw: 'nuclear iran', weight: 5 }, { kw: 'sanctions iran', weight: 4 },
    // Gulf states being attacked = Iran conflict, not Gaza
    { kw: 'dubai', weight: 3 }, { kw: 'abu dhabi', weight: 3 }, { kw: 'bahrain', weight: 3 },
    { kw: 'qatar', weight: 2 }, { kw: 'gcc', weight: 3 }, { kw: 'gulf states', weight: 3 },
    { kw: 'iran attack', weight: 6 }, { kw: 'iran strikes', weight: 6 },
    { kw: 'iran fires', weight: 6 }, { kw: 'iran missile', weight: 5 },
    { kw: 'iran drone', weight: 5 }, { kw: 'iranian missile', weight: 5 },
    { kw: 'iranian drone', weight: 5 },
  ],
  'sudan': [
    { kw: 'sudan', weight: 6 }, { kw: 'sudanese', weight: 5 }, { kw: 'khartoum', weight: 5 },
    { kw: 'darfur', weight: 5 }, { kw: 'rsf', weight: 5 }, { kw: 'rapid support forces', weight: 5 },
    { kw: 'hemeti', weight: 5 },
  ],
  'myanmar': [
    { kw: 'myanmar', weight: 6 }, { kw: 'burma', weight: 5 }, { kw: 'junta', weight: 3 },
    { kw: 'naypyidaw', weight: 5 }, { kw: 'rohingya', weight: 4 },
  ],
  'sahel': [
    { kw: 'sahel', weight: 6 }, { kw: 'mali', weight: 4 }, { kw: 'burkina faso', weight: 5 },
    { kw: 'boko haram', weight: 5 }, { kw: 'isis sahel', weight: 5 }, { kw: 'wagner africa', weight: 4 },
    { kw: 'jnim', weight: 5 },
  ],
  'taiwan-strait': [
    { kw: 'taiwan', weight: 6 }, { kw: 'taiwanese', weight: 5 }, { kw: 'taipei', weight: 5 },
    { kw: 'taiwan strait', weight: 6 }, { kw: 'south china sea', weight: 3 },
    { kw: 'pla navy', weight: 4 }, { kw: 'one china', weight: 3 },
  ],
};

function matchConflict(title: string, description: string): string | null {
  const titleLow = title.toLowerCase();
  const descLow = description.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [id, keywords] of Object.entries(CONFLICT_KEYWORDS)) {
    let score = 0;
    for (const { kw, weight } of keywords) {
      // Title match = 2× weight (title is the strongest signal)
      if (titleLow.includes(kw)) score += weight * 2;
      // Description match = 1× weight
      else if (descLow.includes(kw)) score += weight;
    }
    if (score > 0) scores[id] = score;
  }

  // Find the winner
  let bestId: string | null = null;
  let bestScore = 0;
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  // Minimum threshold: need at least 3 weighted points to match
  return bestScore >= 3 ? bestId : null;
}

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
        conflictId: matchConflict(item.title, item.description),
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
