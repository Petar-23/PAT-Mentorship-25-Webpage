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
  return <FolderOpen size={14} color={color} strokeWidth={2} />;
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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
    fontSize: 10,
    padding: '3px 6px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 0,
  };

  const thStyle = {
    fontSize: 9,
    fontWeight: 700 as const,
    color: theme.overlay0,
    letterSpacing: '1.5px',
    padding: '6px 8px',
    borderBottom: `1px solid ${theme.surface1}`,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  };

  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.base }}>
      {/* Week navigator + Filters */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.surface0}`,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <ChevronLeft size={14} color={theme.subtext0} />
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: theme.text, letterSpacing: '0.5px', minWidth: 130, textAlign: 'center' }}>
          {weekLabel}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <ChevronRight size={14} color={theme.subtext0} />
        </button>
        <span style={{ width: 1, height: 16, background: theme.surface1, margin: '0 4px' }} />
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} style={selectStyle}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} style={selectStyle}>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: theme.overlay0 }}>TZ:</span>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={selectStyle}>
            {TIMEZONES.map(t => <option key={t.zone} value={t.zone}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: theme.surface0 }}>
            <th style={{ ...thStyle, width: 80 }}>DATE</th>
            <th style={{ ...thStyle, width: 70 }}>TIME</th>
            <th style={{ ...thStyle, width: 50 }}>CCY</th>
            <th style={{ ...thStyle, width: 30 }}>IMP</th>
            <th style={thStyle}>EVENT</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>FORECAST</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>PREV</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>ACTUAL</th>
          </tr>
        </thead>
      </table>

      {/* Scrollable body with full 5-day week */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {weekDays.map(day => {
          const dayEntries = filtered.filter(e => isSameDay(new Date(e.time), day));
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;

          return (
            <div key={day.toISOString()}>
              {/* Day row */}
              {dayEntries.length === 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    <tr style={{
                      borderBottom: `1px solid ${theme.surface0}`,
                      opacity: isPast ? 0.4 : 1,
                    }}>
                      <td style={{ width: 80, padding: '10px 8px', fontSize: 11, fontWeight: 700, color: isToday ? theme.yellow : theme.subtext0, verticalAlign: 'top' }}>
                        {formatDayHeader(day)}
                        {isToday && <span style={{ display: 'block', fontSize: 8, color: theme.blue, marginTop: 2 }}>TODAY</span>}
                      </td>
                      <td colSpan={7} style={{ padding: '10px 8px', fontSize: 11, color: theme.overlay0, fontStyle: 'italic' }}>
                        No events scheduled
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    {dayEntries.map((entry, idx) => {
                      const entryPast = new Date(entry.time) < today;
                      return (
                        <tr key={entry.id} style={{
                          borderBottom: `1px solid ${theme.surface0}`,
                          background: isToday ? theme.surface0 + '33' : 'transparent',
                          opacity: entryPast ? 0.5 : 1,
                        }}>
                          <td style={{ width: 80, padding: '7px 8px', fontSize: 11, fontWeight: 700, color: isToday ? theme.yellow : theme.subtext0, verticalAlign: 'top' }}>
                            {idx === 0 && (
                              <>
                                {formatDayHeader(day)}
                                {isToday && <span style={{ display: 'block', fontSize: 8, color: theme.blue, marginTop: 2 }}>TODAY</span>}
                              </>
                            )}
                          </td>
                          <td style={{ width: 70, padding: '7px 8px', fontSize: 11, color: theme.subtext0, fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(entry.time, timezone)}
                          </td>
                          <td style={{ width: 50, padding: '7px 8px', fontSize: 11, fontWeight: 700, color: entry.currency === 'USD' ? theme.blue : entry.currency === 'EUR' ? theme.peach : theme.text }}>
                            {entry.currency}
                          </td>
                          <td style={{ width: 30, padding: '7px 8px' }}>
                            <ImpactFolder impact={entry.impact} theme={theme} />
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: theme.text, fontWeight: entry.impact === 3 ? 600 : 400 }}>
                            {entry.event}
                          </td>
                          <td style={{ width: 70, padding: '7px 8px', fontSize: 11, color: theme.subtext0, textAlign: 'right' }}>
                            {entry.forecast || '-'}
                          </td>
                          <td style={{ width: 70, padding: '7px 8px', fontSize: 11, color: theme.overlay0, textAlign: 'right' }}>
                            {entry.previous || '-'}
                          </td>
                          <td style={{ width: 70, padding: '7px 8px', fontSize: 11, fontWeight: 700, color: entry.actual ? theme.green : theme.overlay0, textAlign: 'right' }}>
                            {entry.actual || (entryPast ? '-' : '')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px', borderTop: `1px solid ${theme.surface0}`,
        fontSize: 9, color: theme.overlay0, display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>Source: Economic Calendars</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span><FolderOpen size={9} color={theme.red} style={{ verticalAlign: 'middle' }} /> High</span>
          <span><FolderOpen size={9} color={theme.peach} style={{ verticalAlign: 'middle' }} /> Medium</span>
          <span><FolderOpen size={9} color={theme.yellow} style={{ verticalAlign: 'middle' }} /> Low</span>
        </span>
      </div>
    </div>
  );
}
