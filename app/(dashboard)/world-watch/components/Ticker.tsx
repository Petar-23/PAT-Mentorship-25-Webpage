'use client';

import type { GeoEvent, NewsItem, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';

interface AIBriefEvent {
  headline: string;
  type: string;
  severity: 1 | 2 | 3 | 4;
  verified: boolean;
  sources: string[];
  corroboration: number;
  targetLocation?: { name: string } | null;
  conflictId?: string | null;
}

interface AIBrief {
  riskLevel: string;
  verifiedEvents?: AIBriefEvent[];
}

interface Props {
  events: GeoEvent[];
  theme: ThemeColors;
  newsItems?: NewsItem[];
  aiBrief?: AIBrief | null;
}

export function Ticker({ events, theme, newsItems = [], aiBrief }: Props) {
  const colors = severityColors(theme);

  // AI Brief verified events (highest severity first)
  const intelItems = (aiBrief?.verifiedEvents || [])
    .filter(e => e.verified)
    .sort((a, b) => b.severity - a.severity);

  // RSS news, sorted newest first
  const newsHeadlines = [...newsItems]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30);

  type TickerItem = { kind: 'news'; n: NewsItem } | { kind: 'intel'; e: AIBriefEvent };
  const combined: TickerItem[] = [
    ...intelItems.map(e => ({ kind: 'intel' as const, e })),
    ...newsHeadlines.map(n => ({ kind: 'news' as const, n })),
  ];

  // Double for seamless loop
  const items = [...combined, ...combined];

  // Duration scales with content: ~8s per event, minimum 60s
  const duration = Math.max(60, combined.length * 8);

  return (
    <div style={{
      height: 36,
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
        fontSize: 14,
      }}>
        {items.map((item, i) =>
          item.kind === 'intel' ? (
            <span key={`intel-${i}`}>
              <span style={{
                color: colors[item.e.severity],
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.5px',
              }}>
                {item.e.severity === 4 ? '🔴 CRITICAL' : item.e.severity === 3 ? '🟠 HIGH' : item.e.severity === 2 ? '🟡 MEDIUM' : '⚪ LOW'}
              </span>
              {' '}
              <span style={{ color: theme.text, fontWeight: 500 }}>{item.e.headline}</span>
              {item.e.targetLocation?.name && <span style={{ color: theme.overlay0 }}> — 📍 {item.e.targetLocation.name}</span>}
              <span style={{ color: theme.surface1, margin: '0 16px' }}>///</span>
            </span>
          ) : (
            <span key={`news-${item.n.id}-${i}`}>
              <span style={{ color: theme.blue, fontWeight: 600, fontSize: 12 }}>INTEL</span>
              {' '}
              <span style={{ color: theme.subtext0, fontSize: 12 }}>[{item.n.source.slice(0, 18)}]</span>
              {' '}
              <span style={{ color: theme.text }}>{item.n.title}</span>
              {item.n.country && <span style={{ color: theme.overlay0 }}> — {item.n.country}</span>}
              <span style={{ color: theme.surface1, margin: '0 16px' }}>///</span>
            </span>
          )
        )}
      </div>
    </div>
  );
}
