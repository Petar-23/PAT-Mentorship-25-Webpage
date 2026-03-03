#!/usr/bin/env node
/**
 * OPTICON Fetch-Only Script
 * 
 * Fetches RSS news + GDELT + economic calendar — NO LLM calls.
 * Writes raw data to /tmp/opticon-raw.json
 * 
 * Run: node scripts/world-watch/ai-brief-fetch.mjs
 */

import { writeFileSync } from 'fs';

// ─── RSS FEEDS (geopolitical only, no OilPrice) ───────────────────────
const FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT' },
  { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'Reuters' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://www.defenseone.com/rss/', source: 'DefenseOne' },
  { url: 'https://breakingdefense.com/feed/', source: 'BreakingDefense' },
  { url: 'https://www.bellingcat.com/feed/', source: 'Bellingcat' },
  { url: 'https://www.timesofisrael.com/feed/', source: 'TimesOfIsrael' },
  { url: 'https://english.alarabiya.net/tools/rss', source: 'AlArabiya' },
  { url: 'https://www.kyivindependent.com/feed/', source: 'KyivIndependent' },
  { url: 'https://www.dw.com/rss/en/top-stories/rss-en-all', source: 'DW' },
  { url: 'https://thediplomat.com/feed/', source: 'Diplomat' },
  { url: 'https://www.foreignaffairs.com/rss.xml', source: 'ForeignAffairs' },
  { url: 'https://www.atlanticcouncil.org/feed/', source: 'AtlanticCouncil' },
  { url: 'https://www.crisisgroup.org/rss.xml', source: 'CrisisGroup' },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', source: 'UN' },
  { url: 'https://reliefweb.int/headlines/rss.xml', source: 'ReliefWeb' },
  { url: 'https://www.understandingwar.org/rss.xml', source: 'ISW' },
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

// ─── FETCH GDELT ─────────────────────────────────────────────────────
async function fetchGDELT() {
  try {
    const url = 'https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20war%20OR%20military%20OR%20attack&format=GeoJSON&maxpoints=30&timespan=6h';
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    return (data?.features || []).map(f => ({
      title: f.properties?.html?.match(/title="([^"]+)"/)?.[1] || 'Unknown',
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
      count: f.properties?.count || 0,
    }));
  } catch (e) {
    console.warn(`[OPTICON] GDELT failed: ${e.message}`);
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

// ─── MAIN ────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('[OPTICON] Fetching raw data...');

  const [newsItems, gdeltItems, econCalendar] = await Promise.all([
    fetchRSS(),
    fetchGDELT(),
    fetchEconCalendar(),
  ]);

  console.log(`[OPTICON] News: ${newsItems.length} items from ${[...new Set(newsItems.map(n => n.source))].length} sources`);
  console.log(`[OPTICON] GDELT: ${gdeltItems.length} hotspots`);
  console.log(`[OPTICON] Econ Calendar: ${econCalendar.length} high-impact events`);

  const output = {
    fetchedAt: new Date().toISOString(),
    newsItems,
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
