import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache (brief updates every 30min)

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const BLOB_STORE_ID = '5snlkupjsmzssxu7'; // from blob URL

const EMPTY_BRIEF = {
  generatedAt: null,
  riskLevel: 'LOW' as const,
  conflictHeat: {},
  focalPoints: [],
  verifiedEvents: [],
  newHotspots: [],
  meta: { status: 'no-brief-available' },
};

export async function GET() {
  try {
    // List blobs with prefix to find the latest ai-brief
    const listRes = await fetch(
      `https://blob.vercel-storage.com?prefix=world-watch/ai-brief&limit=10`,
      {
        headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` },
        next: { revalidate: 300 },
      },
    );

    if (!listRes.ok) {
      console.error('[OPTICON] Blob list error:', listRes.status);
      return NextResponse.json(EMPTY_BRIEF);
    }

    const listData = await listRes.json();
    // Sort by uploadedAt descending to always get the latest brief
    const blobs = (listData?.blobs || []).sort(
      (a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    const blob = blobs[0];
    if (!blob?.url) {
      return NextResponse.json(EMPTY_BRIEF);
    }

    // Fetch the actual brief JSON
    const briefRes = await fetch(blob.url, { next: { revalidate: 300 } });
    if (!briefRes.ok) {
      return NextResponse.json(EMPTY_BRIEF);
    }

    const brief = await briefRes.json();
    return NextResponse.json(brief);
  } catch (err: any) {
    console.error('[OPTICON] Brief API error:', err.message);
    return NextResponse.json(EMPTY_BRIEF, { status: 500 });
  }
}
