'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoEvent, DataLayer, ThemeColors, NewsItem } from '../types';
import { severityColors } from '../styles/themes';
import ms from 'milsymbol';
import { ACTIVE_CONFLICTS } from '../data/conflicts';

export interface AircraftInfo {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  altitude: number;   // feet
  velocity: number;   // knots
  heading: number;
  aircraftType: string;
  registration: string;
  origin: string;     // IATA code
  destination: string; // IATA code
  airForce: string;
  airForceColor: string;
}

// Airport data loaded from /data/airports.json (6072 airports)
// Format: { IATA: [lng, lat, name], ... }

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export interface GlobeHandle {
  toggleRotation: () => void;
  resetView: () => void;
  isRotating: boolean;
}

export interface AIBriefEvent {
  headline: string;
  conflictId: string | null;
  type: 'strike' | 'deployment' | 'diplomatic' | 'protest' | 'humanitarian' | 'other';
  targetLocation: { name: string; lat: number; lng: number } | null;
  originLocation: { name: string; lat: number; lng: number } | null;
  corroboration: number;
  sources: string[];
  verified: boolean;
  severity: 1 | 2 | 3 | 4;
  /** NATO APP-6 affiliation: hostile=red diamond, friendly=blue rect, neutral=green square, unknown=yellow quatrefoil */
  side?: 'hostile' | 'friendly' | 'neutral' | 'unknown';
}

export interface AIBrief {
  generatedAt: string | null;
  riskLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  conflictHeat: Record<string, number>;
  focalPoints: { conflictId: string; region: string; heat: number; summary: string; escalation: 'up' | 'stable' | 'down' }[];
  verifiedEvents: AIBriefEvent[];
  newHotspots: { name: string; lat: number; lng: number; conflictId: string | null; reason: string; type: 'chokepoint' | 'frontline' | 'target' }[];
  meta?: Record<string, any>;
}

interface Props {
  events: GeoEvent[];
  layers: DataLayer[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  focusEvent: GeoEvent | null;
  focusCounter: number; // increments on every select to force re-trigger
  theme: ThemeColors;
  onRotationChange?: (rotating: boolean) => void;
  aircraftDataRef?: React.RefObject<Map<string, AircraftInfo>>;
  selectedNews?: NewsItem | null;
  aiBrief?: AIBrief | null;
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'UK': 'United Kingdom',
  'South Korea': 'Republic of Korea',
};

const DEFAULT_CENTER: [number, number] = [20, 30];
const DEFAULT_ZOOM = 1.8;

function getDisasterType(title: string, category: string): string {
  const t = (title + ' ' + category).toLowerCase();
  if (t.includes('wildfire') || t.includes('fire') || t.includes('blaze') || t.includes('burn')) return 'fire';
  if (t.includes('earthquake') || t.includes('seismic') || t.includes('quake') || t.includes('tremor')) return 'earthquake';
  if (t.includes('volcano') || t.includes('eruption') || t.includes('volcanic') || t.includes('lava')) return 'volcano';
  if (t.includes('storm') || t.includes('typhoon') || t.includes('hurricane') || t.includes('cyclone') || t.includes('tornado') || t.includes('flood') || t.includes('severe weather')) return 'storm';
  if (t.includes('conflict') || t.includes('protest') || t.includes('attack') || t.includes('military') || t.includes('war')) return 'conflict';
  return 'default';
}

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  { events, layers, onSelect, focusEvent, focusCounter, theme, onRotationChange, aircraftDataRef, selectedNews, aiBrief },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRotatingRef = useRef(true);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const airportRef = useRef<Record<string, [number, number, string]>>({});
  const militaryPopupRef = useRef<mapboxgl.Popup | null>(null);
  const nuclearPopupRef = useRef<mapboxgl.Popup | null>(null);
  const cableClickPopupRef = useRef<mapboxgl.Popup | null>(null);
  const pipelineClickPopupRef = useRef<mapboxgl.Popup | null>(null);
  const disasterPopupRef = useRef<mapboxgl.Popup | null>(null);
  const newsPopupRef = useRef<mapboxgl.Popup | null>(null);
  const conflictPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hotspotPopupRef = useRef<mapboxgl.Popup | null>(null);
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colors = severityColors(theme);

