import { NextResponse } from 'next/server';

export const revalidate = 900; // cache 15 min

export async function GET() {
  try {
    const urls = [
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
    ];

    const results = await Promise.all(
      urls.map(async url => {
        try {
          const res = await fetch(url, { next: { revalidate: 900 } });
          if (!res.ok) return [];
          return await res.json();
        } catch {
          return [];
        }
      })
    );

    const events = results.flat().map((e: any, i: number) => ({
      id: `ff-${i}`,
      time: e.date,
      currency: e.country,
      impact: e.impact === 'High' ? 3 : e.impact === 'Medium' ? 2 : e.impact === 'Low' ? 1 : 0,
      event: e.title,
      forecast: e.forecast || '',
      previous: e.previous || '',
      actual: e.actual || '',
    }));

    const filtered = events
      .filter((e: any) => e.impact > 0)
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
