'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoEvent, DataLayer, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface Props {
  events: GeoEvent[];
  layers: DataLayer[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  focusEvent: GeoEvent | null;
  theme: ThemeColors;
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'UK': 'United Kingdom',
  'South Korea': 'Republic of Korea',
};

export function Globe({ events, layers, onSelect, focusEvent, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const colors = severityColors(theme);

  // Only geopolitical events on the globe (no economic)
  const geoEvents = events.filter(e => e.category !== 'economic');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      // @ts-ignore globe projection (mapbox-gl v3)
      projection: 'globe',
      center: [20, 30],
      zoom: 1.8,
      attributionControl: false,
      antialias: true,
    });

    mapRef.current = map;

    map.on('style.load', () => {
      // Catppuccin atmosphere — lighter halo around globe
      // @ts-ignore setFog (mapbox-gl v3)
      map.setFog({
        color: theme.surface1,
        'high-color': theme.surface0,
        'horizon-blend': 0.12,
        'space-color': theme.crust,
        'star-intensity': 0.15,
      });

      // FLIR/tactical look with Catppuccin slate shades
      const style = map.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          // Remove all default labels except our custom ones
          if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
          // Water: very dark Catppuccin crust
          if (layer.id.includes('water') && layer.type === 'fill') {
            try { map.setPaintProperty(layer.id, 'fill-color', '#11111b'); } catch (_) {}
          }
          // Country borders: thin dashed Catppuccin subtext
          if (layer.id.includes('admin') && layer.type === 'line') {
            try {
              map.setPaintProperty(layer.id, 'line-color', '#585b70');
              map.setPaintProperty(layer.id, 'line-opacity', 0.45);
              map.setPaintProperty(layer.id, 'line-width', 0.6);
              map.setPaintProperty(layer.id, 'line-dasharray', [3, 2]);
            } catch (_) {}
          }
        }
      }

      // Variation in landmass shading — Catppuccin slate/surface palette
      // Use a fill-extrusion or override the land with continent-scale variation
      // Override the single land fill with a data-driven expression
      try {
        const landLayers = style?.layers?.filter((l: { id: string; type: string }) =>
          l.id.includes('land') && l.type === 'fill'
        ) || [];
        for (const layer of landLayers) {
          // Use latitude-based shading for natural variation
          // Northern regions slightly lighter, equatorial slightly different
          map.setPaintProperty(layer.id, 'fill-color', [
            'interpolate', ['linear'], ['zoom'],
            0, '#1e1e2e',  // Catppuccin base at low zoom
            3, '#181825',  // Catppuccin mantle at mid zoom
            6, '#1e1e2e',  // base again at higher zoom
          ]);
        }
      } catch (_) {}

      // Add a continent-scale variation layer using built-in landuse
      // This gives different shades for forests, urban, etc.
      try {
        const landuseLayer = style?.layers?.find((l: { id: string }) => l.id.includes('landuse'));
        if (landuseLayer) {
          map.setPaintProperty(landuseLayer.id, 'fill-color', [
            'match', ['get', 'class'],
            'park', '#1a1a2e',
            'glacier', '#2a2a3e',
            'pitch', '#161628',
            'sand', '#1c1c30',
            'hospital', '#1e1e32',
            'school', '#1a1a2c',
            'industrial', '#16162a',
            '#1e1e2e',  // default
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
            geometry: {
              type: 'Point' as const,
              coordinates: [ev.lng, ev.lat],
            },
            properties: {
              id: ev.id,
              severity: ev.severity,
              title: ev.title,
              country: ev.country,
              category: ev.category,
            },
          })),
        },
      });

      // Pulse layer (behind main dots)
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

      // Country boundaries
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });

      map.addLayer({
        id: 'country-highlight-fill',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': colors[4],
          'fill-opacity': 0.1,
        },
        filter: ['==', 'name_en', ''],
      });

      map.addLayer({
        id: 'country-highlight-line',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': colors[4],
          'line-width': 2,
          'line-opacity': 0.6,
        },
        filter: ['==', 'name_en', ''],
      });

      // Country labels only where events exist
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
    });

    // Click handlers — marker click highlights, empty click clears
    let markerClicked = false;

    map.on('click', 'event-circles', (e) => {
      markerClicked = true;
      if (e.features && e.features[0]) {
        const id = e.features[0].properties?.id;
        const event = events.find(ev => ev.id === id);
        if (event) onSelect(event);
      }
    });

    map.on('click', () => {
      // Defer so marker click fires first
      setTimeout(() => {
        if (markerClicked) {
          markerClicked = false;
          return;
        }
        // Clicked empty space — clear highlights
        if (map.getLayer('country-highlight-fill')) {
          map.setFilter('country-highlight-fill', ['==', 'name_en', '']);
        }
        if (map.getLayer('country-highlight-line')) {
          map.setFilter('country-highlight-line', ['==', 'name_en', '']);
        }
      }, 50);
    });

    map.on('mouseenter', 'event-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'event-circles', () => {
      map.getCanvas().style.cursor = '';
    });

    // Auto-rotation
    let rotateInterval: ReturnType<typeof setInterval> | null = null;
    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;

    function startRotation() {
      if (rotateInterval) return;
      rotateInterval = setInterval(() => {
        const center = map.getCenter();
        center.lng += 0.03;
        map.setCenter(center);
      }, 16);
    }

    function stopRotation() {
      if (rotateInterval) {
        clearInterval(rotateInterval);
        rotateInterval = null;
      }
      if (resumeTimeout) clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(startRotation, 2000);
    }

    map.on('mousedown', stopRotation);
    map.on('touchstart', stopRotation);
    map.on('wheel', stopRotation);

    map.on('load', startRotation);

    return () => {
      if (rotateInterval) clearInterval(rotateInterval);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // Focus event effect
  useEffect(() => {
    if (!mapRef.current || !focusEvent) return;
    const map = mapRef.current;

    map.flyTo({
      center: [focusEvent.lng, focusEvent.lat],
      zoom: 4,
      duration: 1500,
      essential: true,
    });

    const countryName = COUNTRY_NAME_MAP[focusEvent.country] || focusEvent.country;
    const sevColor = colors[focusEvent.severity];

    if (map.getLayer('country-highlight-fill')) {
      map.setFilter('country-highlight-fill', ['==', 'name_en', countryName]);
      map.setPaintProperty('country-highlight-fill', 'fill-color', sevColor);
    }
    if (map.getLayer('country-highlight-line')) {
      map.setFilter('country-highlight-line', ['==', 'name_en', countryName]);
      map.setPaintProperty('country-highlight-line', 'line-color', sevColor);
    }
  }, [focusEvent]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
