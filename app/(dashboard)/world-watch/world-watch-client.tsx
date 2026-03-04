'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { GeoEvent, DataLayer, Theme, NewsItem } from './types';
import { defaultLayers } from './data/layers';
import { themes, getThemeFromStorage, setThemeToStorage } from './styles/themes';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Ticker } from './components/Ticker';
import { EconCalendar } from './components/EconCalendar';
import { LayerPanel } from './components/LayerPanel';
import { MiniCalendar } from './components/MiniCalendar';
import { MarketsPanel } from './components/MarketsPanel';
import { ToastSystem } from './components/ToastSystem';

import type { GlobeHandle, AircraftInfo } from './components/Globe';

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
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [aiBrief, setAiBrief] = useState<any>(null);
  const aircraftDataRef = useRef<Map<string, AircraftInfo>>(new Map());
  // Trail history: icao → [[lng, lat, timestamp], ...]
  const trailHistoryRef = useRef<Map<string, [number, number, number][]>>(new Map());
  const [aircraftTrails, setAircraftTrails] = useState<{ type: 'FeatureCollection'; features: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { color: string } }[] }>({ type: 'FeatureCollection', features: [] });

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

  // Fetch NOTAM airspace closures
  useEffect(() => {
    fetch('/api/world-watch/notams')
      .then(r => r.json())
      .then((polygons) => {
        setLayers(prev => prev.map(l =>
          l.id === 'airspace' ? { ...l, polygons } : l
        ));
      })
      .catch(() => {});
  }, []);

  // Fetch RSS news feed every 15 minutes
  useEffect(() => {
    const fetchNews = () => {
      fetch('/api/world-watch/news')
        .then(r => r.json())
        .then(data => { setNewsItems(data.items || []); })
        .catch(() => {});
    };
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch AI Brief (OSINT analysis) every 5 minutes
  useEffect(() => {
    const fetchBrief = () => {
      fetch('/api/world-watch/brief')
        .then(r => r.json())
        .then(data => {
          if (data.generatedAt) setAiBrief(data);
        })
        .catch(() => {});
    };
    fetchBrief();
    const interval = setInterval(fetchBrief, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    setCurrentTheme(getThemeFromStorage());
  }, []);

  // Persist theme to localStorage
  useEffect(() => {
    setThemeToStorage(currentTheme);
  }, [currentTheme]);

  // Load nuclear facilities from static JSON (237: power plants + enrichment + weapons labs)
  useEffect(() => {
    fetch('/data/nuclear-facilities.json')
      .then(r => r.json())
      .then((data: Array<{ name: string; country: string; countryCode: string; lat: number; lng: number; capacityMW?: number; type?: string; operator?: string }>) => {
        const TYPE_COLORS: Record<string, string> = {
          'power-plant': '#f9e2af',  // yellow — civilian
          'enrichment': '#fab387',   // peach — sensitive
          'weapons-lab': '#f38ba8',  // red — military
        };
        const TYPE_LABELS: Record<string, string> = {
          'power-plant': 'Power Plant',
          'enrichment': 'Enrichment Facility',
          'weapons-lab': 'Weapons Lab / Test Site',
        };
        const points = data.map((f, i) => {
          const facilityType = f.type || 'power-plant';
          const color = TYPE_COLORS[facilityType] || '#f9e2af';
          const typeLabel = TYPE_LABELS[facilityType] || 'Nuclear Facility';
          const capacity = f.capacityMW ? ` · ${f.capacityMW} MW` : '';
          const operator = f.operator ? ` · ${f.operator}` : '';
          return {
            id: `nf-json-${i}`,
            lat: f.lat,
            lng: f.lng,
            label: f.name,
            subLabel: `${typeLabel} · ${f.country}${capacity}${operator}`,
            color,
            meta: { facilityType, operator: f.operator || '', capacityMW: f.capacityMW || 0 },
          };
        });
        setLayers(prev => prev.map(l =>
          l.id === 'nuclear' ? { ...l, points } : l
        ));
      })
      .catch(() => {});
  }, []);

  // Fetch naval forces from static OSINT data
  useEffect(() => {
    const NAVY_COLORS: Record<string, string> = {
      'US': '#89b4fa',
      'UK': '#cba6f7',
      'RU': '#f38ba8',
      'CN': '#fab387',
      'FR': '#74c7ec',
      'IN': '#a6e3a1',
    };

    fetch('/data/naval-forces.json')
      .then(r => r.json())
      .then((data: any) => {
        const points = (data.forces || []).map((f: any) => ({
          id: `ship-${f.id}`,
          lat: f.lat,
          lng: f.lng,
          label: f.name,
          subLabel: `${f.flagship} · ${f.region}`,
          color: NAVY_COLORS[f.country] || '#a6adc8',
          meta: {
            flagship: f.flagship,
            country: f.country,
            countryFlag: f.countryFlag || '',
            region: f.region,
            status: f.status,
            type: f.type,
            shipType: f.shipType || '',
            sidc: f.sidc || 'SFSPCLCC--',
            composition: (f.composition || []).join(', '),
            notes: f.notes || '',
            imageUrl: f.imageUrl || '',
            wikiUrl: f.wikiUrl || '',
          },
        }));

        setLayers(prev => prev.map(l =>
          l.id === 'ships' ? { ...l, points } : l
        ));
      })
      .catch(() => {});
  }, []);

  // Fetch FR24 military aircraft feed (proxied server-side to avoid CORS)
  useEffect(() => {
    // Military ICAO hex ranges (3fc-3fe REMOVED: catches German civilian ultralights D-M*)
    // Safe hex ranges only: ae/af = USAF, 43c-43f = RAF, 73 = Iran (almost all mil), 74 = Iraq (small block)
    const MIL_HEX = ['ae', 'af', '43c', '43d', '43e', '43f', '73', '74'];
    const MIL_CS = [
      // USAF
      'RCH','REACH','DUKE','EVAC','IRON','GIANT','COBRA','VIPER','SAM','SPAR',
      'EXEC','DARK','GHOST','MANTA','SHARK','FAMUS','BALL','ROCKY','OUTLW','REAPER','FORGE',
      'FORTE','JAKE','LAGR',
      // Canada
      'CFC','CANAF','CANFORCE','RCAF',
      // Germany Luftwaffe
      'GAF','GAFM','GERMAN',
      // UK RAF
      'ASCOT','TARTN',
      // France
      'FAF','CTM',
      // Russia (hostile)
      'RRR','RFF','RSD',
      // Iran
      'IRIAF','IRGC',
      // Iraq
      'IQA',
      // China (military only — CCA/CHH/CXA are Air China/Hainan/China Eastern commercial)
      'PLAAF','PLAN','CBA',
      // Pakistan
      'PAF',
      // NATO
      'NATO','NCHO',
      // Turkey
      'TURAF',
      // Japan
      'JASDF',
      // South Korea
      'ROKAF',
      // Australia (callsign only — 7c hex too broad)
      'RAAF',
      // India (callsign only)
      'IAF',
    ];

    function getAirForceInfo(icao24: string, callsign: string): { color: string; airForce: string } {
      const hex = icao24.toLowerCase();
      const cs = callsign.toUpperCase();
      // US Military
      if (hex.startsWith('ae') || hex.startsWith('af')) return { color: '#89b4fa', airForce: 'USAF' };
      if (['FORTE','JAKE','LAGR'].some(p => cs.startsWith(p))) return { color: '#89b4fa', airForce: 'USAF' };
      // UK RAF
      if (['43c','43d','43e','43f'].some(p => hex.startsWith(p))) return { color: '#cba6f7', airForce: 'RAF' };
      if (['ASCOT','TARTN'].some(p => cs.startsWith(p))) return { color: '#cba6f7', airForce: 'RAF' };
      // Germany Luftwaffe
      if (cs.startsWith('GAF') || cs.startsWith('GAFM') || cs.startsWith('GERMAN')) return { color: '#f9e2af', airForce: 'Luftwaffe' };
      // Canada RCAF
      if (['CFC','CANAF','CANFORCE','RCAF'].some(p => cs.startsWith(p))) return { color: '#94e2d5', airForce: 'RCAF' };
      // France
      if (cs.startsWith('FAF') || cs.startsWith('CTM')) return { color: '#74c7ec', airForce: 'Armée de l\'Air' };
      // Russia (hostile)
      if (['RRR','RFF','RSD'].some(p => cs.startsWith(p))) return { color: '#f38ba8', airForce: 'VKS (Russia)' };
      // Iran (hostile)
      if (hex.startsWith('73')) return { color: '#f38ba8', airForce: 'IRIAF (Iran)' };
      if (['IRIAF','IRGC'].some(p => cs.startsWith(p))) return { color: '#f38ba8', airForce: 'IRIAF (Iran)' };
      // Iraq
      if (hex.startsWith('74')) return { color: '#fab387', airForce: 'IqAF (Iraq)' };
      if (cs.startsWith('IQA')) return { color: '#fab387', airForce: 'IqAF (Iraq)' };
      // China (military only — NOT commercial airlines)
      if (['PLAAF','PLAN','CBA'].some(p => cs.startsWith(p))) return { color: '#f38ba8', airForce: 'PLAAF (China)' };
      // Pakistan
      if (cs.startsWith('PAF')) return { color: '#fab387', airForce: 'PAF (Pakistan)' };
      // NATO
      if (['NATO','NCHO'].some(p => cs.startsWith(p))) return { color: '#74c7ec', airForce: 'NATO' };
      // Turkey
      if (cs.startsWith('TURAF')) return { color: '#f9e2af', airForce: 'TurAF' };
      // Japan
      if (cs.startsWith('JASDF')) return { color: '#94e2d5', airForce: 'JASDF' };
      // South Korea
      if (cs.startsWith('ROKAF')) return { color: '#94e2d5', airForce: 'ROKAF' };
      // Australia
      if (cs.startsWith('RAAF')) return { color: '#94e2d5', airForce: 'RAAF' };
      // India
      if (cs.startsWith('IAF')) return { color: '#a6e3a1', airForce: 'IAF (India)' };
      return { color: '#a6adc8', airForce: 'Military' };
    }

    const fetchAircraft = async () => {
      const now = Date.now();

      // Fetch from both sources in parallel; FR24 is fallback
      const [fr24Result, adsbResult] = await Promise.allSettled([
        fetch('/api/world-watch/fr24').then(r => { if (!r.ok) throw new Error(`FR24 HTTP ${r.status}`); return r.json(); }),
        fetch('/api/world-watch/adsb').then(r => { if (!r.ok) throw new Error(`ADS-B HTTP ${r.status}`); return r.json(); }),
      ]);

      // Map: icao → AircraftInfo (ADS-B Exchange preferred)
      const mergedMap = new Map<string, AircraftInfo>();

      // --- Parse FR24 ---
      if (fr24Result.status === 'fulfilled') {
        const data = fr24Result.value as Record<string, unknown>;
        for (const [, v] of Object.entries(data)) {
          if (!Array.isArray(v)) continue;
          const entry = v as unknown[];
          const icao = ((entry[0] as string) || '').toLowerCase();
          const lat = entry[1] as number;
          const lng = entry[2] as number;
          if (!lat || !lng) continue;
          const callsign = ((entry[16] as string) || '').trim() || icao.toUpperCase();
          const heading = (entry[3] as number) || 0;
          const altitude = (entry[4] as number) || 0;
          const speed = (entry[5] as number) || 0;
          const aircraftType = ((entry[8] as string) || '').trim();
          const registration = ((entry[9] as string) || '').trim();
          const origin = ((entry[11] as string) || '').trim();
          const destination = ((entry[12] as string) || '').trim();
          const isMilHex = MIL_HEX.some(p => icao.startsWith(p));
          const isMilCs = MIL_CS.some(p => callsign.toUpperCase().startsWith(p));
          if (!isMilHex && !isMilCs) continue;
          const { color, airForce } = getAirForceInfo(icao, callsign);
          mergedMap.set(icao, { icao24: icao, callsign, country: '', lat, lng, altitude, velocity: speed, heading, aircraftType, registration, origin, destination, airForce, airForceColor: color });
        }
      } else {
        console.warn('[OPTICON] FR24 fetch failed:', fr24Result.reason?.message);
      }

      // --- Parse ADS-B Exchange (preferred — overwrites FR24 for same hex) ---
      if (adsbResult.status === 'fulfilled') {
        const data = adsbResult.value as { ac?: unknown[] };
        for (const raw of data.ac || []) {
          const ac = raw as { hex?: string; flight?: string; lat?: number; lon?: number; alt_baro?: number | string; track?: number; gs?: number; t?: string; r?: string };
          const icao = (ac.hex || '').toLowerCase();
          if (!icao) continue;
          const lat = ac.lat;
          const lng = ac.lon;
          if (!lat || !lng) continue;
          const callsign = (ac.flight || '').trim() || icao.toUpperCase();
          const isMilHex = MIL_HEX.some(p => icao.startsWith(p));
          const isMilCs = MIL_CS.some(p => callsign.toUpperCase().startsWith(p));
          if (!isMilHex && !isMilCs) continue;
          const altBaro = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;
          const heading = ac.track || 0;
          const speed = ac.gs || 0;
          const aircraftType = ac.t || '';
          const registration = ac.r || '';
          const { color, airForce } = getAirForceInfo(icao, callsign);
          // ADS-B Exchange preferred: overwrite FR24 entry
          mergedMap.set(icao, { icao24: icao, callsign, country: '', lat, lng, altitude: altBaro, velocity: speed, heading, aircraftType, registration, origin: '', destination: '', airForce, airForceColor: color });
        }
      } else {
        console.warn('[OPTICON] ADS-B fetch failed:', adsbResult.reason?.message);
      }

      const aircraft = Array.from(mergedMap.values());

      // Sort: by altitude desc, limit 50
      aircraft.sort((a, b) => b.altitude - a.altitude);
      const top = aircraft.slice(0, 50);

      console.log(`[OPTICON] Merged: ${aircraft.length} mil/gov matches, showing ${top.length}`);

      // Update aircraftDataRef
      const acMap = new Map<string, AircraftInfo>();
      for (const ac of top) acMap.set(ac.icao24, ac);
      aircraftDataRef.current = acMap;

      // --- Update trail history ---
      const trails = trailHistoryRef.current;
      const seenIcaos = new Set<string>();

      for (const ac of top) {
        seenIcaos.add(ac.icao24);
        const history = trails.get(ac.icao24) ?? [];
        const last = history[history.length - 1];
        const moved = !last || Math.abs(ac.lng - last[0]) > 0.01 || Math.abs(ac.lat - last[1]) > 0.01;
        if (moved) {
          history.push([ac.lng, ac.lat, now]);
          if (history.length > 60) history.shift(); // ring buffer
        }
        trails.set(ac.icao24, history);
      }

      // Remove stale aircraft (not seen for 5 minutes)
      const STALE_MS = 5 * 60 * 1000;
      for (const [icao, history] of trails.entries()) {
        if (!seenIcaos.has(icao)) {
          const lastTs = history[history.length - 1]?.[2] ?? 0;
          if (now - lastTs > STALE_MS) trails.delete(icao);
        }
      }

      // Build trail GeoJSON
      const trailFeatures: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { color: string } }[] = [];
      for (const ac of top) {
        const history = trails.get(ac.icao24);
        if (!history || history.length < 2) continue;
        trailFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: history.map(([lng, lat]) => [lng, lat]) },
          properties: { color: ac.airForceColor },
        });
      }
      setAircraftTrails({ type: 'FeatureCollection', features: trailFeatures });

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
              subLabel: `FL${Math.round(ac.altitude / 30.48)} | ${ac.velocity}kt | HDG ${ac.heading}°`,
              color: ac.airForceColor,
            })),
          };
        }));
      }
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

  const handleNewsSelect = useCallback((news: NewsItem) => {
    setSelectedNews(news);
    // If geocoded, fly to location
    if (news.lat != null && news.lng != null) {
      const fakeEvent: GeoEvent = {
        id: news.id,
        title: news.title,
        description: news.description,
        lat: news.lat,
        lng: news.lng,
        severity: news.priority >= 3 ? 3 : 2,
        category: 'political',
        source: news.source,
        timestamp: news.pubDate,
        country: news.country,
        sourceUrl: news.link,
      };
      handleSelectEvent(fakeEvent);
    }
  }, [handleSelectEvent]);

  const handleToggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const activeLayerCount = layers.filter(l => l.enabled).length;

  // Layer → category mapping
  const LAYER_CATEGORY_MAP: Record<string, string[]> = {
    'conflicts': ['conflict', 'political', 'health'],
    'disasters': ['natural-disaster'],
  };

  // HOTWIRE respects layer toggles (same as globe dots)
  const layerFilteredEvents = useMemo(() => {
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

  // Globe events also respect layer toggles (same logic)
  const globeFilteredEvents = layerFilteredEvents;

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
        /* Focus popup — solid background for click-from-sidebar events */
        .ww-focus-popup .mapboxgl-popup-content {
          background: ${theme.mantle} !important;
          border: 1px solid ${theme.surface1} !important;
          border-radius: 6px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          max-width: 300px !important;
        }
        .ww-focus-popup .mapboxgl-popup-tip {
          border-top-color: ${theme.mantle} !important;
        }
        .ww-focus-popup .mapboxgl-popup-close-button {
          color: ${theme.overlay0} !important;
          font-size: 16px !important;
          right: 4px !important;
          top: 2px !important;
        }
        .ww-focus-popup .mapboxgl-popup-close-button:hover {
          color: ${theme.text} !important;
          background: transparent !important;
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
                aircraftDataRef={aircraftDataRef}
                aircraftTrails={aircraftTrails}
                selectedNews={selectedNews}
                aiBrief={aiBrief}
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
                  newsItems={newsItems}
                  onNewsSelect={handleNewsSelect}
                  aiBrief={aiBrief}
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
        <Ticker events={layerFilteredEvents} theme={theme} newsItems={newsItems} aiBrief={aiBrief} />

        {/* Toast Notifications — high-severity AI Brief events */}
        <ToastSystem aiBrief={aiBrief} theme={theme} onEventFocus={handleSelectEvent} />

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
