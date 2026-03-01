'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, FolderOpen, Calendar } from 'lucide-react';
import type { ThemeColors, EconCalendarEntry } from '../types';

interface Props {
  theme: ThemeColors;
}

function getWeekDays(base: Date): Date[] {
  const d = new Date(base);
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

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function MiniCalendar({ theme }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [impactFilter, setImpactFilter] = useState<string[]>(['HIGH', 'MEDIUM']);
  const [calendarData, setCalendarData] = useState<EconCalendarEntry[]>([]);

  useEffect(() => {
    fetch('/api/world-watch/calendar')
      .then(r => r.json())
      .then(data => setCalendarData(data))
      .catch(() => {});
  }, []);

  const today = new Date();
  // On weekends (Sat=6, Sun=0), show next week
  const weekDays = useMemo(() => {
    const base = new Date(today);
    const dow = base.getDay();
    if (dow === 0 || dow === 6) {
      // Jump to next Monday
      const daysToMon = dow === 0 ? 1 : 2;
      base.setDate(base.getDate() + daysToMon);
    }
    return getWeekDays(base);
  }, []);

  const handleToggleImpact = (level: string) => {
    setImpactFilter(prev => {
      if (prev.includes(level)) return prev.filter(l => l !== level);
      return [...prev, level];
    });
  };

  const filtered = useMemo(() => {
    return calendarData.filter(e => {
      if (currency !== 'ALL' && e.currency !== currency) return false;
      if (impactFilter.length > 0) {
        const level = e.impact === 3 ? 'HIGH' : e.impact === 2 ? 'MEDIUM' : 'LOW';
        if (!impactFilter.includes(level)) return false;
      }
      return true;
    });
  }, [currency, impactFilter, calendarData]);

  const impactColor = (imp: 1 | 2 | 3) => {
    if (imp === 3) return theme.red;
    if (imp === 2) return theme.peach;
    return theme.yellow;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York',
    });
  };

  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  return (
    <div style={{
      borderRadius: 6,
      background: theme.mantle + 'ee',
      border: `1px solid ${theme.surface0}`,
      boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: collapsed ? 'none' : `1px solid ${theme.surface0}`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={14} color={theme.blue} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.7px', color: theme.text }}>
            ECON CALENDAR
          </span>
          <span style={{
            fontSize: 9, padding: '2px 6px',
            background: theme.blue + '33', color: theme.blue, borderRadius: 3,
          }}>USA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: theme.overlay0 }}>NY TIME</span>
          {collapsed
            ? <ChevronDown size={14} color={theme.overlay0} />
            : <ChevronUp size={14} color={theme.overlay0} />}
        </div>
      </div>

      {/* Collapsible content */}
      <div style={{
        maxHeight: collapsed ? 0 : 420,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}>
        {/* Filter bar */}
        <div style={{
          display: 'flex', gap: 6, padding: '6px 12px',
          borderBottom: `1px solid ${theme.surface0}33`,
        }}>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 10, background: theme.surface0, color: theme.text,
              border: `1px solid ${theme.surface1}`, borderRadius: 3, padding: '2px 4px', cursor: 'pointer',
            }}
          >
            {['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
            {([['HIGH', 'H', theme.red], ['MEDIUM', 'M', theme.peach], ['LOW', 'L', theme.yellow]] as const).map(([level, label, color]) => {
              const active = impactFilter.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => handleToggleImpact(level)}
                  style={{
                    background: active ? color + '22' : 'transparent',
                    border: active ? `1px solid ${color}` : `1px solid ${theme.surface1}`,
                    color: active ? color : theme.overlay0,
                    fontSize: 9, padding: '1px 5px', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: active ? 700 : 400, borderRadius: 2,
                  }}
                >{label}</button>
              );
            })}
          </div>
        </div>

        {/* Weekday grouped events */}
        <div style={{ overflowY: 'auto', maxHeight: 360 }}>
          {weekDays.map((day, di) => {
            const dayEntries = filtered
              .filter(e => isSameDay(new Date(e.time), day))
              .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            const isToday = isSameDay(day, today);

            return (
              <div key={day.toISOString()}>
                {/* Day header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  background: isToday ? theme.blue + '15' : theme.surface0 + '44',
                  borderBottom: `1px solid ${theme.surface0}33`,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isToday ? theme.blue : theme.subtext0,
                    letterSpacing: '1px', width: 32,
                  }}>
                    {dayNames[di]}
                  </span>
                  <span style={{ fontSize: 10, color: isToday ? theme.blue : theme.overlay0 }}>
                    {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {isToday && (
                    <span style={{
                      fontSize: 8, color: theme.blue, letterSpacing: '1px',
                      fontWeight: 700, marginLeft: 'auto',
                    }}>TODAY</span>
                  )}
                  {!isToday && dayEntries.length > 0 && (
                    <span style={{ fontSize: 9, color: theme.overlay0, marginLeft: 'auto' }}>
                      {dayEntries.length}
                    </span>
                  )}
                </div>

                {/* Events for this day */}
                {dayEntries.length === 0 ? (
                  <div style={{
                    padding: '4px 12px 4px 54px',
                    fontSize: 10, color: theme.overlay0, fontStyle: 'italic',
                    borderBottom: `1px solid ${theme.surface0}22`,
                  }}>
                    No events
                  </div>
                ) : (
                  dayEntries.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px',
                        borderBottom: `1px solid ${theme.surface0}22`,
                      }}
                    >
                      <span style={{
                        fontSize: 10, color: theme.subtext0, width: 42,
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      }}>
                        {formatTime(entry.time)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, width: 30,
                        color: entry.currency === 'USD' ? theme.blue : theme.text, flexShrink: 0,
                      }}>
                        {entry.currency}
                      </span>
                      <FolderOpen size={10} color={impactColor(entry.impact)} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, color: theme.text, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.event}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
