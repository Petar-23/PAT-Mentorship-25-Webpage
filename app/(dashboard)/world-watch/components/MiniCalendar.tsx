'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, FolderOpen } from 'lucide-react';
import type { ThemeColors } from '../types';
import { mockCalendar } from '../data/mockCalendar';

interface Props {
  theme: ThemeColors;
}

export function MiniCalendar({ theme }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const now = new Date();
  const upcoming = mockCalendar
    .filter(e => new Date(e.time) > now)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(0, 8);

  const impactColor = (impact: 1 | 2 | 3) => {
    if (impact === 3) return theme.red;
    if (impact === 2) return theme.yellow;
    return theme.green;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  };

  return (
    <div style={{ borderBottom: `1px solid ${theme.surface0}` }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'pointer',
          background: theme.surface0 + '44',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: theme.blue, textTransform: 'uppercase' }}>
          Econ Calendar
        </span>
        {collapsed
          ? <ChevronDown size={14} color={theme.overlay0} />
          : <ChevronUp size={14} color={theme.overlay0} />}
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {upcoming.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: 11, color: theme.overlay0 }}>No upcoming events</div>
          ) : upcoming.map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                height: 28,
                borderBottom: `1px solid ${theme.surface0}22`,
              }}
            >
              <span style={{ fontSize: 11, color: theme.overlay0, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(entry.time)}
              </span>
              <span style={{ fontSize: 11, color: theme.overlay0, minWidth: 28, fontWeight: 600 }}>
                {entry.currency}
              </span>
              <FolderOpen size={12} color={impactColor(entry.impact)} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {entry.event}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
