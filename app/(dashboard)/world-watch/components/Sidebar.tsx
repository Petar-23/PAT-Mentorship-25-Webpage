'use client';

import type { GeoEvent, NewsItem, ThemeColors } from '../types';
import { EventCard } from './EventCard';
import { severityColors } from '../styles/themes';
import { ACTIVE_CONFLICTS } from '../data/conflicts';

interface AIBriefEvent {
  headline: string;
  conflictId: string | null;
  type: string;
  targetLocation: { name: string; lat: number; lng: number } | null;
  corroboration: number;
  sources: string[];
  verified: boolean;
  severity: 1 | 2 | 3 | 4;
}

interface AIBrief {
  riskLevel: string;
  verifiedEvents?: AIBriefEvent[];
  conflictHeat?: Record<string, number>;
}

interface Props {
  events: GeoEvent[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  theme: ThemeColors;
  severityFilter: Set<number>;
  onToggleSeverity: (sev: number) => void;
  newsItems?: NewsItem[];
  onNewsSelect?: (news: NewsItem) => void;
  aiBrief?: AIBrief | null;
}

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

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

type FeedItem =
  | { type: 'event'; event: GeoEvent }
  | { type: 'news'; news: NewsItem }
  | { type: 'intel'; intel: AIBriefEvent };

export function Sidebar({ events, selectedId, onSelect, theme, severityFilter, onToggleSeverity, newsItems = [], onNewsSelect, aiBrief }: Props) {
  const colors = severityColors(theme);

  const hasFilter = severityFilter.size > 0;
  const filtered = hasFilter
    ? events.filter(e => severityFilter.has(e.severity))
    : events;

  // AI Brief verified events (sorted by severity, highest first, respects filter)
  const allIntelItems = (aiBrief?.verifiedEvents || []).filter(e => e.verified);
  const filteredIntel = hasFilter
    ? allIntelItems.filter(e => severityFilter.has(e.severity))
    : allIntelItems;
  const intelItems: FeedItem[] = filteredIntel
    .map(e => ({ type: 'intel' as const, intel: e }));

  // Build unified feed: intel events first (by severity), then news
  const feed: FeedItem[] = [
    ...intelItems,
    ...filtered.map(e => ({ type: 'event' as const, event: e })),
    ...newsItems.map(n => ({ type: 'news' as const, news: n })),
  ].sort((a, b) => {
    // Intel items sort by severity (highest first)
    const sevA = a.type === 'intel' ? a.intel.severity : a.type === 'event' ? a.event.severity : 0;
    const sevB = b.type === 'intel' ? b.intel.severity : b.type === 'event' ? b.event.severity : 0;
    if (a.type === 'intel' && b.type !== 'intel') return -1;
    if (b.type === 'intel' && a.type !== 'intel') return 1;
    if (a.type === 'intel' && b.type === 'intel') return sevB - sevA;
    const timeA = a.type === 'event'
      ? new Date(a.event.timestamp || 0).getTime()
      : new Date((a as any).news?.pubDate || 0).getTime();
    const timeB = b.type === 'event'
      ? new Date(b.event.timestamp || 0).getTime()
      : new Date((b as any).news?.pubDate || 0).getTime();
    if (Math.abs(timeB - timeA) < 60000 && a.type === 'event' && b.type === 'event') {
      return b.event.severity - a.event.severity;
    }
    return timeB - timeA;
  });

  const verifiedIntel = (aiBrief?.verifiedEvents || []).filter(e => e.verified);
  const critCount = events.filter(e => e.severity === 4).length + verifiedIntel.filter(e => e.severity === 4).length;
  const highCount = events.filter(e => e.severity === 3).length + verifiedIntel.filter(e => e.severity === 3).length;
  const medCount = events.filter(e => e.severity === 2).length + verifiedIntel.filter(e => e.severity === 2).length;
  const lowCount = events.filter(e => e.severity === 1).length + verifiedIntel.filter(e => e.severity === 1).length;

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
          <span>
            HOTWIRE
            {newsItems.length > 0 && (
              <span style={{ fontSize: 10, color: theme.blue, marginLeft: 8, letterSpacing: '1px', fontWeight: 500 }}>
                · {newsItems.length} INTEL
              </span>
            )}
          </span>
          {hasFilter && (
            <button
              onClick={() => {
                severityFilter.forEach(s => onToggleSeverity(s));
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: theme.overlay0, letterSpacing: '0.5px',
                fontFamily: 'inherit',
              }}
            >
              CLEAR
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterBadge
            label="CRITICAL" count={critCount} color={colors[4]}
            active={severityFilter.has(4)} onClick={() => onToggleSeverity(4)} theme={theme}
          />
          <FilterBadge
            label="HIGH" count={highCount} color={colors[3]}
            active={severityFilter.has(3)} onClick={() => onToggleSeverity(3)} theme={theme}
          />
          <FilterBadge
            label="MEDIUM" count={medCount} color={colors[2]}
            active={severityFilter.has(2)} onClick={() => onToggleSeverity(2)} theme={theme}
          />
          <FilterBadge
            label="LOW" count={lowCount} color={colors[1]}
            active={severityFilter.has(1)} onClick={() => onToggleSeverity(1)} theme={theme}
          />
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {feed.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: theme.overlay0 }}>
            No events matching filter
          </div>
        ) : (
          feed.map((item, idx) =>
            item.type === 'intel' ? (() => {
              const sev = item.intel.severity;
              const sevLabel = sev === 4 ? 'CRITICAL' : sev === 3 ? 'HIGH' : sev === 2 ? 'MEDIUM' : 'LOW';
              const sevColor = colors[sev];
              const typeIcon = item.intel.type === 'strike' ? '🎯' : item.intel.type === 'deployment' ? '🛡️' : item.intel.type === 'diplomatic' ? '🏛️' : item.intel.type === 'protest' ? '✊' : item.intel.type === 'humanitarian' ? '🏥' : '📡';
              const conflict = ACTIVE_CONFLICTS.find(c => c.id === item.intel.conflictId);
              return (
                <div
                  key={`intel-${idx}`}
                  onClick={() => {
                    // Create a synthetic GeoEvent to trigger flyTo on the globe
                    if (item.intel.targetLocation) {
                      onSelect({
                        id: `intel-${idx}`,
                        title: item.intel.headline,
                        description: item.intel.headline,
                        lat: item.intel.targetLocation.lat,
                        lng: item.intel.targetLocation.lng,
                        severity: item.intel.severity,
                        category: (item.intel.type === 'strike' ? 'conflict' : item.intel.type) as 'conflict' | 'economic' | 'natural-disaster' | 'political' | 'health',
                        source: 'AI Brief',
                        timestamp: new Date().toISOString(),
                        country: item.intel.targetLocation.name,
                      });
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    borderLeft: `3px solid ${sevColor}`,
                    background: `${sevColor}11`,
                    borderRadius: '0 4px 4px 0',
                    marginBottom: '2px',
                    cursor: item.intel.targetLocation ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (item.intel.targetLocation) (e.currentTarget as HTMLDivElement).style.background = `${sevColor}22`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = `${sevColor}11`; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10 }}>{typeIcon}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 5px',
                      background: `${sevColor}22`,
                      border: `1px solid ${sevColor}44`,
                      borderRadius: 3, color: sevColor,
                      fontWeight: 700, letterSpacing: '1px',
                    }}>
                      {sevLabel}
                    </span>
                    <span style={{
                      fontSize: 9, padding: '1px 5px',
                      background: `${theme.surface0}`,
                      borderRadius: 3, color: theme.subtext0,
                      fontWeight: 500, textTransform: 'uppercase',
                    }}>
                      {item.intel.type}
                    </span>
                    {conflict && (
                      <span style={{
                        fontSize: 9, padding: '1px 5px',
                        background: `${conflict.color}22`,
                        border: `1px solid ${conflict.color}33`,
                        borderRadius: 3, color: conflict.color,
                        fontWeight: 600,
                      }}>
                        ⚔ {conflict.shortName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: theme.text, lineHeight: '1.3', marginBottom: 3 }}>
                    {item.intel.headline}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: theme.overlay0 }}>
                    {item.intel.targetLocation && <span>📍 {item.intel.targetLocation.name}</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      ✓ {item.intel.corroboration}/5 · {item.intel.sources.slice(0, 3).join(', ')}
                    </span>
                  </div>
                </div>
              );
            })() : item.type === 'news' ? (
              <div
                key={item.news.id}
                onClick={() => {
                  if (onNewsSelect) {
                    onNewsSelect(item.news);
                  } else {
                    window.open(item.news.link, '_blank');
                  }
                }}
                style={{
                  padding: '8px 12px',
                  borderLeft: `3px solid ${theme.blue}`,
                  background: `${theme.surface0}44`,
                  borderRadius: '0 4px 4px 0',
                  marginBottom: '2px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `${theme.blue}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = `${theme.surface0}44`; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10 }}>📰</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px',
                    background: `${theme.blue}22`,
                    border: `1px solid ${theme.blue}33`,
                    borderRadius: 3, color: theme.blue,
                    fontWeight: 600, letterSpacing: '0.5px',
                    maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {item.news.source.slice(0, 24)}
                  </span>
                  {item.news.corroboration !== undefined && (
                    <span style={{
                      fontSize: 8, padding: '1px 6px',
                      borderRadius: 10,
                      fontWeight: 700, letterSpacing: '0.5px',
                      flexShrink: 0,
                      color: item.news.corroboration >= 2 ? '#22c55e' : '#f9e2af',
                      border: `1px solid ${item.news.corroboration >= 2 ? '#22c55e44' : '#f9e2af44'}`,
                      background: item.news.corroboration >= 2 ? '#22c55e11' : '#f9e2af11',
                    }}>
                      {item.news.corroboration >= 2 ? '✓ VERIFIED' : '? UNVERIFIED'}
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: theme.overlay0, marginLeft: 'auto', flexShrink: 0, fontFamily: 'inherit' }}>
                    {formatTimeAgo(item.news.pubDate)}
                  </span>
                </div>
                {item.news.conflictId && (() => {
                  const conflict = ACTIVE_CONFLICTS.find(c => c.id === item.news.conflictId);
                  return conflict ? (
                    <span style={{
                      display: 'inline-block',
                      fontSize: 9,
                      padding: '1px 5px',
                      background: `${conflict.color}22`,
                      border: `1px solid ${conflict.color}33`,
                      borderRadius: 3,
                      color: conflict.color,
                      fontWeight: 600,
                      marginBottom: 3,
                    }}>
                      ⚔ {conflict.shortName}
                    </span>
                  ) : null;
                })()}
                <div style={{ fontSize: 11, color: theme.text, lineHeight: '1.3' }}>
                  {item.news.title}
                </div>
                {item.news.country && (
                  <div style={{ fontSize: 9, color: theme.overlay0, marginTop: 2 }}>
                    📍 {item.news.country} · {item.news.category}
                  </div>
                )}
              </div>
            ) : (
              <EventCard
                key={item.event.id}
                event={item.event}
                isSelected={selectedId === item.event.id}
                onClick={() => onSelect(item.event)}
                theme={theme}
              />
            )
          )
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
        <span>Reuters · BBC · Defense One · Crisis Group</span>
        <span>{filtered.length} events · {intelItems.length} verified · {newsItems.length} intel</span>
      </div>
    </div>
  );
}
