import { NextResponse } from 'next/server';

export const revalidate = 900; // cache 15 min

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    const [thisWeekRes, nextWeekRes, holidaysThisYearRes, holidaysNextYearRes] = await Promise.all([
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { next: { revalidate: 900 } }).catch(() => null),
      fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', { next: { revalidate: 900 } }).catch(() => null),
      fetch(`https://date.nager.at/api/v3/publicholidays/${currentYear}/US`, { next: { revalidate: 86400 } }).catch(() => null),
      fetch(`https://date.nager.at/api/v3/publicholidays/${nextYear}/US`, { next: { revalidate: 86400 } }).catch(() => null),
    ]);

    const thisWeek = thisWeekRes?.ok ? await thisWeekRes.json() : [];
    const nextWeek = nextWeekRes?.ok ? await nextWeekRes.json() : [];
    const holidaysThisYear = holidaysThisYearRes?.ok ? await holidaysThisYearRes.json() : [];
    const holidaysNextYear = holidaysNextYearRes?.ok ? await holidaysNextYearRes.json() : [];

    // Economic events
    const econEvents = [...thisWeek, ...nextWeek].map((e: any, i: number) => ({
      id: `ff-${i}`,
      time: e.date,
      currency: e.country,
      impact: e.impact === 'High' ? 3 : e.impact === 'Medium' ? 2 : 1,
      event: e.title,
      forecast: e.forecast || '',
      previous: e.previous || '',
      actual: e.actual || '',
      isHoliday: false,
    }));

    // US bank holidays — combine both years, filter to upcoming 3 months window
    const allHolidays: any[] = [...holidaysThisYear, ...holidaysNextYear];
    const now = new Date();
    const threeMonthsOut = new Date(now);
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

    const holidayEvents = allHolidays
      .filter((h: any) => {
        // Only official national public holidays
        if (!h.types?.includes('Public')) return false;
        const d = new Date(h.date + 'T00:00:00');
        return d >= now && d <= threeMonthsOut;
      })
      .map((h: any, i: number) => ({
        id: `holiday-${i}`,
        time: `${h.date}T00:00:00-05:00`,
        currency: 'USD',
        impact: 0,
        event: `🏦 ${h.localName} — BANK HOLIDAY`,
        forecast: '',
        previous: '',
        actual: '',
        isHoliday: true,
      }));

    const allEvents = [...econEvents, ...holidayEvents]
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json(allEvents);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
