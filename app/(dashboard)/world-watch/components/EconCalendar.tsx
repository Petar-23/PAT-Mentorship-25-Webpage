'use client';

import { useState, useMemo, useEffect } from 'react';
import type { EconCalendarEntry, ThemeColors } from '../types';
import { mockCalendar } from '../data/mockCalendar';
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';

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

export function EconCalendar({ theme }: Props) {
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [impactFilter, setImpactFilter] = useState('ALL');
  const [timezone, setTimezone] = useState('America/New_York');
  const [weekOffset, setWeekOffset] = useState(0);

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
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [weekDays]);

  const filtered = useMemo(() => {
    return mockCalendar.filter(entry => {
      if (currencyFilter !== 'ALL' && entry.currency !== currencyFilter) return false;
      if (impactFilter === 'HIGH' && entry.impact !== 3) return false;
      if (impactFilter === 'MEDIUM' && entry.impact !== 2) return false;
      if (impactFilter === 'LOW' && entry.impact !== 1) return false;
      return true;
    });
  }, [currencyFilter, impactFilter]);

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
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} style={selectStyle}>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: theme.overlay0 }}>TZ:</span>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={selectStyle}>
            {TIMEZONES.map(t => <option key={t.zone} value={t.zone}>{t.label}</option>)}
          </select>
        </div>
      </div>

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
        </span>
      </div>
    </div>
  );
}
