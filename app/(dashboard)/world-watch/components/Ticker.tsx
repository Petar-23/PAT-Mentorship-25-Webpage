'use client';

import type { GeoEvent, NewsItem, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';

interface Props {
  events: GeoEvent[];
  theme: ThemeColors;
  newsItems?: NewsItem[];
}

export function Ticker({ events, theme, newsItems = [] }: Props) {
  const colors = severityColors(theme);

  // Ticker = RSS news only, sorted newest first. No natural disasters/events.
  const newsHeadlines = [...newsItems]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30);

  type TickerItem = { kind: 'news'; n: NewsItem };
  const combined: TickerItem[] = newsHeadlines.map(n => ({ kind: 'news' as const, n }));

  // Double for seamless loop
  const items = [...combined, ...combined];

  // Duration scales with content: ~8s per event, minimum 60s
  const duration = Math.max(60, combined.length * 8);

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
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.peach, letterSpacing: '1px' }}>
          ▶ FEED
        </span>
      </div>

      {/* Scrolling Ticker */}
      <div style={{
        marginLeft: 76,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        animation: `wwTicker ${duration}s linear infinite`,
        fontSize: 12,
      }}>
        {items.map((item, i) => (
          <span key={`news-${item.n.id}-${i}`}>
            <span style={{ color: theme.blue, fontWeight: 600 }}>INTEL</span>
            {' '}
            <span style={{ color: theme.subtext0, fontSize: 10 }}>[{item.n.source.slice(0, 18)}]</span>
            {' '}
            <span style={{ color: theme.text }}>{item.n.title}</span>
            {item.n.country && <span style={{ color: theme.overlay0 }}> — {item.n.country}</span>}
            <span style={{ color: theme.surface1, margin: '0 16px' }}>///</span>
          </span>
        ))}
      </div>
    </div>
  );
}
