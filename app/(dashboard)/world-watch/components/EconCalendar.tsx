'use client';

import { useState, useMemo } from 'react';
import type { EconCalendarEntry, ThemeColors } from '../types';
import { IMPACT_LABELS } from '../types';
import { mockCalendar } from '../data/mockCalendar';

interface Props {
  theme: ThemeColors;
}

const CURRENCIES = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
const IMPACTS = ['ALL', '🔴 High', '🟠 Medium', '🟡 Low'];

function formatCET(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(isoStr: string): boolean {
  const d = new Date(isoStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isPast(isoStr: string): boolean {
  return new Date(isoStr) < new Date();
}

export function EconCalendar({ theme }: Props) {
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [impactFilter, setImpactFilter] = useState('ALL');

  const filtered = useMemo(() => {
    return mockCalendar.filter(entry => {
      if (currencyFilter !== 'ALL' && entry.currency !== currencyFilter) return false;
      if (impactFilter === '🔴 High' && entry.impact !== 3) return false;
      if (impactFilter === '🟠 Medium' && entry.impact !== 2) return false;
      if (impactFilter === '🟡 Low' && entry.impact !== 1) return false;
      return true;
    });
  }, [currencyFilter, impactFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, EconCalendarEntry[]> = {};
    filtered.forEach(entry => {
      const dateKey = formatDate(entry.time);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return groups;
  }, [filtered]);

  const filterStyle = {
    background: theme.surface0,
    color: theme.subtext0,
    border: `1px solid ${theme.surface1}`,
    fontSize: 10,
    padding: '3px 6px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '0.5px',
  };

  const headerCellStyle = {
    fontSize: 9,
    fontWeight: 700,
    color: theme.overlay0,
    letterSpacing: '1.5px',
    padding: '6px 8px',
    borderBottom: `1px solid ${theme.surface0}`,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: theme.base,
    }}>
      {/* Filters */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.surface0}`,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: theme.overlay0, letterSpacing: '1px' }}>FILTER:</span>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} style={filterStyle}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} style={filterStyle}>
          {IMPACTS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <span style={{ fontSize: 10, color: theme.overlay0, marginLeft: 'auto' }}>
          TZ: CET (Europe/Berlin)
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(grouped).map(([dateStr, entries]) => (
          <div key={dateStr}>
            {/* Date header */}
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
                  marginLeft: 8,
                  fontSize: 8,
                  background: theme.blue,
                  color: theme.crust,
                  padding: '1px 5px',
                  letterSpacing: '1px',
                }}>TODAY</span>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>TIME</th>
                  <th style={headerCellStyle}>CCY</th>
                  <th style={headerCellStyle}>IMP</th>
                  <th style={{ ...headerCellStyle, width: '100%' }}>EVENT</th>
                  <th style={headerCellStyle}>FORECAST</th>
                  <th style={headerCellStyle}>PREV</th>
                  <th style={headerCellStyle}>ACTUAL</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const past = isPast(entry.time);
                  const today = isToday(entry.time);

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        background: today ? theme.surface0 + '44' : 'transparent',
                        opacity: past ? 0.5 : 1,
                        borderBottom: `1px solid ${theme.surface0}`,
                      }}
                    >
                      <td style={{
                        padding: '7px 8px',
                        fontSize: 11,
                        color: today ? theme.yellow : theme.subtext0,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatCET(entry.time)}
                      </td>
                      <td style={{
                        padding: '7px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: entry.currency === 'USD' ? theme.blue : entry.currency === 'EUR' ? theme.peach : theme.text,
                        whiteSpace: 'nowrap',
                      }}>
                        {entry.currency}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {IMPACT_LABELS[entry.impact]}
                      </td>
                      <td style={{
                        padding: '7px 8px',
                        fontSize: 11,
                        color: theme.text,
                        fontWeight: entry.impact === 3 ? 600 : 400,
                      }}>
                        {entry.event}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: theme.subtext0, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {entry.forecast || '-'}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: theme.overlay0, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {entry.previous || '-'}
                      </td>
                      <td style={{
                        padding: '7px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: entry.actual ? theme.green : theme.overlay0,
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                      }}>
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
        fontSize: 9,
        color: theme.overlay0,
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Source: Forex Factory / Economic Calendars</span>
        <span>🔴 High Impact &nbsp; 🟠 Medium &nbsp; 🟡 Low</span>
      </div>
    </div>
  );
}
