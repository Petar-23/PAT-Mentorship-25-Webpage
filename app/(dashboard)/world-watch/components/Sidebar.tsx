'use client';

import type { GeoEvent, ThemeColors } from '../types';
import { EventCard } from './EventCard';

interface Props {
  events: GeoEvent[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  theme: ThemeColors;
}

interface StatBadgeProps {
  label: string;
  count: number;
  color: string;
  theme: ThemeColors;
}

function StatBadge({ label, count, color, theme }: StatBadgeProps) {
  return (
    <div style={{
      background: theme.surface0,
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 11, color: theme.overlay0, letterSpacing: '1px' }}>{label}</span>
    </div>
  );
}

export function Sidebar({ events, selectedId, onSelect, theme }: Props) {
  const sorted = [...events].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const critCount = events.filter(e => e.severity === 4).length;
  const highCount = events.filter(e => e.severity === 3).length;

  return (
    <div style={{
      width: 360,
      background: theme.mantle,
      borderLeft: `1px solid ${theme.surface0}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.surface0}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.subtext0, letterSpacing: '2px', marginBottom: 8 }}>
          EVENT FEED
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBadge label="CRITICAL" count={critCount} color={theme.red} theme={theme} />
          <StatBadge label="HIGH" count={highCount} color={theme.peach} theme={theme} />
          <StatBadge label="TOTAL" count={events.length} color={theme.blue} theme={theme} />
        </div>
      </div>

      {/* Event List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map(ev => (
          <EventCard
            key={ev.id}
            event={ev}
            isSelected={selectedId === ev.id}
            onClick={() => onSelect(ev)}
            theme={theme}
          />
        ))}
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
        <span>15min refresh</span>
      </div>
    </div>
  );
}
