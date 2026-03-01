'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { GeoEvent, DataLayer, Theme } from './types';
import { defaultLayers } from './data/layers';
import { themes, getThemeFromStorage, setThemeToStorage } from './styles/themes';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Ticker } from './components/Ticker';
import { EconCalendar } from './components/EconCalendar';
import { LayerPanel } from './components/LayerPanel';
import { MiniCalendar } from './components/MiniCalendar';
import { MarketsPanel } from './components/MarketsPanel';

import type { GlobeHandle } from './components/Globe';

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
      fontSize: 13,
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
      ESTABLISHING SECURE UPLINK...
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
  const [severityFilter, setSeverityFilter] = useState<Set<number>>(new Set());
  const [focusCounter, setFocusCounter] = useState(0);
  const [isRotating, setIsRotating] = useState(true);
  const globeRef = useRef<GlobeHandle>(null);
  const [liveEvents, setLiveEvents] = useState<GeoEvent[]>([]);
  // Aircraft tracks are now fetched on-demand by Globe (hover/click)

  const theme = themes[currentTheme];

  const handleToggleSeverity = useCallback((sev: number) => {
    setSeverityFilter(prev => {
      const next = new Set(prev);
      if (next.has(sev)) {
        next.delete(sev);
      } else {
        next.add(sev);
      }
      return next;
    });
  }, []);

  // Fetch live data from all sources on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/world-watch/earthquakes').then(r => r.json()).catch(() => []),
      fetch('/api/world-watch/gdelt').then(r => r.json()).catch(() => []),
      fetch('/api/world-watch/eonet').then(r => r.json()).catch(() => []),
    ]).then(([quakes, gdelt, eonet]: [GeoEvent[], GeoEvent[], GeoEvent[]]) => {
      const all = [...quakes, ...gdelt, ...eonet];
      const deduped = new Map<string, GeoEvent>();
      for (const ev of all) deduped.set(ev.id, ev);
      setLiveEvents(Array.from(deduped.values()));
    });
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    setCurrentTheme(getThemeFromStorage());
  }, []);

  // Persist theme to localStorage
  useEffect(() => {
    setThemeToStorage(currentTheme);
  }, [currentTheme]);

  // Fetch OpenSky military aircraft — direct client-side fetch (Vercel serverless gets rate-limited)
  useEffect(() => {
    // Tight military ICAO hex ranges (c0 is ALL of Canada civil — removed!)
    const MIL_HEX = ['ae', 'af', '43c', '43d', '43e', '43f', '3fc', '3fd', '3fe'];
    const MIL_CS = ['RCH','REACH','DUKE','EVAC','IRON','GIANT','COBRA','VIPER','SAM','SPAR',
      'EXEC','DARK','GHOST','MANTA','SHARK','GAF','NAF','FAMUS','BALL','ROCKY','OUTLW','REAPER','FORGE',
      'CFC','CANAF','CANFORCE','RCAF'];

    const fetchAircraft = () => {
      fetch('https://opensky-network.org/api/states/all')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: any) => {
          const states = data.states || [];
          const aircraft: any[] = [];

          for (const s of states) {
            const icao = (s[0] || '').toLowerCase();
            const cs = (s[1] || '').trim();
            const lat = s[6], lng = s[5];
            if (!lat || !lng) continue;

            const isMilHex = MIL_HEX.some(p => icao.startsWith(p));
            const isMilCs = MIL_CS.some(p => cs.toUpperCase().startsWith(p));
            if (!isMilHex && !isMilCs) continue;

            aircraft.push({
              icao24: icao,
              callsign: cs || icao.toUpperCase(),
              country: s[2] || 'Unknown',
              lat, lng,
              altitude: Math.round(s[7] || 0),
              velocity: Math.round((s[9] || 0) * 1.944),
              heading: Math.round(s[10] || 0),
              onGround: s[8] || false,
            });
          }

          // Sort: airborne first, by altitude desc, limit 50
          aircraft.sort((a, b) => {
            if (a.onGround !== b.onGround) return a.onGround ? 1 : -1;
            return b.altitude - a.altitude;
          });
          const top = aircraft.slice(0, 50);

          console.log(`[OPTICON] OpenSky: ${states.length} total, ${aircraft.length} mil/gov, showing ${top.length}`);

          // Determine color by air force based on ICAO hex range
          function getAirForceColor(icao24: string): string {
            const hex = icao24.toLowerCase();
            if (hex.startsWith('ae') || hex.startsWith('af')) return '#89b4fa'; // US — blue
            if (hex.startsWith('43c') || hex.startsWith('43d') || hex.startsWith('43e') || hex.startsWith('43f')) return '#cba6f7'; // UK — mauve/purple
            if (hex.startsWith('3fc') || hex.startsWith('3fd') || hex.startsWith('3fe')) return '#f9e2af'; // Germany — yellow/gold
            return '#a6adc8'; // unknown/other — subtext0
          }

          if (top.length > 0) {
            setLayers(prev => prev.map(l => {
              if (l.id !== 'aircraft') return l;
              return {
                ...l,
                points: top.map(ac => ({
                  id: `ac-${ac.icao24}`,
                  lat: ac.lat,
                  lng: ac.lng,
                  label: ac.callsign,
                  subLabel: `${ac.country} | FL${Math.round(ac.altitude / 30.48)} | ${ac.velocity}kt | HDG ${ac.heading}°`,
                  color: getAirForceColor(ac.icao24),
                })),
              };
            }));
          }
        })
        .catch((err) => {
          console.warn('[OPTICON] OpenSky fetch failed:', err.message);
        });
    };

    fetchAircraft();
    const interval = setInterval(fetchAircraft, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectEvent = useCallback((event: GeoEvent) => {
    setSelectedId(event.id);
    setFocusEvent(event);
    setFocusCounter(c => c + 1); // Always increment to force re-trigger
    setActiveView('globe');
  }, []);

  const handleToggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const activeLayerCount = layers.filter(l => l.enabled).length;

  // HOTWIRE always shows all events
  const layerFilteredEvents = liveEvents;

  // Globe events respect layer toggles (conflicts/disasters can be hidden on map)
  const LAYER_CATEGORY_MAP: Record<string, string[]> = {
    'conflicts': ['conflict', 'political', 'health'],
    'disasters': ['natural-disaster'],
  };
  const globeFilteredEvents = useMemo(() => {
    return liveEvents.filter(event => {
      for (const [layerId, categories] of Object.entries(LAYER_CATEGORY_MAP)) {
        if (categories.includes(event.category)) {
          const layer = layers.find(l => l.id === layerId);
          return layer ? layer.enabled : true;
        }
      }
      return true;
    });
  }, [liveEvents, layers]);

  // Filter events for Globe based on severity selection + layer toggles
  const filteredEvents = severityFilter.size > 0
    ? globeFilteredEvents.filter(e => severityFilter.has(e.severity))
    : globeFilteredEvents;

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: theme.base,
    color: theme.text,
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? theme.blue + '22' : 'transparent',
    border: `1px solid ${active ? theme.blue : theme.surface1}`,
    color: active ? theme.blue : theme.subtext0,
    fontSize: 13,
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
          font-family: 'GeistPixelLine';
          src: url('/fonts/GeistPixel-Line.woff2') format('woff2');
          font-weight: 500;
          font-style: normal;
          font-display: block;
        }

        .ww-root {
          font-family: 'GeistPixelLine', ui-monospace, 'SFMono-Regular', monospace !important;
          font-size: 14px;
          line-height: 1.5;
        }

        .ww-root *, .ww-root *::before, .ww-root *::after {
          box-sizing: border-box;
          font-family: 'GeistPixelLine', ui-monospace, 'SFMono-Regular', monospace !important;
        }

        .ww-root select, .ww-root button, .ww-root input {
          font-family: 'GeistPixelLine', ui-monospace, 'SFMono-Regular', monospace !important;
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

        .ww-marker-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .ww-marker-popup .mapboxgl-popup-tip {
          display: none !important;
        }
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
                fontSize: 10,
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

          {/* Globe controls */}
          {activeView === 'globe' && (
            <>
              <button
                onClick={() => globeRef.current?.toggleRotation()}
                style={{
                  background: isRotating ? theme.blue + '22' : 'transparent',
                  border: `1px solid ${isRotating ? theme.blue : theme.surface1}`,
                  color: isRotating ? theme.blue : theme.subtext0,
                  fontSize: 10,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.5px',
                }}
              >
                {isRotating ? '⏸ ROTATE' : '▶ ROTATE'}
              </button>
              <button
                onClick={() => globeRef.current?.resetView()}
                style={{
                  background: 'transparent',
                  border: `1px solid ${theme.surface1}`,
                  color: theme.subtext0,
                  fontSize: 10,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.5px',
                }}
              >
                ↻ RESET
              </button>
            </>
          )}

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
            {liveEvents.length} EVENTS &nbsp;|&nbsp; {new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Main Content */}
        <div className="ww-content-area" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Globe View */}
          {activeView === 'globe' && (
            <>
              {/* Globe fills full area */}
              <Globe
                ref={globeRef}
                events={filteredEvents}
                layers={layers}
                selectedId={selectedId}
                onSelect={handleSelectEvent}
                focusEvent={focusEvent}
                focusCounter={focusCounter}
                theme={theme}
                onRotationChange={setIsRotating}
                
              />

              {/* Left Sidebar Widgets — floating cards */}
              <div style={{
                position: 'absolute',
                left: 12,
                top: 12,
                width: 300,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: 'calc(100% - 24px)',
                overflowY: 'auto',
              }}>
                <MiniCalendar theme={theme} />
                <MarketsPanel theme={theme} />
              </div>

              {/* Layer Panel (floating) */}
              {showLayerPanel && (
                <LayerPanel
                  layers={layers}
                  onToggle={handleToggleLayer}
                  theme={theme}
                  onClose={() => setShowLayerPanel(false)}
                />
              )}

              {/* Right Sidebar — absolute overlay */}
              <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 360,
                zIndex: 50,
              }}>
                <Sidebar
                  events={layerFilteredEvents}
                  selectedId={selectedId}
                  onSelect={handleSelectEvent}
                  theme={theme}
                  severityFilter={severityFilter}
                  onToggleSeverity={handleToggleSeverity}
                />
              </div>
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
        <Ticker events={layerFilteredEvents} theme={theme} />

        {/* Status Bar */}
        <div style={{
          height: 20,
          background: theme.crust,
          borderTop: `1px solid ${theme.surface0}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 16,
          fontSize: 10,
          color: theme.overlay0,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}>
          <span style={{ color: theme.green }}>● UPLINK ACTIVE</span>
          <span>OPTICON v1.0</span>
          <span>PAT CLASSIFIED</span>
          <span style={{ marginLeft: 'auto' }}>
            SIGINT FEED // REAL-TIME // ENCRYPTED
          </span>
        </div>
      </div>
    </div>
  );
}
