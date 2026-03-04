'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ThemeColors, GeoEvent } from '../types';

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
  riskLevel?: string;
  verifiedEvents?: AIBriefEvent[];
  conflictHeat?: Record<string, number>;
  generatedAt?: string;
}

interface Toast {
  id: string;
  event: AIBriefEvent;
  createdAt: number;
}

interface Props {
  aiBrief: AIBrief | null | undefined;
  theme: ThemeColors;
  onEventFocus?: (event: GeoEvent) => void;
}

function timeAgo(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH}h ago`;
}

export function ToastSystem({ aiBrief, theme, onEventFocus }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenKeys = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  useEffect(() => {
    if (!aiBrief?.verifiedEvents) return;

    const highSev = aiBrief.verifiedEvents.filter(e => e.severity >= 3 && e.verified);

    for (const ev of highSev) {
      const key = `${ev.headline}::${ev.conflictId ?? ''}`;
      if (seenKeys.current.has(key)) continue;
      seenKeys.current.add(key);

      const id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      const toast: Toast = { id, event: ev, createdAt: Date.now() };

      setToasts(prev => {
        const next = [...prev, toast];
        if (next.length > 3) {
          const oldest = next.splice(0, 1)[0];
          const ot = timers.current.get(oldest.id);
          if (ot) { clearTimeout(ot); timers.current.delete(oldest.id); }
        }
        return next;
      });

      const timer = setTimeout(() => dismiss(id), 8000);
      timers.current.set(id, timer);
    }
  }, [aiBrief, dismiss]);

  // Cleanup on unmount
  useEffect(() => () => {
    timers.current.forEach(t => clearTimeout(t));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 80,
        right: 376,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => {
          const isCrit = toast.event.severity === 4;
          const borderColor = isCrit ? '#f38ba8' : '#fab387';
          const prefix = isCrit ? '🔴 FLASH TRAFFIC' : '⚠️ PRIORITY INTEL';

          return (
            <div
              key={toast.id}
              style={{
                background: '#181825',
                borderTop: `1px solid ${theme.surface0}`,
                borderRight: `1px solid ${theme.surface0}`,
                borderBottom: `1px solid ${theme.surface0}`,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '0 4px 4px 0',
                padding: '10px 14px',
                width: 300,
                cursor: onEventFocus && toast.event.targetLocation ? 'pointer' : 'default',
                pointerEvents: 'all',
                boxShadow: `0 4px 20px rgba(0,0,0,0.65), 0 0 0 1px ${borderColor}22`,
                animation: 'toastSlideIn 0.25s ease-out',
              }}
              onClick={() => {
                if (onEventFocus && toast.event.targetLocation) {
                  onEventFocus({
                    id: `focus-${toast.id}`,
                    title: toast.event.headline,
                    description: toast.event.headline,
                    lat: toast.event.targetLocation.lat,
                    lng: toast.event.targetLocation.lng,
                    severity: toast.event.severity,
                    category: toast.event.type === 'strike' ? 'conflict' : toast.event.type as GeoEvent['category'],
                    source: 'AI Brief',
                    timestamp: new Date(toast.createdAt).toISOString(),
                    country: toast.event.targetLocation.name,
                  });
                }
                dismiss(toast.id);
              }}
            >
              {/* Header row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 5,
              }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: borderColor,
                  letterSpacing: '1.5px',
                  fontFamily: 'inherit',
                }}>
                  {prefix}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); dismiss(toast.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.overlay0,
                    fontSize: 15,
                    lineHeight: 1,
                    padding: '0 2px',
                    fontFamily: 'inherit',
                  }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* Headline */}
              <div style={{
                fontSize: 11,
                color: '#cdd6f4',
                lineHeight: '1.4',
                marginBottom: 6,
              }}>
                {toast.event.headline}
              </div>

              {/* Meta row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 9,
                color: theme.overlay0,
                flexWrap: 'wrap',
              }}>
                {toast.event.conflictId && (
                  <span style={{
                    padding: '1px 5px',
                    background: `${borderColor}22`,
                    border: `1px solid ${borderColor}44`,
                    borderRadius: 3,
                    color: borderColor,
                    fontWeight: 600,
                  }}>
                    ⚔ {toast.event.conflictId.toUpperCase()}
                  </span>
                )}
                {toast.event.targetLocation && (
                  <span>📍 {toast.event.targetLocation.name}</span>
                )}
                <span style={{ marginLeft: 'auto' }}>{timeAgo(toast.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
