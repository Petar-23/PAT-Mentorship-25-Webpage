#!/usr/bin/env node
/**
 * OPTICON Fetch-Only Script
 * 
 * Fetches RSS news + GDELT + economic calendar — NO LLM calls.
 * Writes raw data to /tmp/opticon-raw.json
 * 
 * Run: node scripts/world-watch/ai-brief-fetch.mjs
 */

import { writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── RSS FEEDS (geopolitical only, no OilPrice) ───────────────────────
const FEEDS = [
  // Tier 1: Major wires & broadcasters
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT' },
  { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'Reuters' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://www.dw.com/rss/en/top-stories/rss-en-all', source: 'DW' },
  // Tier 2: Military & defense
  { url: 'https://www.defenseone.com/rss/', source: 'DefenseOne' },
  { url: 'https://breakingdefense.com/feed/', source: 'BreakingDefense' },
  { url: 'https://www.longwarjournal.org/feed', source: 'LongWarJournal' },
  { url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945', source: 'DoD/CENTCOM' },
  { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml', source: 'MilitaryTimes' },
  // Tier 3: Middle East & Gulf (CRITICAL for strike coverage)
  { url: 'https://english.alarabiya.net/tools/rss', source: 'AlArabiya' },
  { url: 'https://www.timesofisrael.com/feed/', source: 'TimesOfIsrael' },
  { url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml', source: 'TheNational' },
  { url: 'https://www.middleeasteye.net/rss', source: 'MiddleEastEye' },
  { url: 'https://english.aawsat.com/feed', source: 'AsharqAlAwsat' },
  // Tier 4: OSINT & investigations
  { url: 'https://www.bellingcat.com/feed/', source: 'Bellingcat' },
  { url: 'https://www.kyivindependent.com/feed/', source: 'KyivIndependent' },
  { url: 'https://www.understandingwar.org/rss.xml', source: 'ISW' },
  // Tier 5: Think tanks & policy
  { url: 'https://thediplomat.com/feed/', source: 'Diplomat' },
  { url: 'https://www.foreignaffairs.com/rss.xml', source: 'ForeignAffairs' },
  { url: 'https://www.atlanticcouncil.org/feed/', source: 'AtlanticCouncil' },
  { url: 'https://www.crisisgroup.org/rss.xml', source: 'CrisisGroup' },
  // Tier 6: Institutional
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', source: 'UN' },
  { url: 'https://reliefweb.int/headlines/rss.xml', source: 'ReliefWeb' },
];

// ─── FETCH RSS ───────────────────────────────────────────────────────
async function fetchRSS() {
  const allItems = [];
  const cutoff = Date.now() - 6 * 60 * 60 * 1000; // last 6 hours

  await Promise.allSettled(FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'OPTICON/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      
      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      let match;
      while ((match = itemRegex.exec(text)) !== null) {
        const block = match[1] || match[2];
        const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
        const desc = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || '';
        const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<published[^>]*>([\s\S]*?)<\/published>|<updated[^>]*>([\s\S]*?)<\/updated>/i);
        const dateStr = pubDate?.[1] || pubDate?.[2] || pubDate?.[3] || '';
        const ts = dateStr ? new Date(dateStr).getTime() : Date.now();
        
        if (title && ts > cutoff) {
          items.push({
            title: title.replace(/<[^>]+>/g, '').trim(),
            description: desc.replace(/<[^>]+>/g, '').trim().slice(0, 200),
            source: feed.source,
            publishedAt: dateStr || new Date().toISOString(),
          });
        }
      }
      allItems.push(...items.slice(0, 10));
    } catch (e) {
      console.warn(`[OPTICON] Feed failed (${feed.source}): ${e.message}`);
    }
  }));

  return allItems;
}

// ─── FETCH GDELT EVENTS (structured military events with coordinates) ──
async function fetchGDELT() {
  try {
    // Get latest GDELT 2.0 Events Export (updates every 15 min)
    const indexRes = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(10000),
    });
    const indexText = await indexRes.text();
    const exportLine = indexText.split('\n').find(l => l.includes('.export.CSV.zip'));
    if (!exportLine) return [];
    const exportUrl = exportLine.trim().split(/\s+/).pop();

    const zipRes = await fetch(exportUrl, { signal: AbortSignal.timeout(20000) });
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());

    // Unzip in memory using child_process
    const { execFileSync } = await import('child_process');
    const tmpZip = '/tmp/gdelt-events.zip';
    const tmpCsv = '/tmp/gdelt-events.csv';
    writeFileSync(tmpZip, zipBuf);
    execFileSync('unzip', ['-o', tmpZip, '-d', '/tmp'], { timeout: 10000 });
    // Find extracted CSV
    const csvFile = execFileSync('ls', ['-t', '/tmp/'], { encoding: 'utf-8' })
      .split('\n').find(f => f.endsWith('.export.CSV'));
    if (!csvFile) return [];

    const { readFileSync: rfs } = await import('fs');
    const csv = rfs(`/tmp/${csvFile}`, 'utf-8');
    const lines = csv.trim().split('\n');

    // GDELT 2.0 columns (1-indexed):
    // 27: EventCode (CAMEO), 53: ActionGeo_FullName
    // 57: ActionGeo_Lat, 58: ActionGeo_Long, 61: SOURCEURL
    // CAMEO 18x=assault, 19x=fight/military, 20x=unconventional violence
    const MILITARY_CAMEO = /^(18|19|20)/;
    const events = [];
    const seen = new Set();

    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 61) continue;
      const cameo = cols[26]; // 0-indexed
      if (!MILITARY_CAMEO.test(cameo)) continue;

      const lat = parseFloat(cols[56]);
      const lng = parseFloat(cols[57]);
      const location = cols[52] || '';
      const sourceUrl = cols[60] || '';

      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
      // Skip US domestic events (noise from US media about US topics)
      if (location.includes('United States') && lat > 24 && lat < 50 && lng < -60) continue;

      // Dedup by location (round to 0.5°)
      const key = `${Math.round(lat*2)/2},${Math.round(lng*2)/2}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        cameoCode: cameo,
        type: cameo.startsWith('19') ? 'military_force' : cameo.startsWith('18') ? 'assault' : 'mass_violence',
        lat, lng,
        location,
        sourceUrl,
        source: 'GDELT',
      });
    }

    console.log(`[OPTICON] GDELT Events: ${lines.length} total rows, ${events.length} military events with coords`);
    return events;
  } catch (e) {
    console.warn(`[OPTICON] GDELT Events failed: ${e.message}`);
    return [];
  }
}

// ─── FETCH ECONOMIC CALENDAR ──────────────────────────────────────────
async function fetchEconCalendar() {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Try Forex Factory JSON first
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'OPTICON/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return data
        .filter(event => {
          const impact = (event.impact || '').toLowerCase();
          if (impact !== 'high') return false;
          const eventTime = new Date(event.date);
          return eventTime >= now && eventTime <= weekFromNow;
        })
        .map(event => ({
          title: event.title || '',
          time: event.date || '',
          currency: event.country || '',
          impact: 'high',
          forecast: event.forecast || '',
          previous: event.previous || '',
        }))
        .slice(0, 20);
    }
  } catch (e) {
    console.warn(`[OPTICON] FF JSON calendar failed: ${e.message}`);
  }

  // Fallback: try ICS
  try {
    const res = await fetch('https://www.forexfactory.com/calendar.ics', {
      headers: { 'User-Agent': 'OPTICON/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const text = await res.text();
      const events = [];
      const eventBlocks = text.split('BEGIN:VEVENT').slice(1);
      for (const block of eventBlocks) {
        const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim() || '';
        const dtstart = block.match(/DTSTART[^:]*:(\S+)/)?.[1] || '';
        const description = block.match(/DESCRIPTION:(.+)/)?.[1]?.trim() || '';
        const currency = description.match(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD)\b/)?.[1] || '';
        const isHigh = description.toLowerCase().includes('high') || summary.match(/NFP|CPI|GDP|FOMC|Federal|PMI/i);
        if (!isHigh) continue;
        let eventTime;
        try {
          const d = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z');
          eventTime = new Date(d);
        } catch (_) { continue; }
        if (eventTime < now || eventTime > weekFromNow) continue;
        events.push({
          title: summary,
          time: eventTime.toISOString(),
          currency,
          impact: 'high',
          forecast: '',
          previous: '',
        });
      }
      return events.slice(0, 20);
    }
  } catch (e) {
    console.warn(`[OPTICON] FF ICS calendar failed: ${e.message}`);
  }

  return [];
}

// ─── DEEP SCRAPE (ISW, Bellingcat, Kyiv Independent via Python/httpx) ─
async function fetchDeepScrape() {
  const scraperPath = resolve(__dirname, 'scrape-deep.py');
  if (!existsSync(scraperPath)) {
    console.warn('[OPTICON] scrape-deep.py not found — skipping deep scrape');
    return [];
  }
  try {
    const output = execFileSync('python3', [scraperPath], {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const items = JSON.parse(output);
    return items;
  } catch (e) {
    console.warn(`[OPTICON] Deep scrape failed: ${e.message}`);
    return [];
  }
}

// ─── DIFF MODE: Load previous brief headlines for dedup ──────────────
const PREV_BRIEF_PATH = '/tmp/opticon-prev-brief.json';
const PREV_HEADLINES_PATH = '/tmp/opticon-prev-headlines.json';

function loadPreviousHeadlines() {
  try {
    if (existsSync(PREV_HEADLINES_PATH)) {
      const data = JSON.parse(readFileSync(PREV_HEADLINES_PATH, 'utf-8'));
      return new Set(data.headlines || []);
    }
  } catch (e) { /* ignore */ }
  return new Set();
}

function savePreviousHeadlines(newsItems) {
  const headlines = newsItems.map(n => n.title.toLowerCase().trim().slice(0, 80));
  writeFileSync(PREV_HEADLINES_PATH, JSON.stringify({
    savedAt: new Date().toISOString(),
    headlines,
  }));
}

// ─── MAIN ────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('[OPTICON] Fetching raw data...');

  const [newsItems, gdeltItems, econCalendar, deepItems] = await Promise.all([
    fetchRSS(),
    fetchGDELT(),
    fetchEconCalendar(),
    fetchDeepScrape(),
  ]);

  // Merge RSS + deep scrape into single newsItems array (deep items have richer excerpt)
  const allNews = [...newsItems, ...deepItems];

  console.log(`[OPTICON] RSS: ${newsItems.length} items | Deep: ${deepItems.length} items | Total: ${allNews.length}`);
  console.log(`[OPTICON] Sources: ${[...new Set(allNews.map(n => n.source))].join(', ')}`);
  console.log(`[OPTICON] GDELT: ${gdeltItems.length} hotspots`);
  console.log(`[OPTICON] Econ Calendar: ${econCalendar.length} high-impact events`);

  // Diff mode: identify genuinely new items
  const prevHeadlines = loadPreviousHeadlines();
  const newItems = allNews.filter(n => !prevHeadlines.has(n.title.toLowerCase().trim().slice(0, 80)));
  const recycledItems = allNews.filter(n => prevHeadlines.has(n.title.toLowerCase().trim().slice(0, 80)));
  
  console.log('[OPTICON] Diff: ' + newItems.length + ' NEW items, ' + recycledItems.length + ' already covered');
  
  // Save current headlines for next run
  savePreviousHeadlines(allNews);

  const output = {
    fetchedAt: new Date().toISOString(),
    newsItems: allNews,
    newItems,           // genuinely new since last run
    recycledCount: recycledItems.length,
    gdeltItems,
    econCalendar,
  };

  writeFileSync('/tmp/opticon-raw.json', JSON.stringify(output, null, 2));
  console.log(`[OPTICON] Written to /tmp/opticon-raw.json (${Date.now() - t0}ms)`);
}

main().catch(err => {
  console.error('[OPTICON] Fatal:', err.message);
  process.exit(1);
});
