'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoEvent, DataLayer, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';
import ms from 'milsymbol';

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
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'UK': 'United Kingdom',
  'South Korea': 'Republic of Korea',
};

const DEFAULT_CENTER: [number, number] = [20, 30];
const DEFAULT_ZOOM = 1.8;

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  { events, layers, onSelect, focusEvent, focusCounter, theme, onRotationChange, aircraftDataRef },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRotatingRef = useRef(true);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const airportRef = useRef<Record<string, [number, number, string]>>({});
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
        console.log(`[OPTICON] Airport DB loaded: ${Object.keys(data).length} airports`);
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

      // Events GeoJSON source
      map.addSource('events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: geoEvents.map(ev => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [ev.lng, ev.lat] },
            properties: { id: ev.id, severity: ev.severity, title: ev.title, country: ev.country, category: ev.category, sourceUrl: ev.sourceUrl || '' },
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

      // Main event circles
      map.addLayer({
        id: 'event-circles',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 4, 10, 3, 7, 2, 5, 3],
          'circle-color': ['match', ['get', 'severity'], 4, colors[4], 3, colors[3], 2, colors[2], colors[1]],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['match', ['get', 'severity'], 4, colors[4], 3, colors[3], 2, colors[2], colors[1]],
          'circle-stroke-opacity': 0.4,
        },
      });

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

      // Render data layers
      for (const layer of layers) {
        if (!layer.enabled) continue;
        if (layer.type === 'points' && layer.points && layer.points.length > 0) {
          const sourceId = `layer-${layer.id}`;
          const layerId = `layer-${layer.id}-circles`;
          const labelLayerId = `layer-${layer.id}-labels`;

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: layer.points.map(p => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
                properties: { label: p.label, subLabel: p.subLabel || '', color: p.color },
              })),
            },
          });

          map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': 4,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.7,
              'circle-stroke-width': 1,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': 0.3,
            },
          });

          map.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId,
            minzoom: 3,
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            },
            paint: {
              'text-color': '#cdd6f4',
              'text-halo-color': '#11111b',
              'text-halo-width': 1,
            },
          });
        }

        if (layer.type === 'arcs' && layer.arcs && layer.arcs.length > 0) {
          const sourceId = `layer-${layer.id}`;
          const layerId = `layer-${layer.id}-lines`;

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: layer.arcs.map(a => ({
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: [[a.startLng, a.startLat], [a.endLng, a.endLat]] },
                properties: { label: a.label, color: a.color },
              })),
            },
          });

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-opacity': 0.5,
            },
            layout: {
              'line-cap': 'round',
            },
          });
        }
      }

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
    });

    // Click: marker stops rotation + highlights; empty space clears
    let markerClicked = false;

    map.on('click', 'event-circles', (e) => {
      markerClicked = true;
      stopRotation(); // Stop rotation on any marker click
      if (e.features && e.features[0]) {
        const id = e.features[0].properties?.id;
        const event = events.find(ev => ev.id === id);
        if (event) onSelect(event);
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

    map.on('mouseenter', 'event-circles', (e) => {
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

    map.on('mouseleave', 'event-circles', () => {
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
        console.log(`[OPTICON] Route: origin=${originIata}(${!!originData}) dest=${destIata}(${!!destData}) dbSize=${dbSize}`);
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
      if (airForce === 'USAF') return '🇺🇸 USAF';
      if (airForce === 'RAF') return '🇬🇧 RAF';
      if (airForce === 'Luftwaffe') return '🇩🇪 Luftwaffe';
      if (airForce === 'RCAF') return '🇨🇦 RCAF';
      return `${airForce || 'Military'}`;
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
    // Ships layer uses generic circle layer id: layer-ships-circles
    // We attach a click handler after map load using a delegated approach
    const shipPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });

    map.on('click', 'layer-ships-circles', (e) => {
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

      shipPopup.setLngLat(coords).setHTML(`
        <div style="
          background: ${theme.mantle}ee;
          border: 1px solid ${color}55;
          border-radius: 6px;
          padding: 10px 12px;
          backdrop-filter: blur(12px);
          font-family: ui-monospace, monospace;
          min-width: 220px;
        ">
          ${natoSvg ? `<div style="text-align: center; margin-bottom: 8px;">${natoSvg}</div>` : ''}
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
        </div>
      `).addTo(map);
    });

    map.on('mouseenter', 'layer-ships-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'layer-ships-circles', () => {
      map.getCanvas().style.cursor = '';
    });
    // ─────────────────────────────────────────────────────────────────────────

    // Click empty space: dismiss aircraft popup + clear route + clear country highlight
    map.on('click', () => {
      setTimeout(() => {
        if (markerClicked) { markerClicked = false; return; }
        // Clear country highlight
        try {
          if (map.getLayer('country-highlight-fill')) map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
          if (map.getLayer('country-highlight-line')) map.setFilter('country-highlight-line', ['==', 'name_en', '']);
        } catch (_) {}
        // Dismiss aircraft popup/route
        if (pinnedAircraft) {
          pinnedAircraft = null;
          acPopup.remove();
          clearAircraftRoute();
        }
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
        properties: { id: ev.id, severity: ev.severity, title: ev.title, country: ev.country, category: ev.category, sourceUrl: ev.sourceUrl || '' },
      })),
    });
  }, [events]); // eslint-disable-line

  // Focus event — triggered by focusCounter to allow re-selecting same event
  useEffect(() => {
    if (!mapRef.current || !focusEvent || focusCounter === 0) return;
    const map = mapRef.current;

    stopRotation();

    map.flyTo({
      center: [focusEvent.lng, focusEvent.lat],
      zoom: 4,
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
  }, [focusCounter]); // eslint-disable-line

  // Sync data layers: create sources/layers if missing, update data, toggle visibility
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    // Handle submarine cables visibility (custom Mapbox source, not generic)
    const cableLayer = layers.find(l => l.id === 'cables');
    if (cableLayer) {
      const vis = cableLayer.enabled ? 'visible' : 'none';
      try {
        if (map.getLayer('submarine-cables-lines')) map.setLayoutProperty('submarine-cables-lines', 'visibility', vis);
      } catch (_) {}
    }

    // Handle pipelines visibility (custom Mapbox source, not generic)
    const pipelineLayer = layers.find(l => l.id === 'pipelines');
    if (pipelineLayer) {
      const vis = pipelineLayer.enabled ? 'visible' : 'none';
      try {
        if (map.getLayer('pipelines-lines')) map.setLayoutProperty('pipelines-lines', 'visibility', vis);
        if (map.getLayer('pipelines-lines-dashed')) map.setLayoutProperty('pipelines-lines-dashed', 'visibility', vis);
      } catch (_) {}
    }

    for (const layer of layers) {
      // Aircraft + Ships have dedicated icon rendering — skip generic circle system
      // Cables + Pipelines have custom GeoJSON sources — skip generic arc system
      if (layer.id === 'aircraft' || layer.id === 'ships' || layer.id === 'cables' || layer.id === 'pipelines') continue;

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
          // Update existing source data
          existing.setData(geojson);
        } else if (features.length > 0 || layer.points?.length) {
          // Create source + layers when data arrives (even on later renders)
          map.addSource(sourceId, { type: 'geojson', data: geojson });
          map.addLayer({
            id: circleId, type: 'circle', source: sourceId,
            paint: {
              'circle-radius': 4,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.7,
              'circle-stroke-width': 1,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': 0.3,
            },
          });
          map.addLayer({
            id: labelId, type: 'symbol', source: sourceId, minzoom: 3,
            layout: {
              'text-field': ['get', 'label'], 'text-size': 10,
              'text-offset': [0, 1.2], 'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            },
            paint: { 'text-color': '#cdd6f4', 'text-halo-color': '#11111b', 'text-halo-width': 1 },
          });
        }

        // Add hover popup for newly created circle layer (only once per layer)
        if (!map.getSource(sourceId) && features.length > 0) {
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

        // Toggle visibility
        try {
          if (map.getLayer(circleId)) map.setLayoutProperty(circleId, 'visibility', visibility);
          if (map.getLayer(labelId)) map.setLayoutProperty(labelId, 'visibility', visibility);
        } catch (_) {}
      }

      if (layer.type === 'arcs') {
        const features = (layer.arcs || []).map(a => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [[a.startLng, a.startLat], [a.endLng, a.endLat]] },
          properties: { label: a.label, color: a.color },
        }));

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData({ type: 'FeatureCollection', features });
        }

        try {
          if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', visibility);
        } catch (_) {}
      }
    }
  }, [layers]); // eslint-disable-line

  // Update aircraft-live source when aircraft layer points change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const acLayer = layers.find(l => l.id === 'aircraft');
    if (!acLayer) return;

    const tryUpdate = () => {
      if (!map.isStyleLoaded()) return false;

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
      // Style not loaded yet or source not ready — retry on idle
      const handler = () => {
        if (tryUpdate()) {
          map.off('idle', handler);
        }
      };
      map.on('idle', handler);
      return () => { map.off('idle', handler); };
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
      if (!map.isStyleLoaded()) return false;
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
      const handler = () => { if (tryUpdate()) map.off('idle', handler); };
      map.on('idle', handler);
      return () => { map.off('idle', handler); };
    }
  }, [layers]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
});
