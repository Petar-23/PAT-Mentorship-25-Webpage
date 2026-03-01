'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, FolderOpen, Calendar } from 'lucide-react';
import type { ThemeColors } from '../types';
import { mockCalendar } from '../data/mockCalendar';

interface Props {
  theme: ThemeColors;
}

export function MiniCalendar({ theme }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [currency, setCurrency] = useState('ALL');
  const [impact, setImpact] = useState('ALL');

  const now = new Date();
  const upcoming = mockCalendar
    .filter(e => {
      if (new Date(e.time) <= now) return false;
      if (currency !== 'ALL' && e.currency !== currency) return false;
      if (impact !== 'ALL' && String(e.impact) !== impact) return false;
      return true;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(0, 10);

  const impactColor = (imp: 1 | 2 | 3) => {
    if (imp === 3) return theme.red;
    if (imp === 2) return theme.peach;
    return theme.yellow;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });
  };

  const currencies = ['ALL', ...Array.from(new Set(mockCalendar.map(e => e.currency)))];

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
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: theme.text }}>
            ECON CALENDAR
          </span>
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            background: theme.blue + '33',
            color: theme.blue,
            borderRadius: 3,
          }}>
            USA
          </span>
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
        maxHeight: collapsed ? 0 : 320,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}>
        {/* Filter bar */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '6px 12px',
          borderBottom: `1px solid ${theme.surface0}33`,
        }}>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 10,
              background: theme.surface0,
              color: theme.text,
              border: `1px solid ${theme.surface1}`,
              borderRadius: 3,
              padding: '2px 4px',
              cursor: 'pointer',
            }}
          >
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={impact}
            onChange={e => setImpact(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 10,
              background: theme.surface0,
              color: theme.text,
              border: `1px solid ${theme.surface1}`,
              borderRadius: 3,
              padding: '2px 4px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">ALL IMPACT</option>
            <option value="3">HIGH</option>
            <option value="2">MED</option>
            <option value="1">LOW</option>
          </select>
        </div>

        {/* Event rows */}
        <div style={{ overflowY: 'auto', maxHeight: 260 }}>
          {upcoming.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: theme.overlay0 }}>No upcoming events</div>
          ) : upcoming.map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderBottom: `1px solid ${theme.surface0}33`,
              }}
            >
              <span style={{ fontSize: 12, color: theme.subtext0, width: 50, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatTime(entry.time)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, width: 36, color: theme.text, flexShrink: 0 }}>
                {entry.currency}
              </span>
              <FolderOpen size={14} color={impactColor(entry.impact)} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: theme.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.event}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
