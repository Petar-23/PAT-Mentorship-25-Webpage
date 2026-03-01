'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoEvent, DataLayer, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';

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
  aircraftTracks?: any[];
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'UK': 'United Kingdom',
  'South Korea': 'Republic of Korea',
};

const DEFAULT_CENTER: [number, number] = [20, 30];
const DEFAULT_ZOOM = 1.8;

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  { events, layers, onSelect, focusEvent, focusCounter, theme, onRotationChange, aircraftTracks = [] },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRotatingRef = useRef(true);
  const colors = severityColors(theme);

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
              map.setPaintProperty(layer.id, 'line-color', '#45475a');
              map.setPaintProperty(layer.id, 'line-opacity', 0.25);
              map.setPaintProperty(layer.id, 'line-width', 0.4);
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

      // Aircraft flight tracks
      map.addSource('aircraft-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-tracks-solid',
        type: 'line',
        source: 'aircraft-tracks',
        paint: {
          'line-color': '#89b4fa',
          'line-width': 1.5,
          'line-opacity': 0.6,
        },
        layout: { 'line-cap': 'round' },
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

    map.on('click', () => {
      setTimeout(() => {
        if (markerClicked) { markerClicked = false; return; }
        try {
          if (map.getLayer('country-highlight-fill')) map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
          if (map.getLayer('country-highlight-line')) map.setFilter('country-highlight-line', ['==', 'name_en', '']);
        } catch (_) {}
      }, 50);
    });

    // Hover popup
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '280px',
      className: 'ww-marker-popup',
    });

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

  // Toggle data layer visibility when layers prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    for (const layer of layers) {
      const circleId = `layer-${layer.id}-circles`;
      const labelId = `layer-${layer.id}-labels`;
      const lineId = `layer-${layer.id}-lines`;
      const visibility = layer.enabled ? 'visible' : 'none';
      try {
        if (map.getLayer(circleId)) map.setLayoutProperty(circleId, 'visibility', visibility);
        if (map.getLayer(labelId)) map.setLayoutProperty(labelId, 'visibility', visibility);
        if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', visibility);
      } catch (_) {}
    }
  }, [layers]); // eslint-disable-line

  // Update aircraft flight tracks when data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('aircraft-tracks') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: aircraftTracks
        .filter((ac: any) => ac.track?.length > 1)
        .map((ac: any) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: ac.track,
          },
          properties: { callsign: ac.callsign, country: ac.country },
        })),
    });
  }, [aircraftTracks]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
});
