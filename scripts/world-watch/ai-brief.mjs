#!/usr/bin/env node
/**
 * OPTICON AI Brief Generator
 * 
 * Fetches RSS news + GDELT data → sends to Sonnet for analysis →
 * uploads enriched JSON to Vercel Blob as "world-watch/ai-brief.json"
 * 
 * Run: node scripts/world-watch/ai-brief.mjs
 * Cron: every 30min via OpenClaw
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── CONFIG ───────────────────────────────────────────────────────────
// Resolve from workspace root (clawd/)
const WORKSPACE = resolve(import.meta.dirname, '../../../');
const BLOB_TOKEN = readFileSync(resolve(WORKSPACE, '.secrets/vercel-blob-token'), 'utf-8').trim();
// Load from env, .env file, or secrets
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
if (!ANTHROPIC_API_KEY) {
  try {
    const envFile = readFileSync(resolve(WORKSPACE, '.env'), 'utf-8');
    const match = envFile.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) ANTHROPIC_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) {}
}
if (!ANTHROPIC_API_KEY) {
  try { ANTHROPIC_API_KEY = readFileSync(resolve(WORKSPACE, '.secrets/anthropic-api-key'), 'utf-8').trim(); } catch (_) {}
}
if (!ANTHROPIC_API_KEY) throw new Error('No ANTHROPIC_API_KEY found');
const BLOB_STORE_URL = 'https://blob.vercel-storage.com';
const BRIEF_PATH = 'world-watch/ai-brief.json';
const MODEL = 'claude-sonnet-4-6';

// ─── RSS FEEDS (same as /api/world-watch/news) ───────────────────────
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
  { url: 'https://oilprice.com/rss/main', source: 'OilPrice' },
  { url: 'https://www.foreignaffairs.com/rss.xml', source: 'ForeignAffairs' },
  { url: 'https://www.atlanticcouncil.org/feed/', source: 'AtlanticCouncil' },
  { url: 'https://www.crisisgroup.org/rss.xml', source: 'CrisisGroup' },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', source: 'UN' },
  { url: 'https://reliefweb.int/headlines/rss.xml', source: 'ReliefWeb' },
];

// ─── KNOWN CONFLICTS ─────────────────────────────────────────────────
const CONFLICTS = [
  { id: 'ru-ua', name: 'Russia-Ukraine War', keywords: ['ukraine', 'kyiv', 'donbas', 'crimea', 'kursk', 'zelensky'] },
  { id: 'il-ps', name: 'Israel-Palestine', keywords: ['israel', 'gaza', 'hamas', 'hezbollah', 'netanyahu', 'west bank', 'rafah'] },
  { id: 'ir-us', name: 'Iran-US/Israel', keywords: ['iran', 'hormuz', 'houthi', 'red sea', 'tehran', 'irgc', 'persian gulf'] },
  { id: 'sudan', name: 'Sudan Civil War', keywords: ['sudan', 'khartoum', 'darfur', 'rsf'] },
  { id: 'myanmar', name: 'Myanmar Civil War', keywords: ['myanmar', 'burma', 'junta'] },
  { id: 'sahel', name: 'Sahel Insurgency', keywords: ['sahel', 'mali', 'burkina', 'niger', 'boko haram'] },
  { id: 'taiwan-strait', name: 'Taiwan Strait', keywords: ['taiwan', 'taipei', 'taiwan strait', 'south china sea'] },
];

// ─── KNOWN MILITARY BASES (origin points for strike arcs) ────────────
const MILITARY_ORIGINS = {
  'iran': [
    { name: 'Isfahan AFB', lat: 32.63, lng: 51.69 },
    { name: 'Bandar Abbas', lat: 27.21, lng: 56.18 },
    { name: 'Bushehr', lat: 28.95, lng: 50.83 },
  ],
  'russia': [
    { name: 'Engels-2 AFB', lat: 51.48, lng: 46.20 },
    { name: 'Crimea (Sevastopol)', lat: 44.62, lng: 33.53 },
    { name: 'Mozdok AFB', lat: 43.79, lng: 44.60 },
  ],
  'israel': [
    { name: 'Nevatim AFB', lat: 31.21, lng: 34.84 },
    { name: 'Ramon AFB', lat: 30.78, lng: 34.67 },
  ],
  'united states': [
    { name: 'Al Udeid AB (Qatar)', lat: 25.12, lng: 51.31 },
    { name: 'Camp Lemonnier (Djibouti)', lat: 11.55, lng: 43.15 },
  ],
};

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
      
      // Simple RSS/Atom parsing — extract titles + descriptions
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
          items.push({ title: title.replace(/<[^>]+>/g, ''), source: feed.source });
        }
      }
      allItems.push(...items.slice(0, 10)); // max 10 per feed
    } catch (_) {}
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
  } catch (_) {
    return [];
  }
}

// ─── CALL SONNET ─────────────────────────────────────────────────────
async function analyzewithSonnet(newsItems, gdeltItems) {
  const newsText = newsItems.map((n, i) => `[${i + 1}] [${n.source}] ${n.title}`).join('\n');
  const gdeltText = gdeltItems.map((g, i) => `[G${i + 1}] ${g.title} (${g.count} articles, ${g.lat?.toFixed(1)},${g.lng?.toFixed(1)})`).join('\n');

  const prompt = `You are an OSINT intelligence analyst. Analyze these news headlines from the last 6 hours and produce a structured intelligence brief.

## RSS NEWS (${newsItems.length} headlines from ${new Set(newsItems.map(n => n.source)).size} sources)
${newsText}

## GDELT HOTSPOTS (automated conflict detection)
${gdeltText}

## KNOWN ACTIVE CONFLICTS
${CONFLICTS.map(c => `- ${c.id}: ${c.name}`).join('\n')}

## KNOWN MILITARY BASES (for strike arc origins)
${JSON.stringify(MILITARY_ORIGINS, null, 2)}

## YOUR TASK
Produce a JSON object with this exact structure:

{
  "generatedAt": "<ISO timestamp>",
  "riskLevel": "LOW" | "ELEVATED" | "HIGH" | "CRITICAL",
  "conflictHeat": {
    "<conflictId>": <number 0-20, based on how many verified news items relate to this conflict>
  },
  "focalPoints": [
    {
      "conflictId": "<id>",
      "region": "<human readable>",
      "heat": <number>,
      "summary": "<1-2 sentence summary of what's happening>",
      "escalation": "up" | "stable" | "down"
    }
  ],
  "verifiedEvents": [
    {
      "headline": "<cleaned headline>",
      "conflictId": "<id or null if no conflict>",
      "type": "strike" | "deployment" | "diplomatic" | "protest" | "humanitarian" | "other",
      "targetLocation": { "name": "<city/place>", "lat": <number>, "lng": <number> } | null,
      "originLocation": { "name": "<military base or launch site>", "lat": <number>, "lng": <number> } | null,
      "corroboration": <number 1-5, how many independent sources report this>,
      "sources": ["<source1>", "<source2>"],
      "verified": <boolean, true if corroboration >= 2>,
      "severity": 1 | 2 | 3 | 4
    }
  ],
  "newHotspots": [
    {
      "name": "<location name>",
      "lat": <number>,
      "lng": <number>,
      "conflictId": "<id or null>",
      "reason": "<why this is a new hotspot>",
      "type": "chokepoint" | "frontline" | "target"
    }
  ]
}

RULES:
- Only include verifiedEvents where corroboration >= 2 (at least 2 independent sources report similar events)
- For "strike" type events, ALWAYS try to determine originLocation from the known military bases
- targetLocation must have valid lat/lng coordinates — use your knowledge of world geography
- originLocation should be the most likely launch site based on the attacking party
- If multiple headlines describe the same event, merge them into one verifiedEvent with higher corroboration
- conflictHeat is a count of verified, deduplicated events per conflict
- newHotspots: only add if there's a significant cluster of news about a location NOT already in the known conflicts
- Be conservative: when in doubt, mark verified: false
- riskLevel: CRITICAL if active strikes happening, HIGH if major escalation, ELEVATED if tensions rising, LOW if quiet

Respond ONLY with the JSON object, no markdown fences or explanation.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sonnet API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  
  // Parse JSON (strip markdown fences if present)
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(jsonStr);
}

// ─── UPLOAD TO VERCEL BLOB ──────────────────────────────────────────
async function uploadToBlob(brief) {
  const body = JSON.stringify(brief, null, 2);
  
  const res = await fetch(`${BLOB_STORE_URL}/${BRIEF_PATH}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${BLOB_TOKEN}`,
      'Content-Type': 'application/json',
      'x-api-version': '7',
      'x-content-type': 'application/json',
      'x-cache-control-max-age': '1800',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blob upload error ${res.status}: ${err}`);
  }

  const result = await res.json();
  return result.url;
}

// ─── MAIN ────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('[OPTICON] AI Brief generation starting...');

  // 1. Fetch data (parallel)
  const [newsItems, gdeltItems] = await Promise.all([fetchRSS(), fetchGDELT()]);
  console.log(`[OPTICON] Fetched ${newsItems.length} news items, ${gdeltItems.length} GDELT hotspots`);

  if (newsItems.length === 0) {
    console.log('[OPTICON] No news items — skipping brief generation');
    process.exit(0);
  }

  // 2. Analyze with Sonnet
  console.log('[OPTICON] Sending to Sonnet for analysis...');
  const brief = await analyzewithSonnet(newsItems, gdeltItems);
  brief.meta = {
    newsCount: newsItems.length,
    gdeltCount: gdeltItems.length,
    sources: [...new Set(newsItems.map(n => n.source))],
    processingMs: Date.now() - t0,
  };

  // 3. Upload to Vercel Blob
  console.log('[OPTICON] Uploading to Vercel Blob...');
  const blobUrl = await uploadToBlob(brief);
  console.log(`[OPTICON] Brief uploaded: ${blobUrl}`);

  // 4. Summary
  const verified = (brief.verifiedEvents || []).filter(e => e.verified).length;
  const strikes = (brief.verifiedEvents || []).filter(e => e.type === 'strike' && e.verified).length;
  console.log(`[OPTICON] Done in ${Date.now() - t0}ms — Risk: ${brief.riskLevel}, Verified events: ${verified}, Strikes: ${strikes}`);
}

main().catch(err => {
  console.error('[OPTICON] Fatal:', err.message);
  process.exit(1);
});
