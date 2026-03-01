'use client';

import { useState } from 'react';
import type { GeoEvent, ThemeColors } from '../types';
import { EventCard } from './EventCard';
import { severityColors } from '../styles/themes';

interface Props {
  events: GeoEvent[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  theme: ThemeColors;
}

type SeverityFilter = null | 1 | 2 | 3 | 4;

interface FilterBadgeProps {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
  theme: ThemeColors;
}

function FilterBadge({ label, count, color, active, onClick, theme }: FilterBadgeProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color + '22' : theme.surface0,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        border: active ? `2px solid ${color}` : `1px solid transparent`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderRadius: 3,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = color + '66';
          e.currentTarget.style.background = color + '11';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.background = theme.surface0;
        }
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 11, color: active ? color : theme.overlay0, letterSpacing: '1px', fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}

export function Sidebar({ events, selectedId, onSelect, theme }: Props) {
  const [filter, setFilter] = useState<SeverityFilter>(null);
  const colors = severityColors(theme);

  const filtered = filter
    ? events.filter(e => e.severity === filter)
    : events;

  const sorted = [...filtered].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const critCount = events.filter(e => e.severity === 4).length;
  const highCount = events.filter(e => e.severity === 3).length;
  const medCount = events.filter(e => e.severity === 2).length;
  const lowCount = events.filter(e => e.severity === 1).length;

  const toggleFilter = (sev: SeverityFilter) => {
    setFilter(prev => prev === sev ? null : sev);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: theme.mantle,
      borderLeft: `1px solid ${theme.surface0}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.surface0}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: theme.subtext0,
          letterSpacing: '2px', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>EVENT FEED</span>
          {filter !== null && (
            <button
              onClick={() => setFilter(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: theme.overlay0, letterSpacing: '0.5px',
              }}
            >
              CLEAR FILTER
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterBadge
            label="CRITICAL" count={critCount} color={colors[4]}
            active={filter === 4} onClick={() => toggleFilter(4)} theme={theme}
          />
          <FilterBadge
            label="HIGH" count={highCount} color={colors[3]}
            active={filter === 3} onClick={() => toggleFilter(3)} theme={theme}
          />
          <FilterBadge
            label="MEDIUM" count={medCount} color={colors[2]}
            active={filter === 2} onClick={() => toggleFilter(2)} theme={theme}
          />
          <FilterBadge
            label="LOW" count={lowCount} color={colors[1]}
            active={filter === 1} onClick={() => toggleFilter(1)} theme={theme}
          />
        </div>
      </div>

      {/* Event List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: theme.overlay0 }}>
            No events matching filter
          </div>
        ) : (
          sorted.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              isSelected={selectedId === ev.id}
              onClick={() => onSelect(ev)}
              theme={theme}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 14px',
        borderTop: `1px solid ${theme.surface0}`,
        fontSize: 11,
        color: theme.overlay0,
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Reuters · Bloomberg · AP · WHO · USGS</span>
        <span>{sorted.length} / {events.length}</span>
      </div>
    </div>
  );
}
