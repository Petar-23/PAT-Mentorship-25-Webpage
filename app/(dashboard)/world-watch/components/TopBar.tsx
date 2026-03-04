'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Theme, ThemeColors } from '../types';
import type { Dispatch, SetStateAction } from 'react';

interface Props {
  theme: ThemeColors;
  currentTheme: Theme;
  setCurrentTheme: Dispatch<SetStateAction<Theme>>;
}

export function TopBar({ theme, currentTheme, setCurrentTheme }: Props) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const cetTime = time?.toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }) ?? '--:--:--';

  const cetDate = time?.toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  }) ?? '';

  // Brief update countdown (every 30 min aligned to :00/:30)
  const nextUpdateCountdown = (() => {
    if (!time) return '--:--';
    const min = time.getMinutes();
    const sec = time.getSeconds();
    const minsLeft = (min < 30 ? 30 : 60) - min - 1;
    const secsLeft = 59 - sec;
    return `${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')}`;
  })();

  return (
    <div style={{
      height: 48,
      background: theme.crust,
      borderBottom: `1px solid ${theme.surface0}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      flexShrink: 0,
      zIndex: 100,
      gap: 12,
    }}>
      {/* Left: Back + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/mentorship" style={{
          color: theme.text,
          textDecoration: 'none',
          fontSize: 12,
          fontWeight: 600,
          border: `1px solid ${theme.surface1}`,
          background: theme.surface0,
          padding: '5px 12px',
          letterSpacing: '0.5px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.blue;
            (e.currentTarget as HTMLAnchorElement).style.color = theme.blue;
            (e.currentTarget as HTMLAnchorElement).style.background = theme.surface1;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.surface1;
            (e.currentTarget as HTMLAnchorElement).style.color = theme.text;
            (e.currentTarget as HTMLAnchorElement).style.background = theme.surface0;
          }}
        >
          ← MENTORSHIP
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: theme.text, letterSpacing: '6px' }}>
            OPTICON
          </span>
          <span style={{
            fontSize: 9,
            color: '#fff',
            background: '#FF3B00',
            padding: '3px 8px',
            letterSpacing: '1px',
            fontWeight: 700,
            marginLeft: 4,
          }}>
            by PRICE ACTION TRADER
          </span>
          {/* old PAT badge removed — replaced by "by PRICE ACTION TRADER" orange box */}
        </div>
      </div>

      {/* Right: Theme + Live + Clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* LIVE indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: theme.green,
            display: 'inline-block',
            animation: 'wwBlink 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 10, color: theme.green, fontWeight: 700, letterSpacing: '1.5px' }}>LIVE</span>
        </div>

        {/* Clock + Next Update Countdown */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Next brief update countdown */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.blue, fontVariantNumeric: 'tabular-nums', fontFamily: "monospace", letterSpacing: '0.5px' }}>
              {nextUpdateCountdown.split('').map((ch, i) => (
                <span key={i} style={{ display: 'inline-block', width: ch === ':' ? '0.4em' : '0.6em', textAlign: 'center' }}>{ch}</span>
              ))}
            </div>
            <div style={{ fontSize: 8, color: theme.overlay0, letterSpacing: '0.5px' }}>
              NEXT UPDATE
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: theme.surface1 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: "monospace", letterSpacing: '0.5px' }}>
              {cetTime.split('').map((ch, i) => (
                <span key={i} style={{ display: 'inline-block', width: ch === ':' ? '0.4em' : '0.6em', textAlign: 'center' }}>{ch}</span>
              ))}{' '}
              <span style={{ fontSize: 9, color: theme.overlay0 }}>CET</span>
            </div>
            <div style={{ fontSize: 9, color: theme.subtext0 }}>{cetDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
