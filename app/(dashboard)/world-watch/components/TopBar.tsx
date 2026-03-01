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

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'gotham', label: 'Gotham' },
    { value: 'mocha', label: 'Catppuccin Mocha' },
    { value: 'latte', label: 'Catppuccin Latte' },
    { value: 'bloomberg', label: 'Bloomberg Green' },
  ];

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
          color: theme.overlay0,
          textDecoration: 'none',
          fontSize: 11,
          border: `1px solid ${theme.surface1}`,
          padding: '3px 8px',
          fontFamily: 'inherit',
          letterSpacing: '0.5px',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.blue;
            (e.currentTarget as HTMLAnchorElement).style.color = theme.blue;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.surface1;
            (e.currentTarget as HTMLAnchorElement).style.color = theme.overlay0;
          }}
        >
          ← MENTORSHIP
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: theme.text, letterSpacing: '6px' }}>
            WORLD WATCH
          </span>
          <span style={{
            fontSize: 9,
            color: theme.crust,
            background: theme.peach,
            padding: '2px 5px',
            fontWeight: 700,
            letterSpacing: '1px',
          }}>PAT</span>
        </div>
      </div>

      {/* Right: Theme + Live + Clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Theme Switcher */}
        <select
          value={currentTheme}
          onChange={e => setCurrentTheme(e.target.value as Theme)}
          style={{
            background: theme.surface0,
            color: theme.subtext0,
            border: `1px solid ${theme.surface1}`,
            fontSize: 10,
            padding: '3px 6px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            letterSpacing: '0.5px',
          }}
        >
          {themeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

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

        {/* Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
            {cetTime}{' '}
            <span style={{ fontSize: 9, color: theme.overlay0 }}>CET</span>
          </div>
          <div style={{ fontSize: 9, color: theme.subtext0 }}>{cetDate}</div>
        </div>
      </div>
    </div>
  );
}
