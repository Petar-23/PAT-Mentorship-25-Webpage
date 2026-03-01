'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import type { GeoEvent, DataLayer, Theme } from './types';
import { mockEvents } from './data/mockEvents';
import { defaultLayers } from './data/layers';
import { themes, getThemeFromStorage, setThemeToStorage } from './styles/themes';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Ticker } from './components/Ticker';
import { EconCalendar } from './components/EconCalendar';
import { LayerPanel } from './components/LayerPanel';

// Globe must be dynamically imported (requires browser/WebGL)
const Globe = dynamic(
  () => import('./components/Globe').then(m => m.Globe),
  { ssr: false, loading: () => <GlobeLoader /> }
);

function GlobeLoader() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 12,
      background: '#1e1e2e',
      color: '#89b4fa',
      fontSize: 12,
      letterSpacing: '2px',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '2px solid #313244',
        borderTop: '2px solid #89b4fa',
        borderRadius: '50%',
        animation: 'wwSpin 1s linear infinite',
      }} />
      INITIALIZING GLOBE...
    </div>
  );
}

type ActiveView = 'globe' | 'calendar';

const REGIONAL_PRESETS = [
  { label: 'GLOBAL', lat: 30, lng: 20, alt: 2.2 },
  { label: 'EUROPE', lat: 50, lng: 15, alt: 1.2 },
  { label: 'AMERICAS', lat: 10, lng: -80, alt: 1.5 },
  { label: 'MENA', lat: 28, lng: 40, alt: 1.4 },
  { label: 'ASIA', lat: 25, lng: 105, alt: 1.3 },
];

export default function WorldWatchClient() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('mocha');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusEvent, setFocusEvent] = useState<GeoEvent | null>(null);
  const [layers, setLayers] = useState<DataLayer[]>(defaultLayers);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('globe');

  const theme = themes[currentTheme];

  // Load theme from localStorage on mount
  useEffect(() => {
    setCurrentTheme(getThemeFromStorage());
  }, []);

  // Persist theme to localStorage
  useEffect(() => {
    setThemeToStorage(currentTheme);
  }, [currentTheme]);

  const handleSelectEvent = useCallback((event: GeoEvent) => {
    setSelectedId(prev => prev === event.id ? null : event.id);
    setFocusEvent(event);
    setActiveView('globe');
  }, []);

  const handleToggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const activeLayerCount = layers.filter(l => l.enabled).length;

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    fontFamily: '"Geist Mono", "Fira Code", "Cascadia Code", monospace',
    background: theme.base,
    color: theme.text,
    overflow: 'hidden',
    position: 'relative',
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? theme.blue + '22' : 'transparent',
    border: `1px solid ${active ? theme.blue : theme.surface1}`,
    color: active ? theme.blue : theme.subtext0,
    fontSize: 10,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
    transition: 'all 0.15s',
  });

  return (
    <div style={wrapperStyle}>
      {/* Global Styles for World Watch */}
      <style>{`
        @font-face {
          font-family: 'Geist Pixel Fallback';
          src: url('/fonts/GeistPixel-Line.woff2') format('woff2');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }

        .ww-root {
          font-family: var(--font-geist-pixel-line), 'Geist Pixel Fallback', ui-monospace, 'SFMono-Regular', monospace !important;
          font-size: 13px;
          line-height: 1.5;
        }

        .ww-root *, .ww-root *::before, .ww-root *::after {
          box-sizing: border-box;
          font-family: inherit !important;
        }

        .ww-root select, .ww-root button, .ww-root input {
          font-family: inherit !important;
        }

        @keyframes wwBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes wwTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes wwSpin {
          to { transform: rotate(360deg); }
        }

        /* CRT scanlines overlay — content area only, not header */
        .ww-content-area {
          position: relative;
        }
        .ww-content-area::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          );
          pointer-events: none;
          z-index: 100;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.surface1}; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.overlay0}; }

        select option { background: ${theme.mantle}; color: ${theme.text}; }
      `}</style>

      <div className="ww-root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top Bar */}
        <TopBar
          theme={theme}
          currentTheme={currentTheme}
          setCurrentTheme={setCurrentTheme}
        />

        {/* Sub-navigation bar */}
        <div style={{
          height: 36,
          background: theme.mantle,
          borderBottom: `1px solid ${theme.surface0}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}>
          {/* View toggles */}
          <button style={btnStyle(activeView === 'globe')} onClick={() => setActiveView('globe')}>
            GLOBE
          </button>
          <button style={btnStyle(activeView === 'calendar')} onClick={() => setActiveView('calendar')}>
            ECON CALENDAR
          </button>

          <div style={{ width: 1, height: 20, background: theme.surface1, margin: '0 4px' }} />

          {/* Regional Presets (only on globe view) */}
          {activeView === 'globe' && REGIONAL_PRESETS.map(preset => (
            <button
              key={preset.label}
              style={{
                background: 'transparent',
                border: `1px solid ${theme.surface0}`,
                color: theme.overlay0,
                fontSize: 9,
                padding: '3px 7px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.blue;
                (e.currentTarget as HTMLButtonElement).style.color = theme.blue;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.surface0;
                (e.currentTarget as HTMLButtonElement).style.color = theme.overlay0;
              }}
              onClick={() => {
                // Regional preset click — will trigger Globe via focusEvent pattern
                // For now, just a visual button (Globe handles auto-rotation)
              }}
            >
              {preset.label}
            </button>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Layer Toggle Button */}
          {activeView === 'globe' && (
            <button
              style={{
                ...btnStyle(showLayerPanel),
                position: 'relative',
              }}
              onClick={() => setShowLayerPanel(p => !p)}
            >
              LAYERS
              {activeLayerCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4, right: -4,
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: theme.blue,
                  color: theme.crust,
                  fontSize: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}>
                  {activeLayerCount}
                </span>
              )}
            </button>
          )}

          {/* Event count */}
          <div style={{ fontSize: 10, color: theme.overlay0, letterSpacing: '0.5px' }}>
            {mockEvents.length} EVENTS &nbsp;|&nbsp; {new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Main Content */}
        <div className="ww-content-area" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Globe View */}
          {activeView === 'globe' && (
            <>
              <Globe
                events={mockEvents}
                layers={layers}
                selectedId={selectedId}
                onSelect={handleSelectEvent}
                focusEvent={focusEvent}
                theme={theme}
              />

              {/* Layer Panel (floating) */}
              {showLayerPanel && (
                <LayerPanel
                  layers={layers}
                  onToggle={handleToggleLayer}
                  theme={theme}
                  onClose={() => setShowLayerPanel(false)}
                />
              )}

              {/* Sidebar */}
              <Sidebar
                events={mockEvents}
                selectedId={selectedId}
                onSelect={handleSelectEvent}
                theme={theme}
              />
            </>
          )}

          {/* Economic Calendar View */}
          {activeView === 'calendar' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <EconCalendar theme={theme} />
            </div>
          )}
        </div>

        {/* Bottom Ticker */}
        <Ticker events={mockEvents} theme={theme} />

        {/* Status Bar */}
        <div style={{
          height: 20,
          background: theme.crust,
          borderTop: `1px solid ${theme.surface0}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 16,
          fontSize: 9,
          color: theme.overlay0,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}>
          <span style={{ color: theme.green }}>● CONNECTED</span>
          <span>WORLD WATCH v1.0</span>
          <span>PAT MENTORSHIP</span>
          <span style={{ marginLeft: 'auto' }}>
            DATA: MOCK · REAL API INTEGRATION READY
          </span>
        </div>
      </div>
    </div>
  );
}
