'use client';

import { useState, useMemo, useEffect } from 'react';
import type { EconCalendarEntry, ThemeColors } from '../types';
import { mockCalendar } from '../data/mockCalendar';
import { AlertTriangle, TrendingUp, Minus } from 'lucide-react';

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

const IMPACT_FILTERS = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];

function ImpactIcon({ impact, theme }: { impact: number; theme: ThemeColors }) {
  const size = 14;
  const style = { display: 'inline-flex', alignItems: 'center' };
  if (impact === 3) return <span style={style}><AlertTriangle size={size} color={theme.red} strokeWidth={2.5} /></span>;
  if (impact === 2) return <span style={style}><TrendingUp size={size} color={theme.peach} strokeWidth={2} /></span>;
  return <span style={style}><Minus size={size} color={theme.overlay0} strokeWidth={2} /></span>;
}

function formatTime(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDate(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(isoStr: string): boolean {
  return new Date(isoStr).toDateString() === new Date().toDateString();
}

function isPast(isoStr: string): boolean {
  return new Date(isoStr) < new Date();
}

function getTzFromStorage(): string {
  if (typeof window === 'undefined') return 'America/New_York';
  return localStorage.getItem('ww-calendar-tz') || 'America/New_York';
}

export function EconCalendar({ theme }: Props) {
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [impactFilter, setImpactFilter] = useState('ALL');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => { setTimezone(getTzFromStorage()); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('ww-calendar-tz', timezone);
  }, [timezone]);

  const filtered = useMemo(() => {
    return mockCalendar.filter(entry => {
      if (currencyFilter !== 'ALL' && entry.currency !== currencyFilter) return false;
      if (impactFilter === 'HIGH' && entry.impact !== 3) return false;
      if (impactFilter === 'MEDIUM' && entry.impact !== 2) return false;
      if (impactFilter === 'LOW' && entry.impact !== 1) return false;
      return true;
    });
  }, [currencyFilter, impactFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, EconCalendarEntry[]> = {};
    filtered.forEach(entry => {
      const dateKey = formatDate(entry.time, timezone);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return groups;
  }, [filtered, timezone]);

  const selectStyle = {
    background: theme.surface0,
    color: theme.subtext0,
    border: `1px solid ${theme.surface1}`,
    fontSize: 10,
    padding: '3px 6px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    borderRadius: 0,
  };

  const thStyle = {
    fontSize: 9,
    fontWeight: 700 as const,
    color: theme.overlay0,
    letterSpacing: '1.5px',
    padding: '6px 8px',
    borderBottom: `1px solid ${theme.surface0}`,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.base }}>
      {/* Filters */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.surface0}`,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: theme.overlay0, letterSpacing: '1px' }}>FILTER:</span>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} style={selectStyle}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} style={selectStyle}>
          {IMPACT_FILTERS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: theme.overlay0 }}>TZ:</span>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={selectStyle}>
            {TIMEZONES.map(t => <option key={t.zone} value={t.zone}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(grouped).map(([dateStr, entries]) => (
          <div key={dateStr}>
            <div style={{
              padding: '5px 12px',
              background: theme.surface0,
              fontSize: 10,
              fontWeight: 700,
              color: theme.subtext0,
              letterSpacing: '1.5px',
              borderBottom: `1px solid ${theme.surface1}`,
            }}>
              {dateStr.toUpperCase()}
              {entries.some(e => isToday(e.time)) && (
                <span style={{
                  marginLeft: 8, fontSize: 8,
                  background: theme.blue, color: theme.crust,
                  padding: '1px 5px', letterSpacing: '1px',
                }}>TODAY</span>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>TIME</th>
                  <th style={thStyle}>CCY</th>
                  <th style={thStyle}>IMP</th>
                  <th style={{ ...thStyle, width: '100%' }}>EVENT</th>
                  <th style={thStyle}>FORECAST</th>
                  <th style={thStyle}>PREV</th>
                  <th style={thStyle}>ACTUAL</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const past = isPast(entry.time);
                  const today = isToday(entry.time);
                  return (
                    <tr key={entry.id} style={{
                      background: today ? theme.surface0 + '44' : 'transparent',
                      opacity: past ? 0.5 : 1,
                      borderBottom: `1px solid ${theme.surface0}`,
                    }}>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: today ? theme.yellow : theme.subtext0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatTime(entry.time, timezone)}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, fontWeight: 700, color: entry.currency === 'USD' ? theme.blue : entry.currency === 'EUR' ? theme.peach : theme.text, whiteSpace: 'nowrap' }}>
                        {entry.currency}
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <ImpactIcon impact={entry.impact} theme={theme} />
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: theme.text, fontWeight: entry.impact === 3 ? 600 : 400 }}>
                        {entry.event}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: theme.subtext0, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {entry.forecast || '-'}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: theme.overlay0, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {entry.previous || '-'}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, fontWeight: 700, color: entry.actual ? theme.green : theme.overlay0, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {entry.actual || (past ? '—' : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px',
        borderTop: `1px solid ${theme.surface0}`,
        fontSize: 9, color: theme.overlay0,
        display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>Source: Economic Calendars</span>
        <span>
          <AlertTriangle size={10} color={theme.red} style={{ display: 'inline', verticalAlign: 'middle' }} /> High
          &nbsp;&nbsp;
          <TrendingUp size={10} color={theme.peach} style={{ display: 'inline', verticalAlign: 'middle' }} /> Medium
          &nbsp;&nbsp;
          <Minus size={10} color={theme.overlay0} style={{ display: 'inline', verticalAlign: 'middle' }} /> Low
        </span>
      </div>
    </div>
  );
}
