#!/usr/bin/env node
/**
 * OPTICON CLI — Push briefs to Vercel Blob
 * 
 * Usage:
 *   node scripts/world-watch/opticon-cli.mjs push <json-file>
 *   node scripts/world-watch/opticon-cli.mjs push --stdin
 *   node scripts/world-watch/opticon-cli.mjs status
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const WORKSPACE = resolve(import.meta.dirname, '../../../');
const BLOB_STORE_URL = 'https://blob.vercel-storage.com';
const BRIEF_PATH = 'world-watch/ai-brief.json';

function getBlobToken() {
  // Try multiple locations
  const paths = [
    resolve(WORKSPACE, '.secrets/vercel-blob-token'),
    resolve(WORKSPACE, 'PAT-Mentorship-25-Webpage/.secrets/vercel-blob-token'),
  ];
  for (const p of paths) {
    try { return readFileSync(p, 'utf-8').trim(); } catch (_) {}
  }
  // Fallback: read from .env.local BLOB_READ_WRITE_TOKEN
  const envPaths = [
    resolve(WORKSPACE, '.env.local'),
    resolve(WORKSPACE, 'PAT-Mentorship-25-Webpage/.env.local'),
    resolve(import.meta.dirname, '../../.env.local'),
  ];
  for (const p of envPaths) {
    try {
      const env = readFileSync(p, 'utf-8');
      const m = env.match(/BLOB_READ_WRITE_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch (_) {}
  }
  console.error('[opticon] Cannot find Vercel Blob token in .secrets/ or .env.local');
  process.exit(1);
}

async function push(jsonContent) {
  const token = getBlobToken();
  const res = await fetch(`${BLOB_STORE_URL}/${BRIEF_PATH}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-api-version': '7',
      'x-content-type': 'application/json',
      'x-cache-control-max-age': '1800',
    },
    body: jsonContent,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[opticon] Upload failed ${res.status}: ${err}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`[opticon] Uploaded: ${result.url}`);
}

async function status() {
  const token = getBlobToken();
  const res = await fetch(`${BLOB_STORE_URL}/${BRIEF_PATH}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error(`[opticon] Fetch failed ${res.status}`);
    process.exit(1);
  }

  const brief = await res.json();
  console.log(JSON.stringify({
    riskLevel: brief.riskLevel,
    generatedAt: brief.generatedAt,
    eventCount: (brief.verifiedEvents || []).length,
    focalPoints: (brief.focalPoints || []).length,
    econEvents: (brief.econCalendar || []).length,
  }, null, 2));
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────
const [,, cmd, arg] = process.argv;

if (cmd === 'push') {
  let content;
  if (arg === '--stdin') {
    content = await readStdin();
  } else if (arg) {
    content = readFileSync(arg, 'utf-8');
  } else {
    console.error('[opticon] Usage: opticon-cli.mjs push <file> | push --stdin');
    process.exit(1);
  }
  // Validate JSON
  try { JSON.parse(content); } catch (e) {
    console.error('[opticon] Invalid JSON:', e.message);
    process.exit(1);
  }
  await push(content);
} else if (cmd === 'status') {
  await status();
} else {
  console.log('Usage:');
  console.log('  node opticon-cli.mjs push <json-file>');
  console.log('  node opticon-cli.mjs push --stdin');
  console.log('  node opticon-cli.mjs status');
  process.exit(1);
}
