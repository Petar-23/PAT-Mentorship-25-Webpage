'use client';

import type { GeoEvent, ThemeColors } from '../types';
import { SEVERITY_LABELS, CATEGORY_ICONS } from '../types';
import { severityColors } from '../styles/themes';

interface Props {
  event: GeoEvent;
  isSelected: boolean;
  onClick: () => void;
  theme: ThemeColors;
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EventCard({ event, isSelected, onClick, theme }: Props) {
  const colors = severityColors(theme);
  const sevColor = colors[event.severity];
  const age = getTimeAgo(event.timestamp);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderLeft: `3px solid ${sevColor}`,
        background: isSelected ? theme.surface0 : 'transparent',
        cursor: 'pointer',
        borderBottom: `1px solid ${theme.surface0}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = theme.surface0 + '88';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: sevColor, fontWeight: 700, letterSpacing: '1px' }}>
          {SEVERITY_LABELS[event.severity]}
        </span>
        <span style={{ fontSize: 10, color: theme.overlay0 }}>{age}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 4, lineHeight: 1.4 }}>
        {CATEGORY_ICONS[event.category]} {event.title}
      </div>
      {isSelected && (
        <div style={{ fontSize: 11, color: theme.subtext0, marginBottom: 6, lineHeight: 1.5 }}>
          {event.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: theme.overlay0 }}>
        <span>📍 {event.country}</span>
        <span>via {event.source}</span>
      </div>
    </div>
  );
}
