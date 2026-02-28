'use client';

import type { GeoEvent, ThemeColors } from '../types';
import { SEVERITY_LABELS } from '../types';
import { severityColors } from '../styles/themes';

interface Props {
  events: GeoEvent[];
  theme: ThemeColors;
}

export function Ticker({ events, theme }: Props) {
  const colors = severityColors(theme);
  const sorted = [...events].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Double the events for seamless loop
  const items = [...sorted, ...sorted];

  return (
    <div style={{
      height: 30,
      background: theme.crust,
      borderTop: `1px solid ${theme.surface0}`,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Label */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 76,
        background: theme.crust,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 10,
        zIndex: 2,
        borderRight: `1px solid ${theme.surface0}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.peach, letterSpacing: '1px' }}>
          ▶ FEED
        </span>
      </div>

      {/* Scrolling Ticker */}
      <div style={{
        marginLeft: 76,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        animation: 'wwTicker 120s linear infinite',
        fontSize: 11,
      }}>
        {items.map((e, i) => (
          <span key={`${e.id}-${i}`}>
            <span style={{ color: colors[e.severity], fontWeight: 600 }}>
              {SEVERITY_LABELS[e.severity]}
            </span>
            {' '}
            <span style={{ color: theme.text }}>{e.title}</span>
            <span style={{ color: theme.overlay0 }}> — {e.country}</span>
            <span style={{ color: theme.surface1, margin: '0 16px' }}>///</span>
          </span>
        ))}
      </div>
    </div>
  );
}
