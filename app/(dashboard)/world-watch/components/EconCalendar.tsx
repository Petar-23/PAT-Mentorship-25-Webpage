'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { EconCalendarEntry, ThemeColors } from '../types';
import { FolderOpen, ChevronLeft, ChevronRight, Landmark } from 'lucide-react';

interface Props {
  theme: ThemeColors;
}

const CURRENCIES = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];

const TIMEZONES = [
  { label: 'New York (EST)', zone: 'America/New_York' },
  { label: 'London (GMT)', zone: 'Europe/London' },
  { label: 'Berlin (CET)', zone: 'Europe/Berlin' },
  { label: 'Tokyo (JST)', zone: 'Asia/Tokyo' },
  { label: 'Sydney (AEDT)', zone: 'Australia/Sydney' },
  { label: 'UTC', zone: 'UTC' },
];

function ImpactFolder({ impact, theme }: { impact: number; theme: ThemeColors }) {
  if (impact === 0) return <Landmark size={15} color={theme.teal} strokeWidth={2} />;
  const color = impact === 3 ? theme.red : impact === 2 ? theme.peach : theme.yellow;
  return <FolderOpen size={15} color={color} strokeWidth={2} />;
}

function formatTime(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function getTzFromStorage(): string {
  if (typeof window === 'undefined') return 'America/New_York';
  return localStorage.getItem('ww-calendar-tz') || 'America/New_York';
}

/* ─── Standalone line chart with day labels below ─── */
function WeekChartSection({ weekDays, filtered, theme, today }: { weekDays: Date[]; filtered: EconCalendarEntry[]; theme: ThemeColors; today: Date }) {
  const counts = weekDays.map(day => filtered.filter(e => isSameDay(new Date(e.time), day)).length);
  const maxCount = Math.max(...counts, 1);

  // SVG dimensions
  const W = 400;
  const H = 80;
  const padX = 40; // left/right padding so dots align with day columns
  const padTop = 12;
  const padBot = 4;
  const chartH = H - padTop - padBot;
  const slotW = (W - padX * 2) / (counts.length - 1 || 1);

  const points = counts.map((c, i) => {
    const x = padX + i * slotW;
    const y = padTop + chartH - (c / maxCount) * chartH;
    return { x, y, count: c };
  });

  // Smooth cubic bezier
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + slotW * 0.4;
    const cpx2 = curr.x - slotW * 0.4;
    pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const areaD = pathD + ` L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;
  const gradId = 'week-line-grad';

  // Compute per-point percentage positions for HTML overlay (avoids SVG text distortion)
  const pointPcts = points.map(p => ({
    xPct: (p.x / W) * 100,
    yPct: (p.y / H) * 100,
    count: p.count,
  }));

  return (
    <div style={{ flexShrink: 0, borderBottom: `1px solid ${theme.surface1}`, background: theme.mantle }}>
      {/* Chart — SVG handles paths/area only; dots+labels are HTML overlays to avoid distortion */}
      <div style={{ position: 'relative', width: '100%', height: 80 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.teal} stopOpacity={0.3} />
              <stop offset="100%" stopColor={theme.teal} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
          <path d={pathD} fill="none" stroke={theme.teal} strokeWidth={1.2} strokeLinecap="round" />
        </svg>
        {/* Dots + count labels as HTML overlay — immune to preserveAspectRatio distortion */}
        {pointPcts.map((p, i) => {
          const isToday = isSameDay(weekDays[i], today);
          const dotSize = isToday ? 8 : 6;
          const color = isToday ? theme.blue : theme.teal;
          return (
            <div key={i} style={{ position: 'absolute', left: `${p.xPct}%`, top: `${p.yPct}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
              {p.count > 0 && (
                <div style={{ fontSize: 9, fontWeight: 700, color, lineHeight: 1, marginBottom: 2, whiteSpace: 'nowrap' }}>
                  {p.count}
                </div>
              )}
              <div style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: color, border: `1.5px solid ${theme.mantle}`, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      {/* Day labels row below chart */}
      <div style={{ display: 'flex', gap: 0 }}>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const dayName = day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          const dayNum = day.getDate();
          return (
            <div key={day.toISOString()} style={{
              flex: 1,
              padding: '6px 0 8px',
              textAlign: 'center',
              borderBottom: isToday ? `2px solid ${theme.blue}` : '2px solid transparent',
              background: isToday ? theme.surface0 + '33' : 'transparent',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? theme.blue : theme.overlay0, letterSpacing: '1.5px' }}>
                {dayName}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? theme.blue : theme.text }}>
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EconCalendar({ theme }: Props) {
  const [currencyFilter, setCurrencyFilter] = useState('USD');
  const [impactFilter, setImpactFilter] = useState<string[]>(['HIGH', 'MEDIUM']);
  const [timezone, setTimezone] = useState('America/New_York');
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarData, setCalendarData] = useState<EconCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-watch/calendar')
      .then(r => r.json())
      .then(data => { setCalendarData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Auto-detect: jump to NEXT week only if current week truly empty AND next week has data
  // Never jump to random far-future weeks
  useEffect(() => {
    if (calendarData.length === 0 || weekOffset !== 0) return;
    const now = new Date();
    const currentWeek = getWeekDays(now);
    const weekEnd = new Date(currentWeek[4].getTime() + 86400000);
    const hasCurrentWeekEvents = calendarData.some(e => {
      const d = new Date(e.time);
      return d >= currentWeek[0] && d <= weekEnd;
    });
    if (!hasCurrentWeekEvents) {
      // Check next week only
      const nextBase = new Date(now);
      nextBase.setDate(nextBase.getDate() + 7);
      const nextWeek = getWeekDays(nextBase);
      const nextWeekEnd = new Date(nextWeek[4].getTime() + 86400000);
      const hasNextWeekEvents = calendarData.some(e => {
        const d = new Date(e.time);
        return d >= nextWeek[0] && d <= nextWeekEnd;
      });
      if (hasNextWeekEvents) {
        setWeekOffset(1);
      }
      // Otherwise stay on current week — don't jump to May or random weeks
    }
  }, [calendarData, weekOffset]);

  useEffect(() => { setTimezone(getTzFromStorage()); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('ww-calendar-tz', timezone);
  }, [timezone]);

  const weekDays = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekDays(base);
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[4];
    const showYear = start.getFullYear() !== new Date().getFullYear();
    const fmt = (d: Date) => d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', ...(showYear ? { year: 'numeric' } : {}),
    });
    // Always show year on the end date
    const fmtEnd = (d: Date) => d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return `${fmt(start)} - ${fmtEnd(end)}`;
  }, [weekDays]);

  const handleToggleImpact = useCallback((level: string) => {
    setImpactFilter(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      }
      return [...prev, level];
    });
  }, []);

  const filtered = useMemo(() => {
    return calendarData.filter(entry => {
      if (currencyFilter !== 'ALL' && entry.currency !== currencyFilter) return false;
      // If no impact filters selected, show all
      if (impactFilter.length === 0) return true;
      // Holiday events (impact 0) show when HOLIDAY filter is active
      if (entry.impact === 0 || entry.isHoliday) {
        return impactFilter.includes('HOLIDAY');
      }
      const level = entry.impact === 3 ? 'HIGH' : entry.impact === 2 ? 'MEDIUM' : 'LOW';
      return impactFilter.includes(level);
    });
  }, [currencyFilter, impactFilter, calendarData]);

  const selectStyle = {
    background: theme.surface0,
    color: theme.subtext0,
    border: `1px solid ${theme.surface1}`,
    fontSize: 12,
    padding: '4px 8px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 0,
  };

  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.base }}>
      {/* Week navigator + Filters */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${theme.surface0}`,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <ChevronLeft size={16} color={theme.subtext0} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, letterSpacing: '0.5px', minWidth: 140, textAlign: 'center' }}>
          {weekLabel}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <ChevronRight size={16} color={theme.subtext0} />
        </button>
        <span style={{ width: 1, height: 18, background: theme.surface1, margin: '0 4px' }} />
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} style={selectStyle}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* Impact multi-select badges */}
        {(['HIGH', 'MEDIUM', 'LOW', 'HOLIDAY'] as const).map(level => {
          const active = impactFilter.includes(level);
          const color = level === 'HIGH' ? theme.red : level === 'MEDIUM' ? theme.peach : level === 'LOW' ? theme.yellow : theme.teal;
          const Icon = level === 'HOLIDAY' ? Landmark : FolderOpen;
          return (
            <button
              key={level}
              onClick={() => handleToggleImpact(level)}
              style={{
                background: active ? color + '22' : theme.surface0,
                border: active ? `1.5px solid ${color}` : `1px solid ${theme.surface1}`,
                color: active ? color : theme.overlay0,
                fontSize: 10,
                padding: '3px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: active ? 700 : 400,
                letterSpacing: '0.5px',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon size={10} color={active ? color : theme.overlay0} />
              {level}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: theme.overlay0 }}>TZ:</span>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={selectStyle}>
            {TIMEZONES.map(t => <option key={t.zone} value={t.zone}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Line chart + weekday tabs (standalone section) */}
      <WeekChartSection weekDays={weekDays} filtered={filtered} theme={theme} today={today} />

      {/* Column header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 80px 50px 36px 1fr 80px 80px 80px',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.surface1}`,
        background: theme.mantle,
      }}>
        {['DATE', 'TIME', 'CCY', 'IMP', 'EVENT', 'FORECAST', 'PREV', 'ACTUAL'].map(h => (
          <span key={h} style={{
            fontSize: 10, fontWeight: 700, color: theme.overlay0,
            letterSpacing: '1.5px',
            textAlign: h === 'FORECAST' || h === 'PREV' || h === 'ACTUAL' ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '12px 16px', fontSize: 12, color: theme.overlay0, textAlign: 'center' }}>
          Loading economic calendar...
        </div>
      )}

      {/* Scrollable body — full 5-day week */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {weekDays.map(day => {
          const dayEntries = filtered.filter(e => isSameDay(new Date(e.time), day));
          const isToday = isSameDay(day, today);
          const isPastDay = day < today && !isToday;

          return (
            <div key={day.toISOString()}>
              {dayEntries.length === 0 ? (
                /* Empty day — "No events scheduled" */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${theme.surface0}`,
                  opacity: isPastDay ? 0.35 : 1,
                  background: isToday ? theme.surface0 + '22' : 'transparent',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? theme.blue : theme.subtext0, whiteSpace: 'nowrap' }}>
                    {formatDayHeader(day)}
                    {isToday && <span style={{ fontSize: 9, color: theme.blue, marginLeft: 8, letterSpacing: '1px', fontWeight: 600 }}>TODAY</span>}
                  </span>
                  <span style={{ fontSize: 13, color: theme.overlay0, fontStyle: 'italic' }}>
                    No events scheduled
                  </span>
                </div>
              ) : (
                /* Day with events */
                dayEntries.map((entry, idx) => {
                  const entryPast = new Date(entry.time) < today;
                  return (
                    <div key={entry.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 80px 50px 36px 1fr 80px 80px 80px',
                      padding: '8px 16px',
                      alignItems: 'center',
                      borderBottom: `1px solid ${theme.surface0}`,
                      background: isToday ? theme.surface0 + '22' : 'transparent',
                      opacity: entryPast ? 0.45 : 1,
                    }}>
                      {/* DATE — only first row of each day */}
                      <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? theme.blue : theme.subtext0, whiteSpace: 'nowrap' }}>
                        {idx === 0 && (
                          <>
                            {formatDayHeader(day)}
                            {isToday && <span style={{ fontSize: 9, color: theme.blue, marginLeft: 8, letterSpacing: '1px', fontWeight: 600 }}>TODAY</span>}
                          </>
                        )}
                      </span>
                      {/* TIME */}
                      <span style={{ fontSize: 13, color: theme.subtext0, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(entry.time, timezone)}
                      </span>
                      {/* CCY */}
                      <span style={{ fontSize: 13, fontWeight: 700, color: entry.currency === 'USD' ? theme.blue : entry.currency === 'EUR' ? theme.peach : theme.text }}>
                        {entry.currency}
                      </span>
                      {/* IMPACT */}
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <ImpactFolder impact={entry.impact} theme={theme} />
                      </span>
                      {/* EVENT */}
                      <span style={{ fontSize: 13, color: theme.text, fontWeight: entry.impact === 3 ? 600 : 400 }}>
                        {entry.event}
                      </span>
                      {/* FORECAST */}
                      <span style={{ fontSize: 13, color: theme.subtext0, textAlign: 'right' }}>
                        {entry.forecast || '-'}
                      </span>
                      {/* PREV */}
                      <span style={{ fontSize: 13, color: theme.overlay0, textAlign: 'right' }}>
                        {entry.previous || '-'}
                      </span>
                      {/* ACTUAL */}
                      <span style={{ fontSize: 13, fontWeight: 700, color: entry.actual ? theme.green : theme.overlay0, textAlign: 'right' }}>
                        {entry.actual || (entryPast ? '-' : '')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${theme.surface0}`,
        fontSize: 10, color: theme.overlay0, display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>Source: Economic Calendars</span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FolderOpen size={10} color={theme.red} /> High</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FolderOpen size={10} color={theme.peach} /> Medium</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FolderOpen size={10} color={theme.yellow} /> Low</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Landmark size={10} color={theme.teal} /> Holiday</span>
        </span>
      </div>
    </div>
  );
}