  // Load full airport database (6072 airports) on mount
  useEffect(() => {
    fetch('/data/airports.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Record<string, [number, number, string]>) => {
        airportRef.current = data;
      })
      .catch((err) => {
        console.warn('[OPTICON] Airport DB failed:', err.message);
      });
  }, []);

  const geoEvents = events.filter(e => e.category !== 'economic');

  const stopRotation = useCallback(() => {
    if (rotateRef.current) {
      clearInterval(rotateRef.current);
      rotateRef.current = null;
    }
    isRotatingRef.current = false;
    onRotationChange?.(false);
  }, [onRotationChange]);

  const startRotation = useCallback(() => {
    if (rotateRef.current || !mapRef.current) return;
    const map = mapRef.current;
    rotateRef.current = setInterval(() => {
      const center = map.getCenter();
      center.lng += 0.03;
      map.setCenter(center);
    }, 16);
    isRotatingRef.current = true;
    onRotationChange?.(true);
  }, [onRotationChange]);

  useImperativeHandle(ref, () => ({
    toggleRotation: () => {
      if (isRotatingRef.current) {
        stopRotation();
      } else {
        startRotation();
      }
    },
    resetView: () => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      // Stop rotation during flyTo
      stopRotation();
      // Clear highlights
      try {
        if (map.getLayer('country-highlight-fill')) map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
        if (map.getLayer('country-highlight-line')) map.setFilter('country-highlight-line', ['==', 'name_en', '']);
      } catch (_) {}
      // Fly to default, start rotation after animation completes
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 1500, essential: true });
      map.once('moveend', () => { startRotation(); });
    },
    get isRotating() { return isRotatingRef.current; },
  }), [startRotation, stopRotation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      // @ts-ignore globe projection (mapbox-gl v3)
      projection: 'globe',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      antialias: true,
    });

    mapRef.current = map;

    map.on('style.load', () => {
      styleReadyRef.current = true;
      // Catppuccin atmosphere — subtle blue-tinted halo
      // @ts-ignore setFog (mapbox-gl v3)
      map.setFog({
        color: '#1e1e30',
        'high-color': '#252538',
        'horizon-blend': 0.05,
        'space-color': '#141423',
        'star-intensity': 0.25,
      });

      // FLIR/tactical look with Catppuccin slate shades
      const style = map.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
          if (layer.id.includes('water') && layer.type === 'fill') {
            try { map.setPaintProperty(layer.id, 'fill-color', '#11111b'); } catch (_) {}
          }
          if (layer.id.includes('admin') && layer.type === 'line') {
            try {
              map.setPaintProperty(layer.id, 'line-color', '#6c7086');
              map.setPaintProperty(layer.id, 'line-opacity', 0.4);
              map.setPaintProperty(layer.id, 'line-width', 0.5);
              map.setPaintProperty(layer.id, 'line-dasharray', [3, 2]);
            } catch (_) {}
          }
        }
      }

      // Land shading variation
      try {
        const landLayers = style?.layers?.filter((l: { id: string; type: string }) =>
          l.id.includes('land') && l.type === 'fill'
        ) || [];
        for (const layer of landLayers) {
          map.setPaintProperty(layer.id, 'fill-color', [
            'interpolate', ['linear'], ['zoom'],
            0, '#1e1e2e',
            3, '#181825',
            6, '#1e1e2e',
          ]);
        }
      } catch (_) {}

      // Landuse variation
      try {
        const landuseLayer = style?.layers?.find((l: { id: string }) => l.id.includes('landuse'));
        if (landuseLayer) {
          map.setPaintProperty(landuseLayer.id, 'fill-color', [
            'match', ['get', 'class'],
            'park', '#1a1a2e', 'glacier', '#2a2a3e', 'pitch', '#161628',
            'sand', '#1c1c30', 'hospital', '#1e1e32', 'school', '#1a1a2c',
            'industrial', '#16162a', '#1e1e2e',
          ]);
          map.setPaintProperty(landuseLayer.id, 'fill-opacity', 0.8);
        }
      } catch (_) {}

      // ─── ACTIVE CONFLICT ZONES ─────────────────────────────────────
      // Add BEFORE event layers so they appear as background
      for (const conflict of ACTIVE_CONFLICTS) {
        const sourceId = `conflict-zone-${conflict.id}`;
        const coords = conflict.bounds.map(([lat, lng]) => [lng, lat]);
        coords.push(coords[0]); // close polygon

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { id: conflict.id, name: conflict.name, shortName: conflict.shortName, color: conflict.color, severity: conflict.severity },
          },
        });

        // Subtle fill
        map.addLayer({
          id: `conflict-fill-${conflict.id}`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': conflict.color,
            'fill-opacity': conflict.severity === 'critical' ? 0.08 : 0.05,
          },
        });

        // Dashed border
        map.addLayer({
          id: `conflict-border-${conflict.id}`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': conflict.color,
            'line-width': conflict.severity === 'critical' ? 2 : 1.5,
            'line-opacity': 0.5,
            'line-dasharray': [4, 4],
          },
        });

        // Label at conflict center point (NOT on polygon to avoid repeat rendering)
        map.addSource(`conflict-label-pt-${conflict.id}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [conflict.lng, conflict.lat] },
            properties: { label: `⚔ ${conflict.shortName}`, color: conflict.color },
          },
        });
        map.addLayer({
          id: `conflict-label-${conflict.id}`,
          type: 'symbol',
          source: `conflict-label-pt-${conflict.id}`,
          maxzoom: 6,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': conflict.color,
            'text-halo-color': theme.crust,
            'text-halo-width': 1.5,
            'text-opacity': 0.7,
          },
        } as any);
      }

      // ─── CONFLICT HOTSPOT MARKERS (pulse dots at chokepoints/frontlines) ───
      const hotspotFeatures: any[] = [];
      for (const conflict of ACTIVE_CONFLICTS) {
        if (!conflict.hotspots) continue;
        for (const hs of conflict.hotspots) {
          hotspotFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [hs.lng, hs.lat] },
            properties: { label: hs.label, color: conflict.color, type: hs.type, conflictId: conflict.id },
          });
        }
      }

      if (hotspotFeatures.length > 0) {
        map.addSource('conflict-hotspots', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: hotspotFeatures },
        });

        // Diamond SDF icons for hotspot markers (solid core + outline for pulse)
        const diamondSolidSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12" fill="white"/></svg>`;
        const diamondOutlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="white" stroke-width="2"/></svg>`;

        // Load solid diamond
        const solidBlob = new Blob([diamondSolidSvg], { type: 'image/svg+xml' });
        const solidUrl = URL.createObjectURL(solidBlob);
        const solidImg = new Image(24, 24);
        solidImg.onload = () => {
          if (!map.hasImage('diamond-icon')) map.addImage('diamond-icon', solidImg, { sdf: true });
          URL.revokeObjectURL(solidUrl);
        };
        solidImg.src = solidUrl;

        // Load outline diamond for pulse
        const outlineBlob = new Blob([diamondOutlineSvg], { type: 'image/svg+xml' });
        const outlineUrl = URL.createObjectURL(outlineBlob);
        const outlineImg = new Image(24, 24);
        outlineImg.onload = () => {
          if (!map.hasImage('diamond-outline-icon')) map.addImage('diamond-outline-icon', outlineImg, { sdf: true });
          URL.revokeObjectURL(outlineUrl);
        };
        outlineImg.src = outlineUrl;

        // Hotspot color: frontlines always red (#f38ba8), others use conflict color
        const hotspotColor: mapboxgl.Expression = [
          'case',
          ['==', ['get', 'type'], 'frontline'], '#f38ba8',
          ['get', 'color'],
        ] as any;

        // Pulse diamond outlines (3 rings pulsing outward)
        for (let ring = 1; ring <= 3; ring++) {
          map.addLayer({
            id: `conflict-hotspot-pulse-${ring}`,
            type: 'symbol',
            source: 'conflict-hotspots',
            layout: {
              'icon-image': 'diamond-outline-icon',
              'icon-size': 0.5,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-color': hotspotColor,
              'icon-opacity': 0.4,
            },
          } as any);
        }

        // Core diamond icon
        map.addLayer({
          id: 'conflict-hotspot-dots',
          type: 'symbol',
          source: 'conflict-hotspots',
          layout: {
            'icon-image': 'diamond-icon',
            'icon-size': 0.5,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-color': hotspotColor,
            'icon-opacity': 0.9,
          },
        } as any);

        // Label
        map.addLayer({
          id: 'conflict-hotspot-labels',
          type: 'symbol',
          source: 'conflict-hotspots',
          minzoom: 4,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 9,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-offset': [0, 1.8],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': theme.crust,
            'text-halo-width': 1,
            'text-opacity': 0.8,
          },
        } as any);
      }

      // ─── CONFLICT HOTSPOT CLICK POPUP ─────────────────────────────────
      hotspotPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '240px',
        className: 'ww-marker-popup',
      });
      const hotspotPopup = hotspotPopupRef.current;

      map.on('click', 'conflict-hotspot-dots', (e: any) => {
        markerClicked = true;
        if (!e.features?.[0]) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
        const typeLabel = props.type === 'chokepoint' ? '🔒 CHOKEPOINT'
          : props.type === 'frontline' ? '⚔ FRONTLINE' : '🎯 TARGET';
        const typeColor = props.type === 'chokepoint' ? '#f9e2af'
          : props.type === 'frontline' ? '#f38ba8' : '#fab387';

        // Dismiss other popups
        conflictPopupRef.current?.remove();
        hotspotPopup.setLngLat(coords).setHTML(`
          <div style="font-family: inherit; padding: 8px 10px; background: ${theme.mantle}ee; backdrop-filter: blur(12px); border: 1px solid ${props.color || typeColor}55; border-left: 3px solid ${props.color || typeColor}; border-radius: 6px;">
            <div style="font-size: 10px; font-weight: 700; color: ${typeColor}; letter-spacing: 1px; margin-bottom: 3px;">${typeLabel}</div>
            <div style="font-size: 12px; font-weight: 600; color: ${theme.text}; line-height: 1.3;">◆ ${props.label}</div>
          </div>
        `).addTo(map);
      });

      map.on('mouseenter', 'conflict-hotspot-dots', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'conflict-hotspot-dots', () => {
        map.getCanvas().style.cursor = '';
      });

      // Conflict zone click popup DISABLED — zones are visual-only, clicking through to items below

      // News popup (created once, reused via selectedNews prop)
      newsPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '300px',
        className: 'ww-marker-popup',
      });

      // Events GeoJSON source
      map.addSource('events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: geoEvents.map(ev => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [ev.lng, ev.lat] },
            properties: { id: ev.id, severity: ev.severity, title: ev.title, country: ev.country, category: ev.category, sourceUrl: ev.sourceUrl || '', disasterType: getDisasterType(ev.title, ev.category) },
          })),
        },
      });

      // Pulse layer
      map.addLayer({
        id: 'event-pulse',
        type: 'circle',
        source: 'events',
        filter: ['>=', ['get', 'severity'], 3],
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 4, 20, 15],
          'circle-color': ['match', ['get', 'severity'], 4, colors[4], colors[3]],
          'circle-opacity': 0.15,
        },
      });

      // Main event icons (symbol layer with disaster-type-specific icons)
      map.addLayer({
        id: 'event-icons',
        type: 'symbol',
        source: 'events',
        layout: {
          'icon-image': [
            'match', ['get', 'disasterType'],
            'fire', 'disaster-fire',
            'storm', 'disaster-storm',
            'earthquake', 'disaster-earthquake',
            'volcano', 'disaster-volcano',
            'disaster-default',
          ],
          'icon-size': ['match', ['get', 'severity'], 4, 0.9, 3, 0.75, 0.6],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['match', ['get', 'severity'], 4, colors[4], 3, colors[3], 2, colors[2], colors[1]],
          'icon-opacity': 0.9,
        },
      } as any);

      // Country boundaries for highlighting
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });

      map.addLayer({
        id: 'country-highlight-fill',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: { 'fill-color': colors[4], 'fill-opacity': 0.06 },
        filter: ['==', 'name_en', ''],
      });

      map.addLayer({
        id: 'country-highlight-line',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: { 'line-color': colors[4], 'line-width': 1, 'line-opacity': 0.3 },
        filter: ['==', 'name_en', ''],
      });

      // ─── PERMANENT CONFLICT COUNTRY HIGHLIGHTS ───────────────────────
      // Each conflict gets its own fill + border layer so countries use the conflict color
      for (const conflict of ACTIVE_CONFLICTS) {
        const countryFilter: any = conflict.countries.length === 1
          ? ['==', 'name_en', conflict.countries[0]]
          : ['in', 'name_en', ...conflict.countries];

        map.addLayer({
          id: `conflict-country-fill-${conflict.id}`,
          type: 'fill',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          paint: {
            'fill-color': conflict.color,
            'fill-opacity': conflict.severity === 'critical' ? 0.10 : 0.06,
          },
          filter: countryFilter,
        });

        map.addLayer({
          id: `conflict-country-line-${conflict.id}`,
          type: 'line',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          paint: {
            'line-color': conflict.color,
            'line-width': conflict.severity === 'critical' ? 1.5 : 1,
            'line-opacity': 0.4,
          },
          filter: countryFilter,
        });
      }

      // ─── SUBTLE COUNTRY NAMES (all countries) ─────────────────────────
      map.addLayer({
        id: 'country-names-subtle',
        type: 'symbol',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        minzoom: 2,
        maxzoom: 8,
        layout: {
          'text-field': ['get', 'name_en'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 8, 5, 11, 8, 14],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-padding': 8,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: {
          'text-color': theme.overlay0,
          'text-halo-color': theme.crust,
          'text-halo-width': 1,
          'text-opacity': 0.35,
        },
      } as any);

      // NOTE: Generic data layers (points/arcs) are created/managed entirely
      // by the layers-sync useEffect below. Do NOT create them here in style.load
      // because layers may be disabled at load time and would be skipped.

      // Event country labels
      map.addLayer({
        id: 'event-labels',
        type: 'symbol',
        source: 'events',
        filter: ['>=', ['get', 'severity'], 3],
        layout: {
          'text-field': ['get', 'country'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#cdd6f4',
          'text-halo-color': '#11111b',
          'text-halo-width': 1.5,
        },
      });

      // ─── AIRCRAFT SYSTEM ──────────────────────────────────────────────

      // Load aircraft icon — inline SVG data URL to avoid async race condition
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image(24, 24);
      img.onload = () => {
        if (!map.hasImage('aircraft-icon')) {
          map.addImage('aircraft-icon', img, { sdf: true });
        }
        URL.revokeObjectURL(svgUrl);
      };
      img.onerror = () => URL.revokeObjectURL(svgUrl);
      img.src = svgUrl;

      // Aircraft positions source (populated by live OpenSky data via layers)
      map.addSource('aircraft-live', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Aircraft icons (rotated by heading)
      map.addLayer({
        id: 'aircraft-icons',
        type: 'symbol',
        source: 'aircraft-live',
        layout: {
          'icon-image': 'aircraft-icon',
          'icon-size': 0.8,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': 0.9,
        },
      });

      // Aircraft callsign labels (zoom >= 4)
      map.addLayer({
        id: 'aircraft-labels',
        type: 'symbol',
        source: 'aircraft-live',
        minzoom: 4,
        layout: {
          'text-field': ['get', 'callsign'],
          'text-size': 9,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#89b4fa',
          'text-halo-color': '#11111b',
          'text-halo-width': 1,
        },
      });

      // ─── SHIP SYSTEM ──────────────────────────────────────────────

      // Load ship icon — military chevron/arrow pointing up
      const shipSvgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="12,2 22,18 12,14 2,18"/></svg>`;
      const shipBlob = new Blob([shipSvgStr], { type: 'image/svg+xml' });
      const shipUrl = URL.createObjectURL(shipBlob);
      const shipImg = new Image(24, 24);
      shipImg.onload = () => {
        if (!map.hasImage('ship-icon')) {
          map.addImage('ship-icon', shipImg, { sdf: true });
        }
        URL.revokeObjectURL(shipUrl);
      };
      shipImg.onerror = () => URL.revokeObjectURL(shipUrl);
      shipImg.src = shipUrl;

      // Ship positions source
      map.addSource('ships-live', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Ship icons
      map.addLayer({
        id: 'ship-icons',
        type: 'symbol',
        source: 'ships-live',
        layout: {
          'icon-image': 'ship-icon',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': 0.9,
        },
      });

      // Ship name labels (zoom >= 3)
      map.addLayer({
        id: 'ship-labels',
        type: 'symbol',
        source: 'ships-live',
        minzoom: 3,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#11111b',
          'text-halo-width': 1,
        },
      });

      // ─── MILITARY BASE ICON ───────────────────────────────────────────────
      const baseSvgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.83-3.23 9.36-7 10.57-3.77-1.21-7-5.74-7-10.57V6.3l7-3.12z"/><path d="M12 7l-1.5 3.5L7 11l3 2.5L9 17l3-2 3 2-1-3.5 3-2.5-3.5-.5z"/></svg>`;
      const baseBlob = new Blob([baseSvgStr], { type: 'image/svg+xml' });
      const baseUrl = URL.createObjectURL(baseBlob);
      const baseImg = new Image(24, 24);
      baseImg.onload = () => {
        if (!map.hasImage('base-icon')) map.addImage('base-icon', baseImg, { sdf: true });
        URL.revokeObjectURL(baseUrl);
      };
      baseImg.onerror = () => URL.revokeObjectURL(baseUrl);
      baseImg.src = baseUrl;

      // ─── NUCLEAR ICON ─────────────────────────────────────────────────────
      const nuclearSvgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="2.5"/><path d="M12 4a8 8 0 0 0-4.3 1.4l2.3 4.4c.6-.5 1.3-.8 2-.8s1.4.3 2 .8l2.3-4.4A8 8 0 0 0 12 4z"/><path d="M4.7 9.7a8 8 0 0 0 .4 4.8l4.1-.5a4 4 0 0 1-.1-2z"/><path d="M12 20a8 8 0 0 0 4.3-1.4l-2.3-4.4c-.6.5-1.3.8-2 .8s-1.4-.3-2-.8l-2.3 4.4A8 8 0 0 0 12 20z"/><path d="M19.3 9.7l-4.2 2.3c.2.6.1 1.4-.1 2l4.1.5a8 8 0 0 0 .2-4.8z"/></svg>`;
      const nuclearBlob = new Blob([nuclearSvgStr], { type: 'image/svg+xml' });
      const nuclearUrl = URL.createObjectURL(nuclearBlob);
      const nuclearImgEl = new Image(24, 24);
      nuclearImgEl.onload = () => {
        if (!map.hasImage('nuclear-icon')) map.addImage('nuclear-icon', nuclearImgEl, { sdf: true });
        URL.revokeObjectURL(nuclearUrl);
      };
      nuclearImgEl.onerror = () => URL.revokeObjectURL(nuclearUrl);
      nuclearImgEl.src = nuclearUrl;

      // ─── DISASTER ICONS ───────────────────────────────────────────────────
      const disasterIcons: Record<string, string> = {
        'disaster-fire': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>`,
        'disaster-storm': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3zM19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5zM18.5 11H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5h-2c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5z"/></svg>`,
        'disaster-earthquake': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M2 11h3.17l1.83-5 2.83 10 2.17-7 1.83 4 1.17-2h7v2h-6.17l-1.83 2-1.83-4-2.17 7-2.83-10-1.17 3H2z"/></svg>`,
        'disaster-volcano': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M2 22h20L14 8V5h1V3h-2V1h-2v2H9v2h1v3L2 22zm5.5-2L12 12.5 16.5 20h-9z"/></svg>`,
        'disaster-default': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
      };
      for (const [name, svgStr] of Object.entries(disasterIcons)) {
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image(24, 24);
        img.onload = () => {
          if (!map.hasImage(name)) map.addImage(name, img, { sdf: true });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      }

      // ─── DISASTER PULSE RINGS (on events source, behind event-icons) ────
      for (let i = 1; i <= 3; i++) {
        map.addLayer({
          id: `disaster-pulse-${i}`,
          type: 'circle',
          source: 'events',
          filter: ['==', ['get', 'category'], 'disaster'],
          layout: { visibility: 'visible' },
          paint: {
            'circle-radius': 6,
            'circle-color': 'transparent',
            'circle-opacity': 0,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': ['match', ['get', 'severity'], 4, colors[4], 3, colors[3], 2, colors[2], colors[1]],
            'circle-stroke-opacity': 0,
          },
        } as any, 'event-pulse');
      }

      // ─── MILITARY BASES SOURCE & LAYERS ───────────────────────────────────
      map.addSource('military-bases-live', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      for (let i = 1; i <= 3; i++) {
        map.addLayer({
          id: `military-pulse-${i}`,
          type: 'circle',
          source: 'military-bases-live',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 6,
            'circle-color': 'transparent',
            'circle-opacity': 0,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': 0,
          },
        } as any);
      }
      map.addLayer({
        id: 'military-base-icons',
        type: 'symbol',
        source: 'military-bases-live',
        layout: {
          visibility: 'none',
          'icon-image': 'base-icon',
          'icon-size': 0.8,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': ['get', 'color'], 'icon-opacity': 0.9 },
      });
      map.addLayer({
        id: 'military-base-labels',
        type: 'symbol',
        source: 'military-bases-live',
        minzoom: 4,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#11111b', 'text-halo-width': 1 },
      });

      // ─── NUCLEAR FACILITIES SOURCE & LAYERS ───────────────────────────────
      map.addSource('nuclear-live', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      for (let i = 1; i <= 3; i++) {
        map.addLayer({
          id: `nuclear-pulse-${i}`,
          type: 'circle',
          source: 'nuclear-live',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 6,
            'circle-color': 'transparent',
            'circle-opacity': 0,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': 0,
          },
        } as any);
      }
      map.addLayer({
        id: 'nuclear-icons',
        type: 'symbol',
        source: 'nuclear-live',
        layout: {
          visibility: 'none',
          'icon-image': 'nuclear-icon',
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': ['get', 'color'], 'icon-opacity': 0.9 },
      });
      map.addLayer({
        id: 'nuclear-labels',
        type: 'symbol',
        source: 'nuclear-live',
        minzoom: 4,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#11111b', 'text-halo-width': 1 },
      });

      // ─── PULSE ANIMATION (smooth easing) ──────────────────────────────────
      {
        let pulseStart = performance.now();
        const CYCLE_MS = 3000; // 3 second full cycle
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 2); // quadratic ease-out for smooth fade

        const animate = () => {
          const m = mapRef.current;
          if (!m?.isStyleLoaded()) { pulseIntervalRef.current = requestAnimationFrame(animate) as any; return; }

          const elapsed = performance.now() - pulseStart;
          const t = (elapsed % CYCLE_MS) / CYCLE_MS;
          const rings = [
            { phase: easeOut(t), rawPhase: t, maxR: 20, maxO: 0.4 },
            { phase: easeOut((t + 0.33) % 1), rawPhase: (t + 0.33) % 1, maxR: 20, maxO: 0.3 },
            { phase: easeOut((t + 0.66) % 1), rawPhase: (t + 0.66) % 1, maxR: 20, maxO: 0.2 },
          ];

          // Circle pulses (military, nuclear, disaster)
          const circleCategories = ['military', 'nuclear', 'disaster'];
          for (const cat of circleCategories) {
            for (let i = 0; i < 3; i++) {
              const layerId = `${cat}-pulse-${i + 1}`;
              if (!m.getLayer(layerId)) continue;
              const { phase, maxR, maxO } = rings[i];
              try {
                m.setPaintProperty(layerId, 'circle-radius', 6 + phase * maxR);
                m.setPaintProperty(layerId, 'circle-stroke-opacity', maxO * (1 - phase));
              } catch (_) {}
            }
          }

          // Diamond pulse for conflict hotspots (symbol layers)
          for (let i = 0; i < 3; i++) {
            const layerId = `conflict-hotspot-pulse-${i + 1}`;
            if (!m.getLayer(layerId)) continue;
            const { phase, maxO } = rings[i];
            try {
              m.setLayoutProperty(layerId, 'icon-size', 0.5 + phase * 0.8);
              m.setPaintProperty(layerId, 'icon-opacity', maxO * (1 - phase));
            } catch (_) {}
          }

          // Strike target pulse (red circle)
          if (m.getLayer('strike-target-pulse')) {
            const { phase, maxO } = rings[0];
            try {
              m.setPaintProperty('strike-target-pulse', 'circle-radius', 8 + phase * 20);
              m.setPaintProperty('strike-target-pulse', 'circle-stroke-opacity', maxO * (1 - phase));
            } catch (_) {}
          }

          pulseIntervalRef.current = requestAnimationFrame(animate) as any;
        };
        pulseIntervalRef.current = requestAnimationFrame(animate) as any;
      }

      // ─── SUBMARINE CABLES (real GeoJSON, 710 cables) ─────────────────────
      fetch('/data/submarine-cables.json')
        .then(r => r.json())
        .then((cableData: any) => {
          if (map.getSource('submarine-cables')) return;
          map.addSource('submarine-cables', { type: 'geojson', data: cableData });
          map.addLayer({
            id: 'submarine-cables-lines',
            type: 'line',
            source: 'submarine-cables',
            layout: { 'line-cap': 'round', visibility: 'none' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#89b4fa'],
              'line-width': 1,
              'line-opacity': 0.45,
            },
          });
        })
        .catch(() => {});

      // ─── GAS / OIL PIPELINES ─────────────────────────────────────────────
      fetch('/data/pipelines.json')
        .then(r => r.json())
        .then((pipeData: any) => {
          if (map.getSource('pipelines')) return;
          map.addSource('pipelines', { type: 'geojson', data: pipeData });
          // Solid lines
          map.addLayer({
            id: 'pipelines-lines',
            type: 'line',
            source: 'pipelines',
            filter: ['!', ['in', ['get', 'status'], ['literal', ['Destroyed', 'Decommissioned', 'Planned']]]],
            layout: { 'line-cap': 'round', visibility: 'none' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#a6e3a1'],
              'line-width': 1.5,
              'line-opacity': 0.6,
            },
          });
          // Dashed lines for destroyed/decommissioned/planned
          map.addLayer({
            id: 'pipelines-lines-dashed',
            type: 'line',
            source: 'pipelines',
            filter: ['in', ['get', 'status'], ['literal', ['Destroyed', 'Decommissioned', 'Planned']]],
            layout: { 'line-cap': 'round', visibility: 'none' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#f38ba8'],
              'line-width': 1.5,
              'line-opacity': 0.5,
              'line-dasharray': [4, 3],
            },
          });
        })
        .catch(() => {});

      // Aircraft track source (for hover/click route display)
      map.addSource('aircraft-track-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Solid line: origin airport → current position
      map.addLayer({
        id: 'aircraft-track-solid',
        type: 'line',
        source: 'aircraft-track-line',
        filter: ['==', ['get', 'segment'], 'completed'],
        paint: {
          'line-color': '#89b4fa',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
        layout: { 'line-cap': 'round' },
      });

      // Dashed line: current position → destination airport
      map.addLayer({
        id: 'aircraft-track-planned',
        type: 'line',
        source: 'aircraft-track-line',
        filter: ['==', ['get', 'segment'], 'planned'],
        paint: {
          'line-color': '#a6e3a1',
          'line-width': 1.5,
          'line-opacity': 0.55,
          'line-dasharray': [4, 3],
        },
        layout: { 'line-cap': 'round' },
      });

      // Takeoff dot
      map.addSource('aircraft-endpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'aircraft-endpoints-dots',
        type: 'circle',
        source: 'aircraft-endpoints',
        paint: {
          'circle-radius': 4,
          'circle-color': '#89b4fa',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#11111b',
        },
      });

      map.addLayer({
        id: 'aircraft-endpoints-labels',
        type: 'symbol',
        source: 'aircraft-endpoints',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#89b4fa',
          'text-halo-color': '#11111b',
          'text-halo-width': 1,
        },
      });

      // ─── STRIKE ARCS + TARGET MARKERS (created here with empty data; aiBrief effect calls setData) ───
      map.addSource('strike-arcs', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'strike-arcs-glow',
        type: 'line',
        source: 'strike-arcs',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'line-width': 3,
          'line-opacity': 0.10,
          'line-blur': 3,
        },
        layout: { 'line-cap': 'round' },
      });
      map.addLayer({
        id: 'strike-arcs-line',
        type: 'line',
        source: 'strike-arcs',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'line-width': ['match', ['get', 'severity'], 4, 1.8, 3, 1.4, 1.0],
          'line-opacity': 0.7,
          'line-dasharray': [4, 3],
        },
        layout: { 'line-cap': 'round' },
      });

      map.addSource('strike-targets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'strike-target-pulse',
        type: 'circle',
        source: 'strike-targets',
        paint: {
          'circle-radius': 12,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'circle-stroke-opacity': 0.5,
        },
      });
      map.addLayer({
        id: 'strike-target-icon',
        type: 'symbol',
        source: 'strike-targets',
        layout: {
          'icon-image': 'diamond-icon',
          'icon-size': 0.6,
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'icon-opacity': 1.0,
        },
      } as any);
      map.addLayer({
        id: 'strike-target-label',
        type: 'symbol',
        source: 'strike-targets',
        layout: {
          'text-field': ['concat', '🎯 ', ['get', 'targetName']],
          'text-size': 10,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'text-halo-color': '#11111b',
          'text-halo-width': 1.5,
        },
      } as any);

      // Click handler for strike targets (registered once in style.load)
      map.on('click', 'strike-target-icon', (e: any) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
        const popup = new mapboxgl.Popup({
          closeButton: false, closeOnClick: true, maxWidth: '300px', className: 'ww-marker-popup',
        });
        popup.setLngLat(coords).setHTML(`
          <div style="font-family: inherit; padding: 10px; background: #181825ee; backdrop-filter: blur(12px); border: 1px solid ${props.color || '#ef4444'}55; border-left: 3px solid ${props.color || '#ef4444'}; border-radius: 6px;">
            <div style="font-size: 10px; font-weight: 700; color: ${props.color || '#ef4444'}; letter-spacing: 1px; margin-bottom: 4px;">🎯 ${props.side === 'friendly' ? 'ALLIED STRIKE' : 'STRIKE TARGET'}</div>
            <div style="font-size: 12px; font-weight: 600; color: #cdd6f4; margin-bottom: 4px; line-height: 1.3;">${props.headline}</div>
            <div style="font-size: 10px; color: #6c7086; margin-bottom: 4px;">📍 ${props.targetName}</div>
            <div style="font-size: 9px; color: #9399b2; border-top: 1px solid #313244; padding-top: 4px; margin-top: 4px;">
              Corroboration: ${props.corroboration}/5 · Sources: ${props.sources}
            </div>
          </div>
        `).addTo(map);
      });
      map.on('mouseenter', 'strike-target-icon', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'strike-target-icon', () => { map.getCanvas().style.cursor = ''; });

      // ─── STRIKE ARC CLICK POPUP ───────────────────────────────────────
      map.on('click', 'strike-arcs-line', (e: any) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties;
        const color = props.color || '#ef4444';
        const sideLabel = props.side === 'friendly' ? '🟢 ALLIED STRIKE' : props.side === 'hostile' ? '🔴 HOSTILE STRIKE' : '⚠️ STRIKE';
        const sideColor = props.side === 'friendly' ? '#22c55e' : '#ef4444';
        const ts = props.timestamp ? new Date(props.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '';
        const popup = new mapboxgl.Popup({
          closeButton: true, closeOnClick: true, maxWidth: '320px', className: 'ww-focus-popup',
        });
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family: 'GeistMono', monospace; padding: 12px; background: #181825; border: 1px solid ${sideColor}55; border-left: 3px solid ${sideColor}; border-radius: 6px;">
            <div style="font-size: 10px; font-weight: 700; color: ${sideColor}; letter-spacing: 1px; margin-bottom: 6px;">${sideLabel}</div>
            <div style="font-size: 12px; font-weight: 600; color: #cdd6f4; margin-bottom: 8px; line-height: 1.3;">${props.headline}</div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 10px; color: ${sideColor};">▶ FROM:</span>
              <span style="font-size: 11px; color: #a6adc8; font-weight: 500;">${props.originName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span style="font-size: 10px; color: ${sideColor};">▶ TO:</span>
              <span style="font-size: 11px; color: #a6adc8; font-weight: 500;">${props.targetName}</span>
            </div>
            ${ts ? `<div style="font-size: 9px; color: #6c7086; margin-bottom: 4px;">🕐 ${ts}</div>` : ''}
            <div style="font-size: 9px; color: #9399b2; border-top: 1px solid #313244; padding-top: 4px; margin-top: 4px;">
              Corroboration: ${props.corroboration}/5 · Sources: ${props.sources}
            </div>
            ${props.sourceUrl ? `<div style="margin-top: 4px;"><a href="${props.sourceUrl}" target="_blank" rel="noopener" style="font-size: 9px; color: ${sideColor}; text-decoration: none;">🔗 View Source →</a></div>` : ''}
          </div>
        `).addTo(map);
      });
      map.on('mouseenter', 'strike-arcs-line', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'strike-arcs-line', () => { map.getCanvas().style.cursor = ''; });
    });

    // Click: marker stops rotation + highlights; empty space clears
    let markerClicked = false;

    // ─── DISASTER/EVENT CLICK POPUP ───────────────────────────────────────
    const disasterPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });
    disasterPopupRef.current = disasterPopup;

    map.on('click', 'event-icons', (e) => {
      markerClicked = true;
      stopRotation();
      if (!e.features?.[0]) return;
      const props = e.features[0].properties;
      const id = props?.id;
      const event = events.find(ev => ev.id === id);
      if (event) onSelect(event);
      const coords = ((e.features[0].geometry as any).coordinates as [number, number]).slice() as [number, number];
      const severity = props?.severity || 1;
      const sevColor = colors[severity] || '#cdd6f4';
      const sevLabel = severity === 4 ? 'CRITICAL' : severity === 3 ? 'HIGH' : severity === 2 ? 'MEDIUM' : 'LOW';
      const title = props?.title || 'Unknown Event';
      const country = props?.country || '';
      const category = props?.category || '';
      const srcUrl = props?.sourceUrl || '';
      const popupId = `disaster-popup-${Date.now()}`;

      disasterPopup.setLngLat(coords).setHTML(`
        <div style="
          background: ${theme.mantle}ee;
          border: 1px solid ${sevColor}55;
          border-left: 3px solid ${sevColor};
          border-radius: 6px;
          padding: 10px 12px;
          backdrop-filter: blur(12px);
          font-family: ui-monospace, monospace;
          min-width: 220px;
        ">
          <img id="${popupId}-img" class="popup-wiki-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:none;" />
          <div style="font-size: 10px; font-weight: 700; color: ${sevColor}; letter-spacing: 1px; margin-bottom: 3px;">${sevLabel}${category ? ' · ' + category.toUpperCase() : ''}</div>
          <div style="font-size: 12px; font-weight: 600; color: ${theme.text}; margin-bottom: 3px; line-height: 1.3;">${title}</div>
          <div style="font-size: 10px; color: ${theme.overlay0}; margin-bottom: 4px;">📍 ${country}</div>
          ${srcUrl ? `<div style="border-top: 1px solid ${theme.surface0}; padding-top: 6px; font-size: 9px;"><a href="${srcUrl}" target="_blank" rel="noopener" style="color: ${sevColor}; text-decoration: none; opacity: 0.8;">🔗 SOURCE ↗</a></div>` : ''}
        </div>
      `).addTo(map);

      if (country) {
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(country.replace(/\s/g, '_'))}`)
          .then(r => r.json())
          .then((d: any) => {
            const imgEl = document.getElementById(`${popupId}-img`) as HTMLImageElement | null;
            if (d.thumbnail?.source && imgEl) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; }
          })
          .catch(() => {});
      }
    });

    // General click: clear country highlight (aircraft dismiss handled after aircraft section)

    // Hover popup
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });
    hoverPopupRef.current = popup;

    map.on('mouseenter', 'event-icons', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
      const severity = props?.severity || 1;
      const sevLabel = severity === 4 ? 'CRITICAL' : severity === 3 ? 'HIGH' : severity === 2 ? 'MEDIUM' : 'LOW';
      const sevColor = colors[severity] || '#cdd6f4';
      const srcUrl = props?.sourceUrl || '';
      const srcLink = srcUrl ? `<a href="${srcUrl}" target="_blank" rel="noopener" style="font-size: 9px; color: ${theme.blue}; text-decoration: none; margin-top: 4px; display: block;">🔗 SOURCE ↗</a>` : '';
      popup.setLngLat(coords).setHTML(`
        <div style="
          background: ${theme.mantle};
          border: 1px solid ${theme.surface0};
          border-left: 3px solid ${sevColor};
          padding: 8px 10px;
          font-family: inherit;
          max-width: 260px;
        ">
          <div style="font-size: 10px; font-weight: 700; color: ${sevColor}; letter-spacing: 1px; margin-bottom: 4px;">
            ${sevLabel}
          </div>
          <div style="font-size: 12px; font-weight: 600; color: ${theme.text}; margin-bottom: 4px; line-height: 1.3;">
            ${props?.title || 'Unknown Event'}
          </div>
          <div style="font-size: 10px; color: ${theme.overlay0};">
            📍 ${props?.country || 'Unknown'}
          </div>
          ${srcLink}
        </div>
      `).addTo(map);
    });

    map.on('mouseleave', 'event-icons', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    // ─── AIRCRAFT INTERACTION ──────────────────────────────────────────
    let pinnedAircraft: string | null = null;

    const acPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      className: 'ww-marker-popup',
    });

    function clearAircraftRoute() {
      try {
        const trackSrc = map.getSource('aircraft-track-line') as mapboxgl.GeoJSONSource | undefined;
        const endSrc = map.getSource('aircraft-endpoints') as mapboxgl.GeoJSONSource | undefined;
        if (trackSrc) trackSrc.setData({ type: 'FeatureCollection', features: [] });
        if (endSrc) endSrc.setData({ type: 'FeatureCollection', features: [] });
      } catch (_) {}
    }

    function showAircraftRouteFromAirports(
      acLng: number, acLat: number,
      originIata: string, destIata: string,
      acColor: string = '#89b4fa',
    ) {
      try {
        const trackSrc = map.getSource('aircraft-track-line') as mapboxgl.GeoJSONSource | undefined;
        const endSrc = map.getSource('aircraft-endpoints') as mapboxgl.GeoJSONSource | undefined;
        if (!trackSrc || !endSrc) return;

        const trackFeatures: any[] = [];
        const endpointFeatures: any[] = [];

        const dbSize = Object.keys(airportRef.current).length;
        const originData = originIata ? airportRef.current[originIata] : undefined;
        const destData = destIata ? airportRef.current[destIata] : undefined;
        const originCoords: [number, number] | undefined = originData ? [originData[0], originData[1]] : undefined;
        const destCoords: [number, number] | undefined = destData ? [destData[0], destData[1]] : undefined;

        // Solid line: origin → current aircraft position
        if (originCoords) {
          trackFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [originCoords, [acLng, acLat]] },
            properties: { segment: 'completed' },
          });
          const originName = originData?.[2] || originIata;
          endpointFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: originCoords },
            properties: { label: `FROM: ${originIata} ${originName}` },
          });
        }

        // Dashed line: current aircraft position → destination
        if (destCoords) {
          trackFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[acLng, acLat], destCoords] },
            properties: { segment: 'planned' },
          });
          const destName = destData?.[2] || destIata;
          endpointFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: destCoords },
            properties: { label: `TO: ${destIata} ${destName}` },
          });
        }

        trackSrc.setData({ type: 'FeatureCollection', features: trackFeatures });
        endSrc.setData({ type: 'FeatureCollection', features: endpointFeatures });

        // Match route color to aircraft color
        try {
          if (map.getLayer('aircraft-track-solid')) map.setPaintProperty('aircraft-track-solid', 'line-color', acColor);
          if (map.getLayer('aircraft-track-planned')) map.setPaintProperty('aircraft-track-planned', 'line-color', acColor);
          if (map.getLayer('aircraft-endpoints-dots')) map.setPaintProperty('aircraft-endpoints-dots', 'circle-color', acColor);
          if (map.getLayer('aircraft-endpoints-labels')) map.setPaintProperty('aircraft-endpoints-labels', 'text-color', acColor);
        } catch (_) {}
      } catch (_) {}
    }

    function getAirForceLabel(airForce: string): string {
      const labels: Record<string, string> = {
        'USAF': '🇺🇸 USAF',
        'RAF': '🇬🇧 RAF',
        'Luftwaffe': '🇩🇪 Luftwaffe',
        'RCAF': '🇨🇦 RCAF',
        'Armée de l\'Air': '🇫🇷 Armée de l\'Air',
        'VKS (Russia)': '🇷🇺 VKS (Russia)',
        'IRIAF (Iran)': '🇮🇷 IRIAF (Iran)',
        'IqAF (Iraq)': '🇮🇶 IqAF (Iraq)',
        'PLAAF (China)': '🇨🇳 PLAAF (China)',
        'PAF (Pakistan)': '🇵🇰 PAF (Pakistan)',
        'NATO': '🔷 NATO',
        'TurAF': '🇹🇷 TurAF',
        'JASDF': '🇯🇵 JASDF',
        'ROKAF': '🇰🇷 ROKAF',
        'RAAF': '🇦🇺 RAAF',
        'IAF (India)': '🇮🇳 IAF (India)',
      };
      return labels[airForce] || `${airForce || 'Military'}`;
    }

    function getAircraftSIDC(airForce: string): string {
      const hostile = ['VKS (Russia)', 'IRIAF (Iran)', 'PLAAF (China)'];
      const neutral = ['IqAF (Iraq)', 'PAF (Pakistan)', 'Military'];
      if (hostile.includes(airForce)) return 'SHAPCF----';
      if (neutral.includes(airForce)) return 'SNAPCF----';
      if (airForce && !neutral.includes(airForce)) return 'SFAPCF----';
      return 'SUAPCF----';
    }

    // Hover: only change cursor (no popup on hover anymore)
    map.on('mouseenter', 'aircraft-icons', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'aircraft-icons', () => {
      map.getCanvas().style.cursor = '';
    });

    // Click aircraft: show popup + show origin/dest route
    map.on('click', 'aircraft-icons', (e) => {
      markerClicked = true;
      stopRotation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
      const icao = props?.icao24 || '';
      const acColor = props?.color || '#89b4fa';

      // Look up full aircraft info from FR24 data
      const acInfo = aircraftDataRef?.current?.get(icao);
      const callsign = acInfo?.callsign || props?.callsign || 'UNKNOWN';
      const fl = Math.round((acInfo?.altitude || props?.altitude || 0) / 30.48);
      const velocity = acInfo?.velocity || props?.velocity || 0;
      const heading = acInfo?.heading || props?.heading || 0;
      const aircraftType = acInfo?.aircraftType || '';
      const registration = acInfo?.registration || '';
      const origin = acInfo?.origin || '';
      const destination = acInfo?.destination || '';
      const airForce = acInfo?.airForce || 'Military';
      const airForceLabel = getAirForceLabel(airForce);

      const originName = origin ? (airportRef.current[origin]?.[2] || origin) : '';
      const destName = destination ? (airportRef.current[destination]?.[2] || destination) : '';

      pinnedAircraft = icao;

      const popupId = `ac-popup-${icao}`;
      const fr24Link = `https://www.flightradar24.com/${callsign.toLowerCase()}`;

      // Generate NATO milsymbol for aircraft
      let acNatoSvg = '';
      try {
        const acSidc = getAircraftSIDC(airForce);
        const acSym = new ms.Symbol(acSidc, { size: 30, frame: true, fill: true });
        acNatoSvg = acSym.asSVG();
      } catch (_) {}

      acPopup.setLngLat(coords).setHTML(`
        <div id="${popupId}" style="
          background: ${theme.mantle}dd;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid ${theme.surface0}88;
          border-left: 3px solid ${acColor};
          padding: 8px 10px;
          font-family: inherit;
          width: 270px;
        ">
          ${acNatoSvg ? `<div style="text-align: center; margin-bottom: 6px;">${acNatoSvg}</div>` : ''}
          <div id="${popupId}-img" style="margin-bottom: 6px;"></div>
          <div style="font-size: 11px; font-weight: 700; color: ${acColor}; letter-spacing: 1px; margin-bottom: 3px;">
            ✈ ${callsign}
          </div>
          ${aircraftType ? `<div style="font-size: 10px; color: ${acColor}; font-weight: 600; margin-bottom: 2px;">${aircraftType}${registration ? ` · ${registration}` : ''}</div>` : (registration ? `<div style="font-size: 10px; color: ${theme.subtext0}; margin-bottom: 2px;">${registration}</div>` : '')}
          <div style="font-size: 11px; color: ${theme.text}; margin-bottom: 3px;">${airForceLabel}</div>
          <div style="font-size: 10px; color: ${theme.overlay0}; display: flex; gap: 10px; margin-bottom: 4px;">
            <span>FL${fl}</span>
            <span>${velocity} kt</span>
            <span>HDG ${heading}°</span>
          </div>
          ${origin ? `<div style="font-size: 9px; color: ${acColor}; margin-bottom: 1px;">FROM: ${origin}${originName !== origin ? ` (${originName})` : ''}</div>` : ''}
          ${destination ? `<div style="font-size: 9px; color: ${acColor}; opacity: 0.7; margin-bottom: 2px;">TO: ${destination}${destName !== destination ? ` (${destName})` : ''}</div>` : ''}
        </div>
      `).addTo(map);

      // Async: fetch aircraft photo from Planespotters
      if (icao) {
        fetch(`https://api.planespotters.net/pub/photos/hex/${icao}`)
          .then(r => r.json())
          .catch(() => ({ photos: [] }))
          .then((psData: any) => {
            const photos = psData?.photos || [];
            const imgEl = document.getElementById(`${popupId}-img`);
            if (photos.length > 0 && imgEl) {
              const photo = photos[0];
              const src = photo.thumbnail_large?.src || photo.thumbnail?.src;
              if (src) {
                imgEl.innerHTML = `<img src="${src}" style="width: 100%; height: auto; border-radius: 3px; border: 1px solid ${theme.surface1};" />`;
              }
            }
          });
      }

      // Show origin/destination route on map (only if we have coordinates for the airports)
      showAircraftRouteFromAirports(coords[0], coords[1], origin, destination, acColor);
    });

    // ─── SUBMARINE CABLE HOVER ───────────────────────────────────────────────
    map.on('mouseenter', 'submarine-cables-lines', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features?.[0] || !hoverPopupRef.current) return;
      const props = e.features[0].properties as { name?: string; color?: string } | null;
      const coords = e.lngLat;
      hoverPopupRef.current.setLngLat(coords).setHTML(`
        <div style="background: ${theme.mantle}; border: 1px solid ${props?.color || theme.blue}55; border-left: 3px solid ${props?.color || theme.blue}; padding: 6px 10px; font-family: inherit;">
          <div style="font-size: 11px; font-weight: 700; color: ${props?.color || theme.blue};">🌊 ${props?.name || 'Submarine Cable'}</div>
        </div>
      `).addTo(map);
    });
    map.on('mouseleave', 'submarine-cables-lines', () => {
      map.getCanvas().style.cursor = '';
      hoverPopupRef.current?.remove();
    });

    // ─── PIPELINE HOVER ──────────────────────────────────────────────────────
    const pipelineHover = (e: mapboxgl.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features?.[0] || !hoverPopupRef.current) return;
      const props = e.features[0].properties as { name?: string; type?: string; status?: string; route?: string; color?: string } | null;
      const color = props?.color || '#a6e3a1';
      hoverPopupRef.current.setLngLat(e.lngLat).setHTML(`
        <div style="background: ${theme.mantle}; border: 1px solid ${color}55; border-left: 3px solid ${color}; padding: 6px 10px; font-family: inherit;">
          <div style="font-size: 11px; font-weight: 700; color: ${color};">${props?.type === 'gas' ? '⛽' : props?.type === 'oil' ? '🛢️' : props?.type === 'power' ? '⚡' : '🔧'} ${props?.name || 'Pipeline'}</div>
          ${props?.status ? `<div style="font-size: 9px; color: ${theme.overlay0}; margin-top: 2px;">${props.status} · ${props.route || ''}</div>` : ''}
        </div>
      `).addTo(map);
    };
    map.on('mouseenter', 'pipelines-lines', pipelineHover);
    map.on('mouseenter', 'pipelines-lines-dashed', pipelineHover);
    map.on('mouseleave', 'pipelines-lines', () => { map.getCanvas().style.cursor = ''; hoverPopupRef.current?.remove(); });
    map.on('mouseleave', 'pipelines-lines-dashed', () => { map.getCanvas().style.cursor = ''; hoverPopupRef.current?.remove(); });

    // ─── SHIPS CLICK POPUP ────────────────────────────────────────────────────
    // Ships use dedicated ship-icons symbol layer (not generic circles)
    const shipPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      className: 'ww-marker-popup',
    });

    map.on('click', 'ship-icons', (e) => {
      if (!e.features?.[0]) return;
      markerClicked = true;

      const props = e.features[0].properties as {
        label?: string; subLabel?: string; color?: string; meta?: string;
      } | null;
      const coords = ((e.features[0].geometry as any).coordinates as [number, number]).slice() as [number, number];

      let meta: Record<string, any> = {};
      try { meta = JSON.parse(props?.meta || '{}'); } catch (_) {}

      const compositionLines = meta.composition
        ? meta.composition.split(', ').map((s: string) => `<div style="font-size: 9px; color: ${theme.overlay0}; padding: 1px 0;">› ${s}</div>`).join('')
        : '';

      const color = props?.color || theme.blue;

      // Generate NATO milsymbol SVG
      let natoSvg = '';
      try {
        const sidc = meta.sidc || 'SFSPCLCC--';
        const sym = new ms.Symbol(sidc, { size: 40, frame: true, fill: true });
        natoSvg = sym.asSVG();
      } catch (_) {}

      const shipImageUrl = meta.imageUrl || '';
      const shipWikiUrl = meta.wikiUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent((meta.flagship || props?.label || '').replace(/\s/g, '_'))}`;

      shipPopup.setLngLat(coords).setHTML(`
        <div style="
          background: ${theme.mantle}ee;
          border: 1px solid ${color}55;
          border-radius: 6px;
          padding: 10px 12px;
          backdrop-filter: blur(12px);
          font-family: ui-monospace, monospace;
          min-width: 240px;
        ">
          ${natoSvg ? `<div style="text-align: center; margin-bottom: 8px;">${natoSvg}</div>` : ''}
          <img class="popup-wiki-img" src="${shipImageUrl || ''}" onerror="this.style.display='none'" onload="this.style.display='block'" style="width: 100%; max-height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px; border: 1px solid ${color}33; display: ${shipImageUrl ? 'block' : 'none'};" />
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="font-size: 18px;">${meta.countryFlag || '🚢'}</span>
            <div>
              <div style="font-size: 11px; font-weight: 700; color: ${color}; letter-spacing: 0.5px;">${props?.label || ''}</div>
              <div style="font-size: 9px; color: ${theme.overlay0}; margin-top: 1px;">${meta.shipType || meta.type?.replace(/-/g, ' ').toUpperCase() || 'NAVAL UNIT'}</div>
            </div>
          </div>
          <div style="border-top: 1px solid ${theme.surface0}; padding-top: 6px; margin-bottom: 4px;">
            <div style="font-size: 10px; color: ${theme.subtext0}; margin-bottom: 2px;">⚓ ${meta.flagship || ''}</div>
            <div style="font-size: 10px; color: ${theme.overlay0};">📍 ${meta.region || ''} — ${meta.status || ''}</div>
          </div>
          <div style="
            display: inline-block;
            margin: 4px 0;
            padding: 2px 6px;
            background: ${color}22;
            border: 1px solid ${color}44;
            border-radius: 3px;
            font-size: 9px;
            color: ${color};
            font-weight: 700;
            letter-spacing: 0.5px;
          ">${meta.status || 'UNKNOWN'}</div>
          ${compositionLines ? `
          <div style="margin-top: 6px; border-top: 1px solid ${theme.surface0}; padding-top: 4px;">
            <div style="font-size: 9px; color: ${theme.overlay0}; margin-bottom: 2px; letter-spacing: 0.5px;">COMPOSITION</div>
            ${compositionLines}
          </div>` : ''}
          ${meta.notes ? `<div style="margin-top: 4px; font-size: 9px; color: ${theme.subtext0}; font-style: italic;">${meta.notes}</div>` : ''}
          <div style="margin-top: 8px; border-top: 1px solid ${theme.surface0}; padding-top: 6px; display: flex; gap: 8px; font-size: 9px;">
            <a href="${shipWikiUrl}" target="_blank" style="color: ${color}; text-decoration: none; opacity: 0.8;">Wikipedia ↗</a>
            <a href="https://news.usni.org/category/fleet-tracker" target="_blank" style="color: ${theme.overlay0}; text-decoration: none; opacity: 0.8;">USNI Fleet ↗</a>
          </div>
        </div>
      `).addTo(map);

      // Wikipedia API fallback for image if direct URL failed or missing
      if (!shipImageUrl && meta.flagship) {
        const el = shipPopup.getElement();
        const imgEl = el?.querySelector('.popup-wiki-img') as HTMLImageElement | null;
        if (imgEl) {
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(meta.flagship.replace(/\s/g, '_'))}`)
            .then(r => r.json())
            .then(d => { if (d.thumbnail?.source) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; } })
            .catch(() => {});
        }
      }
    });

    map.on('mouseenter', 'ship-icons', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'ship-icons', () => {
      map.getCanvas().style.cursor = '';
    });
    // ─────────────────────────────────────────────────────────────────────────

    // ─── MILITARY BASE CLICK POPUP ────────────────────────────────────────
    const basePopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      className: 'ww-marker-popup',
    });
    militaryPopupRef.current = basePopup;

    map.on('click', 'military-base-icons', (e) => {
      if (!e.features?.[0]) return;
      markerClicked = true;
      stopRotation();
      const props = e.features[0].properties as { label?: string; subLabel?: string; color?: string } | null;
      const coords = ((e.features[0].geometry as any).coordinates as [number, number]).slice() as [number, number];
      const label = props?.label || '';
      const subLabel = props?.subLabel || '';
      const color = props?.color || '#89b4fa';
      const hostileColors = ['#f38ba8', '#fab387'];
      const affiliation = hostileColors.includes(color) ? 'SH' : 'SF';
      const sidc = `${affiliation}GPUCA---`;
      let natoSvg = '';
      try { const sym = new ms.Symbol(sidc, { size: 30, frame: true, fill: true }); natoSvg = sym.asSVG(); } catch (_) {}
      const wikiTitle = label.replace(/\s/g, '_');
      const popupId = `base-popup-${Date.now()}`;

      basePopup.setLngLat(coords).setHTML(`
        <div style="background:${theme.mantle}ee;border:1px solid ${color}55;border-radius:6px;padding:10px 12px;backdrop-filter:blur(12px);font-family:ui-monospace,monospace;min-width:220px;">
          ${natoSvg ? `<div style="text-align:center;margin-bottom:6px;">${natoSvg}</div>` : ''}
          <img id="${popupId}-img" style="width:100%;max-height:100px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:none;" />
          <div style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.5px;margin-bottom:3px;">🛡 ${label}</div>
          <div style="font-size:10px;color:${theme.subtext0};margin-bottom:4px;">${subLabel}</div>
          <div style="border-top:1px solid ${theme.surface0};padding-top:6px;font-size:9px;">
            <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}" target="_blank" style="color:${color};text-decoration:none;opacity:0.8;">Wikipedia ↗</a>
          </div>
        </div>
      `).addTo(map);

      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`)
        .then(r => r.json())
        .then((d: any) => {
          const imgEl = document.getElementById(`${popupId}-img`) as HTMLImageElement | null;
          if (d.thumbnail?.source && imgEl) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; }
        }).catch(() => {});
    });

    map.on('mouseenter', 'military-base-icons', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'military-base-icons', () => { map.getCanvas().style.cursor = ''; });

    // ─── NUCLEAR FACILITY CLICK POPUP ─────────────────────────────────────
    const nucPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      className: 'ww-marker-popup',
    });
    nuclearPopupRef.current = nucPopup;

    map.on('click', 'nuclear-icons', (e) => {
      if (!e.features?.[0]) return;
      markerClicked = true;
      stopRotation();
      const props = e.features[0].properties as { label?: string; subLabel?: string; color?: string } | null;
      const coords = ((e.features[0].geometry as any).coordinates as [number, number]).slice() as [number, number];
      const label = props?.label || '';
      const subLabel = props?.subLabel || '';
      const color = props?.color || '#f9e2af';

      // Determine facility type from color: yellow=power-plant, peach=enrichment, red=weapons-lab
      const facilityType = color === '#f38ba8' ? 'weapons-lab' : color === '#fab387' ? 'enrichment' : 'power-plant';
      const typeIcon = facilityType === 'weapons-lab' ? '⚠' : facilityType === 'enrichment' ? '⚛' : '☢';
      const typeLabel = facilityType === 'weapons-lab' ? 'WEAPONS LAB / TEST SITE' : facilityType === 'enrichment' ? 'ENRICHMENT FACILITY' : 'POWER PLANT';

      // NATO symbol: hostile if weapons-lab in adversary countries, neutral for enrichment, friendly for power-plant
      const affiliation = facilityType === 'weapons-lab' ? 'SN' : facilityType === 'enrichment' ? 'SN' : 'SF';
      const sidc = `${affiliation}GPII-----`;
      let natoSvg = '';
      try { const sym = new ms.Symbol(sidc, { size: 30, frame: true, fill: true }); natoSvg = sym.asSVG(); } catch (_) {}

      // Wiki search varies by type
      const wikiSuffix = facilityType === 'enrichment' ? '' : facilityType === 'weapons-lab' ? '' : ' nuclear power plant';
      const wikiSearchName = `${label}${wikiSuffix}`;
      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(label.replace(/\s/g, '_'))}`;
      const popupId = `nuc-popup-${Date.now()}`;

      nucPopup.setLngLat(coords).setHTML(`
        <div style="background:${theme.mantle}ee;border:1px solid ${color}55;border-radius:6px;padding:10px 12px;backdrop-filter:blur(12px);font-family:ui-monospace,monospace;min-width:220px;">
          ${natoSvg ? `<div style="text-align:center;margin-bottom:6px;">${natoSvg}</div>` : ''}
          <img id="${popupId}-img" style="width:100%;max-height:100px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:none;" />
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.5px;">${typeIcon} ${label}</span>
          </div>
          <div style="display:inline-block;font-size:8px;padding:1px 5px;background:${color}22;border:1px solid ${color}44;border-radius:3px;color:${color};font-weight:700;letter-spacing:0.8px;margin-bottom:4px;">${typeLabel}</div>
          <div style="font-size:10px;color:${theme.subtext0};margin-bottom:4px;">${subLabel}</div>
          <div style="border-top:1px solid ${theme.surface0};padding-top:6px;font-size:9px;">
            <a href="${wikiUrl}" target="_blank" style="color:${color};text-decoration:none;opacity:0.8;">Wikipedia ↗</a>
          </div>
        </div>
      `).addTo(map);

      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiSearchName.replace(/\s/g, '_'))}`)
        .then(r => r.json())
        .then((d: any) => {
          const imgEl = document.getElementById(`${popupId}-img`) as HTMLImageElement | null;
          if (d.thumbnail?.source && imgEl) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; }
        }).catch(() => {});
    });

    map.on('mouseenter', 'nuclear-icons', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'nuclear-icons', () => { map.getCanvas().style.cursor = ''; });

    // ─── SUBMARINE CABLE CLICK POPUP ──────────────────────────────────────
    const cablePopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });
    cableClickPopupRef.current = cablePopup;

    map.on('click', 'submarine-cables-lines', (e) => {
      markerClicked = true;
      if (!e.features?.[0]) return;
      const props = e.features[0].properties as { name?: string; color?: string } | null;
      const color = props?.color || theme.blue;
      const label = props?.name || 'Submarine Cable';
      const popupId = `cable-popup-${Date.now()}`;

      cablePopup.setLngLat(e.lngLat).setHTML(`
        <div style="background:${theme.mantle}ee;border:1px solid ${color}55;border-radius:6px;padding:10px 12px;backdrop-filter:blur(12px);font-family:ui-monospace,monospace;min-width:200px;">
          <img id="${popupId}-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:none;" />
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:6px;">🌊 ${label}</div>
          <div style="border-top:1px solid ${theme.surface0};padding-top:6px;font-size:9px;display:flex;gap:8px;">
            <a href="https://www.submarinecablemap.com" target="_blank" style="color:${color};text-decoration:none;opacity:0.8;">Cable Map ↗</a>
            <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(label.replace(/\s/g, '_'))}" target="_blank" style="color:${theme.overlay0};text-decoration:none;opacity:0.8;">Wikipedia ↗</a>
          </div>
        </div>
      `).addTo(map);

      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(label.replace(/\s/g, '_'))}`)
        .then(r => r.json())
        .then((d: any) => {
          const imgEl = document.getElementById(`${popupId}-img`) as HTMLImageElement | null;
          if (d.thumbnail?.source && imgEl) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; }
        }).catch(() => {});
    });

    // ─── PIPELINE CLICK POPUP ─────────────────────────────────────────────
    const pipePopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });
    pipelineClickPopupRef.current = pipePopup;

    const pipelineClick = (e: mapboxgl.MapLayerMouseEvent) => {
      markerClicked = true;
      if (!e.features?.[0]) return;
      const props = e.features[0].properties as { name?: string; type?: string; status?: string; route?: string; color?: string; operator?: string } | null;
      const color = props?.color || '#a6e3a1';
      const label = props?.name || 'Pipeline';
      const statusColor = props?.status === 'Active' ? '#a6e3a1' : (props?.status === 'Destroyed' || props?.status === 'Decommissioned') ? '#f38ba8' : '#cba6f7';
      const popupId = `pipe-popup-${Date.now()}`;

      pipePopup.setLngLat(e.lngLat).setHTML(`
        <div style="background:${theme.mantle}ee;border:1px solid ${color}55;border-radius:6px;padding:10px 12px;backdrop-filter:blur(12px);font-family:ui-monospace,monospace;min-width:200px;">
          <img id="${popupId}-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:none;" />
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:3px;">${props?.type === 'gas' ? '⛽' : props?.type === 'oil' ? '🛢️' : '🔧'} ${label}</div>
          ${props?.route ? `<div style="font-size:10px;color:${theme.overlay0};margin-bottom:3px;">${props.route}</div>` : ''}
          ${props?.operator ? `<div style="font-size:10px;color:${theme.subtext0};margin-bottom:3px;">Op: ${props.operator}</div>` : ''}
          ${props?.status ? `<div style="display:inline-block;padding:2px 6px;background:${statusColor}22;border:1px solid ${statusColor}44;border-radius:3px;font-size:9px;color:${statusColor};font-weight:700;margin-bottom:4px;">${props.status}</div>` : ''}
          <div style="border-top:1px solid ${theme.surface0};padding-top:6px;font-size:9px;">
            <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(label.replace(/\s/g, '_'))}" target="_blank" style="color:${color};text-decoration:none;opacity:0.8;">Wikipedia ↗</a>
          </div>
        </div>
      `).addTo(map);

      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(label.replace(/\s/g, '_'))}`)
        .then(r => r.json())
        .then((d: any) => {
          const imgEl = document.getElementById(`${popupId}-img`) as HTMLImageElement | null;
          if (d.thumbnail?.source && imgEl) { imgEl.src = d.thumbnail.source; imgEl.style.display = 'block'; }
        }).catch(() => {});
    };

    map.on('click', 'pipelines-lines', pipelineClick);
    map.on('click', 'pipelines-lines-dashed', pipelineClick);

    // Click empty space: dismiss aircraft popup + clear route + clear country highlight
    map.on('click', () => {
      setTimeout(() => {
        if (markerClicked) { markerClicked = false; return; }
        // Clear country highlight — but keep it if a conflict event is still selected (permanent warzone highlight)
        if (focusEvent?.category !== 'conflict') {
          try {
            if (map.getLayer('country-highlight-fill')) map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
            if (map.getLayer('country-highlight-line')) map.setFilter('country-highlight-line', ['==', 'name_en', '']);
          } catch (_) {}
        }
        // Dismiss aircraft popup/route
        if (pinnedAircraft) {
          pinnedAircraft = null;
          acPopup.remove();
          clearAircraftRoute();
        }
        // Dismiss other popups
        shipPopup.remove();
        conflictPopupRef.current?.remove();
        hotspotPopupRef.current?.remove();
        disasterPopup.remove();
        basePopup.remove();
        nucPopup.remove();
        cablePopup.remove();
        pipePopup.remove();
        newsPopupRef.current?.remove();
      }, 60);
    });

    // Stop rotation on user interaction (no auto-resume)
    map.on('mousedown', stopRotation);
    map.on('touchstart', stopRotation);
    map.on('wheel', stopRotation);

    // Start rotating on load
    map.on('load', startRotation);

    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current);
      if (pulseIntervalRef.current) { cancelAnimationFrame(pulseIntervalRef.current as any); pulseIntervalRef.current = null; }
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // Update events source when filter changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('events') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: geoEvents.map(ev => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [ev.lng, ev.lat] },
        properties: { id: ev.id, severity: ev.severity, title: ev.title, country: ev.country, category: ev.category, sourceUrl: ev.sourceUrl || '', disasterType: getDisasterType(ev.title, ev.category) },
      })),
    });
  }, [events]); // eslint-disable-line

  // Ref for focus pulse marker + popup (cleaned up on next focus or unmount)
  const focusPulseRef = useRef<{ marker: mapboxgl.Marker; popup: mapboxgl.Popup; animId: number } | null>(null);

  // Focus event — triggered by focusCounter to allow re-selecting same event
  useEffect(() => {
    if (!mapRef.current || !focusEvent || focusCounter === 0) return;
    const map = mapRef.current;

    stopRotation();

    // Clean up previous focus pulse
    if (focusPulseRef.current) {
      cancelAnimationFrame(focusPulseRef.current.animId);
      focusPulseRef.current.marker.remove();
      focusPulseRef.current.popup.remove();
      focusPulseRef.current = null;
    }

    map.flyTo({
      center: [focusEvent.lng, focusEvent.lat],
      zoom: 5,
      duration: 1500,
      essential: true,
    });

    const countryName = COUNTRY_NAME_MAP[focusEvent.country] || focusEvent.country;
    const sevColor = colors[focusEvent.severity];

    try {
      if (map.getLayer('country-highlight-fill')) {
        map.setFilter('country-highlight-fill', ['==', 'name_en', countryName]);
        map.setPaintProperty('country-highlight-fill', 'fill-color', sevColor);
      }
      if (map.getLayer('country-highlight-line')) {
        map.setFilter('country-highlight-line', ['==', 'name_en', countryName]);
        map.setPaintProperty('country-highlight-line', 'line-color', sevColor);
      }
    } catch (_) {}

    // ─── FOCUS PULSE RING (animated expanding rings at event location) ────
    const pulseEl = document.createElement('div');
    pulseEl.style.cssText = 'width:80px;height:80px;position:relative;pointer-events:none;';
    // 3 concentric rings
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = `focus-ring-${i}`;
      ring.style.cssText = `
        position:absolute;top:50%;left:50%;
        width:10px;height:10px;
        margin:-5px 0 0 -5px;
        border-radius:50%;
        border:2px solid ${sevColor};
        opacity:0;
        pointer-events:none;
      `;
      pulseEl.appendChild(ring);
    }
    // Center dot
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute;top:50%;left:50%;
      width:8px;height:8px;margin:-4px 0 0 -4px;
      border-radius:50%;
      background:${sevColor};
      box-shadow:0 0 8px ${sevColor};
    `;
    pulseEl.appendChild(dot);

    const focusMarker = new mapboxgl.Marker({ element: pulseEl, anchor: 'center' })
      .setLngLat([focusEvent.lng, focusEvent.lat])
      .addTo(map);

    // Animate pulse rings
    const startTime = performance.now();
    const CYCLE = 2500;
    let animId: number;
    const animatePulse = () => {
      const elapsed = performance.now() - startTime;
      const t = (elapsed % CYCLE) / CYCLE;
      for (let i = 0; i < 3; i++) {
        const ring = pulseEl.querySelector(`.focus-ring-${i}`) as HTMLElement;
        if (!ring) continue;
        const phase = (t + i * 0.33) % 1;
        const size = 10 + phase * 60;
        const opacity = 0.6 * (1 - phase);
        ring.style.width = ring.style.height = `${size}px`;
        ring.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
        ring.style.opacity = `${opacity}`;
        ring.style.borderColor = sevColor;
      }
      animId = requestAnimationFrame(animatePulse);
    };
    animId = requestAnimationFrame(animatePulse);

    // ─── DISMISS ALL OTHER POPUPS (prevent overlap) ────────────────────
    [hoverPopupRef, militaryPopupRef, nuclearPopupRef, cableClickPopupRef,
     pipelineClickPopupRef, disasterPopupRef, newsPopupRef, conflictPopupRef,
     hotspotPopupRef].forEach(ref => { try { ref.current?.remove(); } catch (_) {} });

    // ─── FOCUS POPUP (event details at location) ────────────────────────
    const sevLabel = focusEvent.severity === 4 ? 'CRITICAL' : focusEvent.severity === 3 ? 'HIGH' : focusEvent.severity === 2 ? 'MEDIUM' : 'LOW';
    const sourceLine = focusEvent.source && focusEvent.source !== 'AI Brief' ? `<div style="font-size:10px;color:#a6adc8;margin-top:4px;">via ${focusEvent.source}</div>` : '';

    const focusPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
      className: 'ww-focus-popup',
      offset: [0, -20],
    })
      .setLngLat([focusEvent.lng, focusEvent.lat])
      .setHTML(`
        <div style="font-family:'Geist Mono',monospace;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:${sevColor};letter-spacing:1px;">${sevLabel}</span>
            <span style="font-size:11px;color:#a6adc8;">📍 ${focusEvent.country || ''}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:#cdd6f4;line-height:1.4;">
            ${focusEvent.title}
          </div>
          ${focusEvent.description && focusEvent.description !== focusEvent.title ? `<div style="font-size:11px;color:#bac2de;margin-top:6px;line-height:1.4;">${focusEvent.description}</div>` : ''}
          ${sourceLine}
        </div>
      `)
      .addTo(map);

    // When popup is closed manually, also remove the pulse marker
    focusPopup.on('close', () => {
      if (focusPulseRef.current?.popup === focusPopup) {
        cancelAnimationFrame(focusPulseRef.current.animId);
        focusPulseRef.current.marker.remove();
        focusPulseRef.current = null;
      }
    });

    focusPulseRef.current = { marker: focusMarker, popup: focusPopup, animId };

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (focusPulseRef.current?.animId === animId) {
        cancelAnimationFrame(animId);
        focusMarker.remove();
        focusPopup.remove();
        focusPulseRef.current = null;
      }
    }, 30000);
  }, [focusCounter]); // eslint-disable-line

  // Permanent country highlight — stays visible as long as a conflict event is selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyHighlight = () => {
      if (focusEvent?.category === 'conflict') {
        const countryName = COUNTRY_NAME_MAP[focusEvent.country] || focusEvent.country;
        const sevColor = colors[focusEvent.severity];
        try {
          if (map.getLayer('country-highlight-fill')) {
            map.setFilter('country-highlight-fill', ['==', 'name_en', countryName]);
            map.setPaintProperty('country-highlight-fill', 'fill-color', sevColor);
            map.setPaintProperty('country-highlight-fill', 'fill-opacity', 0.10);
          }
          if (map.getLayer('country-highlight-line')) {
            map.setFilter('country-highlight-line', ['==', 'name_en', countryName]);
            map.setPaintProperty('country-highlight-line', 'line-color', sevColor);
            map.setPaintProperty('country-highlight-line', 'line-opacity', 0.5);
          }
        } catch (_) {}
      } else {
        try {
          if (map.getLayer('country-highlight-fill')) map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
          if (map.getLayer('country-highlight-line')) map.setFilter('country-highlight-line', ['==', 'name_en', '']);
        } catch (_) {}
      }
    };

    if (map.isStyleLoaded()) {
      applyHighlight();
    } else {
      map.once('style.load', applyHighlight);
    }
  }, [focusEvent]); // eslint-disable-line

  // ─── AI BRIEF: STRIKE ARCS + DYNAMIC HEAT + TARGET MARKERS ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !aiBrief) return;

    const apply = () => {
      if (!styleReadyRef.current) return;
      // --- 1. Dynamic conflict heat → adjust conflict zone fill opacity ---
      for (const conflict of ACTIVE_CONFLICTS) {
        const heat = aiBrief.conflictHeat?.[conflict.id] || 0;
        const fillLayerId = `conflict-fill-${conflict.id}`;
        const countryFillLayerId = `conflict-country-fill-${conflict.id}`;
        const heatMultiplier = 1 + (heat / 10);
        const baseOpacity = conflict.severity === 'critical' ? 0.08 : 0.05;
        const countryBaseOpacity = conflict.severity === 'critical' ? 0.10 : 0.06;
        try {
          if (map.getLayer(fillLayerId)) {
            map.setPaintProperty(fillLayerId, 'fill-opacity', Math.min(baseOpacity * heatMultiplier, 0.25));
          }
          if (map.getLayer(countryFillLayerId)) {
            map.setPaintProperty(countryFillLayerId, 'fill-opacity', Math.min(countryBaseOpacity * heatMultiplier, 0.30));
          }
        } catch (_) {}
      }

      // --- 2. Strike arcs + target markers: sources created in style.load, only update data here ---
      const strikeFeatures: any[] = [];
      const targetFeatures: any[] = [];

      for (const event of (aiBrief.verifiedEvents || [])) {
        if (!event.verified) continue;
        // Show arcs for strike events AND any event with originLocation
        const isStrike = event.type === 'strike';
        const hasOrigin = event.originLocation?.lat && event.originLocation?.lng;
        if (!isStrike && !hasOrigin) continue;
        if (!event.targetLocation?.lat || !event.targetLocation?.lng) continue;

        const conflict = ACTIVE_CONFLICTS.find(c => c.id === event.conflictId);
        // Strike color: hostile = bold red, friendly/allied = green, fallback = red
        const side = (event as any).side || 'hostile';
        const color = side === 'friendly' ? '#22c55e' : '#ef4444';
        targetFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [event.targetLocation.lng, event.targetLocation.lat] },
          properties: {
            headline: event.headline,
            targetName: event.targetLocation.name,
            severity: event.severity,
            color,
            side,
            corroboration: event.corroboration,
            sources: (event.sources || []).join(', '),
          },
        });

        if (event.originLocation?.lat && event.originLocation?.lng) {
          const origin = [event.originLocation.lng, event.originLocation.lat];
          const target = [event.targetLocation.lng, event.targetLocation.lat];
          // Generate great-circle-like curved arc (not straight line)
          const arcCoords: [number, number][] = [];
          const steps = 50;
          const dx = target[0] - origin[0];
          const dy = target[1] - origin[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Arc height proportional to distance (more curve for longer arcs)
          const arcHeight = Math.min(dist * 0.15, 8);
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const lng = origin[0] + dx * t;
            const lat = origin[1] + dy * t;
            // Parabolic arc offset perpendicular to the line
            const arcOffset = arcHeight * Math.sin(t * Math.PI);
            // Offset perpendicular: rotate 90° from direction
            const angle = Math.atan2(dy, dx) + Math.PI / 2;
            arcCoords.push([
              lng + Math.cos(angle) * arcOffset * 0.3,
              lat + Math.sin(angle) * arcOffset,
            ]);
          }
          strikeFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: arcCoords },
            properties: {
              color,
              severity: event.severity,
              headline: event.headline,
              side,
              originName: event.originLocation.name,
              targetName: event.targetLocation.name,
              sources: (event.sources || []).join(', '),
              sourceUrl: (event as any).sourceUrl || '',
              timestamp: (event as any).timestamp || '',
              corroboration: event.corroboration || 0,
            },
          });
        }
      }

      // Sources are pre-created in style.load — just update data
      const arcSrc = map.getSource('strike-arcs') as mapboxgl.GeoJSONSource | undefined;
      if (arcSrc) arcSrc.setData({ type: 'FeatureCollection', features: strikeFeatures });

      const targetSrc = map.getSource('strike-targets') as mapboxgl.GeoJSONSource | undefined;
      if (targetSrc) targetSrc.setData({ type: 'FeatureCollection', features: targetFeatures });

      // (pulse animation handled by the existing animation loop via 'strike-target-pulse' layer check)
    };

    if (styleReadyRef.current) {
      apply();
    } else {
      // Brief arrived before style.load — wait for it, then apply
      const onReady = () => { apply(); };
      map.once('style.load', onReady);
      return () => { map.off('style.load', onReady); };
    }
  }, [aiBrief, theme]); // eslint-disable-line

  // Sync data layers: create sources/layers if missing, update data, toggle visibility
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const doSync = () => {
      if (!styleReadyRef.current) return false;

        for (const layer of layers) {
      // aircraft/ships/military/nuclear: dedicated icon rendering + pulse rings via their own effects
      // cables/pipelines: use generic arc system below (arc data is in layers.ts)
      if (layer.id === 'aircraft' || layer.id === 'ships' || layer.id === 'military' || layer.id === 'nuclear') continue;

      const sourceId = `layer-${layer.id}`;
      const circleId = `layer-${layer.id}-circles`;
      const labelId = `layer-${layer.id}-labels`;
      const lineId = `layer-${layer.id}-lines`;
      const visibility = layer.enabled ? 'visible' : 'none';

      if (layer.type === 'points') {
        const features = (layer.points || []).map(p => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: {
            label: p.label,
            subLabel: p.subLabel || '',
            color: p.color,
            meta: p.meta ? JSON.stringify(p.meta) : '',
          },
        }));
        const geojson = { type: 'FeatureCollection' as const, features };

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(geojson);
        } else if (features.length > 0) {
          // Create source + layers (works regardless of initial enabled state)
          map.addSource(sourceId, { type: 'geojson', data: geojson });
          map.addLayer({
            id: circleId, type: 'circle', source: sourceId,
            layout: { visibility },
            paint: {
              'circle-radius': 5,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.8,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': 0.4,
            },
          });
          map.addLayer({
            id: labelId, type: 'symbol', source: sourceId, minzoom: 3,
            layout: {
              visibility,
              'text-field': ['get', 'label'], 'text-size': 10,
              'text-offset': [0, 1.2], 'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            },
            paint: { 'text-color': '#cdd6f4', 'text-halo-color': '#11111b', 'text-halo-width': 1 },
          });

          // Register hover popup (once, when layer is first created)
          map.on('mouseenter', circleId, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (!e.features?.[0] || !hoverPopupRef.current) return;
            const props = e.features[0].properties as { label?: string; subLabel?: string } | null;
            const coords = ((e.features[0].geometry as unknown) as { coordinates: [number, number] }).coordinates.slice() as [number, number];
            hoverPopupRef.current.setLngLat(coords).setHTML(`
              <div style="background: ${theme.mantle}; border: 1px solid ${theme.surface0}; padding: 8px 10px; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: 600; color: ${theme.text};">${props?.label ?? ''}</div>
                ${props?.subLabel ? `<div style="font-size: 10px; color: ${theme.overlay0}; margin-top: 2px;">${props.subLabel}</div>` : ''}
              </div>
            `).addTo(map);
          });
          map.on('mouseleave', circleId, () => {
            map.getCanvas().style.cursor = '';
            hoverPopupRef.current?.remove();
          });
        }

        // Toggle visibility (always, even if source was just created)
        try {
          if (map.getLayer(circleId)) map.setLayoutProperty(circleId, 'visibility', visibility);
          if (map.getLayer(labelId)) map.setLayoutProperty(labelId, 'visibility', visibility);
        } catch (_) {}
      }

      if (layer.type === 'arcs') {
        const arcFeatures = (layer.arcs || []).map(a => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [[a.startLng, a.startLat], [a.endLng, a.endLat]] },
          properties: { label: a.label, color: a.color },
        }));
        const arcGeojson = { type: 'FeatureCollection' as const, features: arcFeatures };

        const existingArc = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existingArc) {
          existingArc.setData(arcGeojson);
        } else if (arcFeatures.length > 0) {
          map.addSource(sourceId, { type: 'geojson', data: arcGeojson });
          map.addLayer({
            id: lineId, type: 'line', source: sourceId,
            layout: { visibility, 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.5 },
          });
        }

        try {
          if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', visibility);
        } catch (_) {}
      }
    }

      return true; // sync succeeded
    }; // end doSync

    // Try immediately, retry on idle if style not ready
    if (!doSync()) {
      const handler = () => { if (doSync()) map.off('idle', handler); };
      map.on('idle', handler);
      return () => { map.off('idle', handler); };
    }
  }, [layers]); // eslint-disable-line

  // Update aircraft-live source when aircraft layer points change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const acLayer = layers.find(l => l.id === 'aircraft');
    if (!acLayer) return;

    const tryUpdate = () => {
      if (!styleReadyRef.current) return false;
      // Clean up any leftover generic circles for aircraft
      try {
        if (map.getLayer('layer-aircraft-circles')) map.removeLayer('layer-aircraft-circles');
        if (map.getLayer('layer-aircraft-labels')) map.removeLayer('layer-aircraft-labels');
        if (map.getSource('layer-aircraft')) map.removeSource('layer-aircraft');
      } catch (_) {}

      const source = map.getSource('aircraft-live') as mapboxgl.GeoJSONSource | undefined;
      if (!source) return false;

      const features = (acLayer.points || []).map(p => {
        // Parse subLabel for altitude/velocity/heading
        const parts = (p.subLabel || '').split(' | ');
        const altStr = parts.find(s => s.startsWith('FL'));
        const velStr = parts.find(s => s.endsWith('kt'));
        const hdgStr = parts.find(s => s.startsWith('HDG'));
        const altitude = altStr ? parseInt(altStr.replace('FL', '')) * 30.48 : 0;
        const velocity = velStr ? parseInt(velStr) : 0;
        const heading = hdgStr ? parseInt(hdgStr.replace('HDG ', '').replace('°', '')) : 0;

        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: {
            icao24: p.id.replace('ac-', ''),
            callsign: p.label,
            country: (p.subLabel || '').split(' | ')[0] || 'Unknown',
            altitude,
            velocity,
            heading,
            color: p.color,
          },
        };
      });

      source.setData({ type: 'FeatureCollection', features });

      // Toggle aircraft layer visibility
      const visibility = acLayer.enabled ? 'visible' : 'none';
      try {
        if (map.getLayer('aircraft-icons')) map.setLayoutProperty('aircraft-icons', 'visibility', visibility);
        if (map.getLayer('aircraft-labels')) map.setLayoutProperty('aircraft-labels', 'visibility', visibility);
        if (map.getLayer('aircraft-track-solid')) map.setLayoutProperty('aircraft-track-solid', 'visibility', visibility);
        if (map.getLayer('aircraft-track-planned')) map.setLayoutProperty('aircraft-track-planned', 'visibility', visibility);
        if (map.getLayer('aircraft-endpoints-dots')) map.setLayoutProperty('aircraft-endpoints-dots', 'visibility', visibility);
        if (map.getLayer('aircraft-endpoints-labels')) map.setLayoutProperty('aircraft-endpoints-labels', 'visibility', visibility);
      } catch (_) {}

      return true;
    };

    if (!tryUpdate()) {
      const onStyleLoad2 = () => { tryUpdate(); };
      const onIdle2 = () => { if (tryUpdate()) { map.off('idle', onIdle2); map.off('style.load', onStyleLoad2); } };
      map.on('style.load', onStyleLoad2);
      map.on('idle', onIdle2);
      return () => { map.off('idle', onIdle2); map.off('style.load', onStyleLoad2); };
    }
  }, [layers]); // eslint-disable-line

  // Update ships-live source when ships layer points change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const shipLayer = layers.find(l => l.id === 'ships');
    if (!shipLayer) return;

    // Clean up any leftover generic circles for ships
    try {
      if (map.getLayer('layer-ships-circles')) map.removeLayer('layer-ships-circles');
      if (map.getLayer('layer-ships-labels')) map.removeLayer('layer-ships-labels');
      if (map.getSource('layer-ships')) map.removeSource('layer-ships');
    } catch (_) {}

    const tryUpdate = () => {
      if (!styleReadyRef.current) return false;
      const source = map.getSource('ships-live') as mapboxgl.GeoJSONSource | undefined;
      if (!source) return false;

      const features = (shipLayer.points || []).map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          label: p.label,
          subLabel: p.subLabel || '',
          color: p.color,
          meta: p.meta ? JSON.stringify(p.meta) : '',
        },
      }));

      source.setData({ type: 'FeatureCollection', features });

      // Toggle visibility
      const visibility = shipLayer.enabled ? 'visible' : 'none';
      try {
        if (map.getLayer('ship-icons')) map.setLayoutProperty('ship-icons', 'visibility', visibility);
        if (map.getLayer('ship-labels')) map.setLayoutProperty('ship-labels', 'visibility', visibility);
      } catch (_) {}

      return true;
    };

    if (!tryUpdate()) {
      const onStyleLoad3 = () => { tryUpdate(); };
      const onIdle3 = () => { if (tryUpdate()) { map.off('idle', onIdle3); map.off('style.load', onStyleLoad3); } };
      map.on('style.load', onStyleLoad3);
      map.on('idle', onIdle3);
      return () => { map.off('idle', onIdle3); map.off('style.load', onStyleLoad3); };
    }
  }, [layers]); // eslint-disable-line

  // Update military-bases-live source when military layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const milLayer = layers.find(l => l.id === 'military');
    if (!milLayer) return;

    try {
      if (map.getLayer('layer-military-circles')) map.removeLayer('layer-military-circles');
      if (map.getLayer('layer-military-labels')) map.removeLayer('layer-military-labels');
      if (map.getSource('layer-military')) map.removeSource('layer-military');
    } catch (_) {}

    const tryUpdate = () => {
      if (!styleReadyRef.current) return false;
      const source = map.getSource('military-bases-live') as mapboxgl.GeoJSONSource | undefined;
      if (!source) return false;

      const features = (milLayer.points || []).map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { label: p.label, subLabel: p.subLabel || '', color: p.color },
      }));
      source.setData({ type: 'FeatureCollection', features });

      const visibility = milLayer.enabled ? 'visible' : 'none';
      for (const id of ['military-base-icons', 'military-base-labels', 'military-pulse-1', 'military-pulse-2', 'military-pulse-3']) {
        try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility); } catch (_) {}
      }
      return true;
    };

    if (!tryUpdate()) {
      const onStyleLoad = () => { tryUpdate(); };
      const onIdle = () => { if (tryUpdate()) { map.off('idle', onIdle); map.off('style.load', onStyleLoad); } };
      map.on('style.load', onStyleLoad);
      map.on('idle', onIdle);
      return () => { map.off('idle', onIdle); map.off('style.load', onStyleLoad); };
    }
  }, [layers]); // eslint-disable-line

  // Update nuclear-live source when nuclear layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nucLayer = layers.find(l => l.id === 'nuclear');
    if (!nucLayer) return;

    try {
      if (map.getLayer('layer-nuclear-circles')) map.removeLayer('layer-nuclear-circles');
      if (map.getLayer('layer-nuclear-labels')) map.removeLayer('layer-nuclear-labels');
      if (map.getSource('layer-nuclear')) map.removeSource('layer-nuclear');
    } catch (_) {}

    const tryUpdate = () => {
      if (!styleReadyRef.current) return false;
      const source = map.getSource('nuclear-live') as mapboxgl.GeoJSONSource | undefined;
      if (!source) return false;

      const features = (nucLayer.points || []).map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { label: p.label, subLabel: p.subLabel || '', color: p.color },
      }));
      source.setData({ type: 'FeatureCollection', features });

      const visibility = nucLayer.enabled ? 'visible' : 'none';
      for (const id of ['nuclear-icons', 'nuclear-labels', 'nuclear-pulse-1', 'nuclear-pulse-2', 'nuclear-pulse-3']) {
        try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility); } catch (_) {}
      }
      return true;
    };

    if (!tryUpdate()) {
      const onStyleLoad4 = () => { tryUpdate(); };
      const onIdle4 = () => { if (tryUpdate()) { map.off('idle', onIdle4); map.off('style.load', onStyleLoad4); } };
      map.on('style.load', onStyleLoad4);
      map.on('idle', onIdle4);
      return () => { map.off('idle', onIdle4); map.off('style.load', onStyleLoad4); };
    }
  }, [layers]); // eslint-disable-line

  // Toggle active conflict zones visibility based on layer panel
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const conflictLayer = layers.find(l => l.id === 'active-conflicts');
    if (!conflictLayer) return;
    const visibility = conflictLayer.enabled ? 'visible' : 'none';
    const tryUpdate = () => {
      if (!styleReadyRef.current) return false;
      for (const conflict of ACTIVE_CONFLICTS) {
        try {
          if (map.getLayer(`conflict-fill-${conflict.id}`)) map.setLayoutProperty(`conflict-fill-${conflict.id}`, 'visibility', visibility);
          if (map.getLayer(`conflict-border-${conflict.id}`)) map.setLayoutProperty(`conflict-border-${conflict.id}`, 'visibility', visibility);
          if (map.getLayer(`conflict-label-${conflict.id}`)) map.setLayoutProperty(`conflict-label-${conflict.id}`, 'visibility', visibility);
        } catch (_) {}
      }
      // Hotspot markers + pulse
      try {
        for (const id of ['conflict-hotspot-dots', 'conflict-hotspot-labels', 'conflict-hotspot-pulse-1', 'conflict-hotspot-pulse-2', 'conflict-hotspot-pulse-3']) {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
        }
      } catch (_) {}
      return true;
    };
    if (!tryUpdate()) {
      const onStyleLoad5 = () => { tryUpdate(); };
      const onIdle5 = () => { if (tryUpdate()) { map.off('idle', onIdle5); map.off('style.load', onStyleLoad5); } };
      map.on('style.load', onStyleLoad5);
      map.on('idle', onIdle5);
      return () => { map.off('idle', onIdle5); map.off('style.load', onStyleLoad5); };
    }
  }, [layers]); // eslint-disable-line

  // Show news article preview popup when selectedNews changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const newsPopup = newsPopupRef.current;
    if (!newsPopup) return;

    if (!selectedNews || selectedNews.lat == null || selectedNews.lng == null) {
      newsPopup.remove();
      return;
    }

    const conflictName = selectedNews.conflictId
      ? ACTIVE_CONFLICTS.find(c => c.id === selectedNews.conflictId)?.name
      : null;
    const conflictColor = selectedNews.conflictId
      ? ACTIVE_CONFLICTS.find(c => c.id === selectedNews.conflictId)?.color
      : null;

    const color = theme.blue;
    const desc = (selectedNews.description || '').slice(0, 200);
    const descTrunc = selectedNews.description && selectedNews.description.length > 200 ? '...' : '';

    // Offset popup so it doesn't cover the conflict zone center
    // Shift north-east by ~2° lat and ~3° lng depending on zoom
    const offsetLat = selectedNews.lat + 2.5;
    const offsetLng = selectedNews.lng + 4.0;

    newsPopup
      .setLngLat([offsetLng, offsetLat])
      .setHTML(`
        <div style="font-family: inherit; max-width: 280px; padding: 10px; background: ${theme.mantle}dd; backdrop-filter: blur(8px); border: 1px solid ${theme.surface0}; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
            <span style="font-size: 10px;">📰</span>
            <span style="font-size: 9px; padding: 1px 5px; background: ${color}22; border: 1px solid ${color}33; border-radius: 3px; color: ${color}; font-weight: 600; letter-spacing: 0.5px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${selectedNews.source.slice(0, 24)}</span>
            ${conflictName && conflictColor ? `<span style="font-size: 9px; padding: 1px 5px; background: ${conflictColor}22; border: 1px solid ${conflictColor}33; border-radius: 3px; color: ${conflictColor}; font-weight: 600;">⚔ ${conflictName}</span>` : ''}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: ${theme.text}; line-height: 1.3; margin-bottom: 6px;">${selectedNews.title}</div>
          ${desc ? `<div style="font-size: 10px; color: ${theme.subtext0}; line-height: 1.4; margin-bottom: 8px;">${desc}${descTrunc}</div>` : ''}
          <a href="${selectedNews.link}" target="_blank" style="font-size: 10px; color: ${color}; text-decoration: none; font-weight: 600;">Read Full Article ↗</a>
        </div>
      `)
      .addTo(map);
  }, [selectedNews, theme]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
});
