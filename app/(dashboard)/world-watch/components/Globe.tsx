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
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'UK': 'United Kingdom',
  'South Korea': 'Republic of Korea',
};

const DEFAULT_CENTER: [number, number] = [20, 30];
const DEFAULT_ZOOM = 1.8;

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  { events, layers, onSelect, focusEvent, focusCounter, theme, onRotationChange },
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

      // Load aircraft icon
      const img = new Image(24, 24);
      img.onload = () => {
        if (!map.hasImage('aircraft-icon')) {
          map.addImage('aircraft-icon', img, { sdf: true });
        }
      };
      img.src = '/icons/aircraft.svg';

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

      // Aircraft track source (for hover/click route display)
      map.addSource('aircraft-track-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Solid line: takeoff → current position (completed path)
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

      // Dashed line: current position → projected destination
      map.addLayer({
        id: 'aircraft-track-dashed',
        type: 'line',
        source: 'aircraft-track-line',
        filter: ['==', ['get', 'segment'], 'projected'],
        paint: {
          'line-color': '#89b4fa',
          'line-width': 1,
          'line-opacity': 0.4,
          'line-dasharray': [4, 4],
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

    // ─── AIRCRAFT INTERACTION ──────────────────────────────────────────
    let pinnedAircraft: string | null = null;
    let hoverTrackAbort: AbortController | null = null;

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

    function showAircraftRoute(track: [number, number][], acLng: number, acLat: number, heading: number) {
      try {
        const trackSrc = map.getSource('aircraft-track-line') as mapboxgl.GeoJSONSource | undefined;
        const endSrc = map.getSource('aircraft-endpoints') as mapboxgl.GeoJSONSource | undefined;
        if (!trackSrc || !endSrc) return;

        const features: any[] = [];

        // Solid line: completed path (track history)
        if (track.length >= 2) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: track },
            properties: { segment: 'completed' },
          });
        }

        // Dashed line: projected path (heading extrapolation ~500km)
        const projDist = 5; // ~5 degrees ≈ 500km
        const hdgRad = (heading * Math.PI) / 180;
        const projLng = acLng + Math.sin(hdgRad) * projDist;
        const projLat = acLat + Math.cos(hdgRad) * projDist;
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[acLng, acLat], [projLng, projLat]] },
          properties: { segment: 'projected' },
        });

        trackSrc.setData({ type: 'FeatureCollection', features });

        // Endpoints: takeoff + projected destination
        const endpoints: any[] = [];
        if (track.length >= 2) {
          endpoints.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: track[0] },
            properties: { label: 'TAKEOFF' },
          });
        }
        endpoints.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [projLng, projLat] },
          properties: { label: 'PROJECTED' },
        });
        endSrc.setData({ type: 'FeatureCollection', features: endpoints });
      } catch (_) {}
    }

    async function fetchAndShowTrack(icao24: string, acLng: number, acLat: number, heading: number) {
      if (hoverTrackAbort) hoverTrackAbort.abort();
      hoverTrackAbort = new AbortController();
      try {
        const res = await fetch(`/api/world-watch/opensky-track?icao24=${icao24}`, {
          signal: hoverTrackAbort.signal,
        });
        const data = await res.json();
        if (data.track?.length >= 2) {
          showAircraftRoute(data.track, acLng, acLat, heading);
        } else {
          // No track available, show just projected line
          showAircraftRoute([], acLng, acLat, heading);
        }
      } catch (_) {
        showAircraftRoute([], acLng, acLat, heading);
      }
    }

    map.on('mouseenter', 'aircraft-icons', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
      const icao = props?.icao24 || '';
      const fl = Math.round((props?.altitude || 0) / 30.48);

      // Show popup immediately with basic info
      const popupId = `ac-popup-${icao}`;
      acPopup.setLngLat(coords).setHTML(`
        <div id="${popupId}" style="
          background: ${theme.mantle};
          border: 1px solid ${theme.surface0};
          border-left: 3px solid #89b4fa;
          padding: 8px 10px;
          font-family: inherit;
          width: 260px;
        ">
          <div id="${popupId}-img" style="margin-bottom: 6px;"></div>
          <div style="font-size: 11px; font-weight: 700; color: #89b4fa; letter-spacing: 1px; margin-bottom: 4px;">
            ✈ ${props?.callsign || 'UNKNOWN'}
          </div>
          <div id="${popupId}-model" style="font-size: 10px; color: ${theme.subtext0}; margin-bottom: 3px;"></div>
          <div style="font-size: 11px; color: ${theme.text}; margin-bottom: 3px;">
            ${props?.country || 'Unknown'} Military
          </div>
          <div style="font-size: 10px; color: ${theme.overlay0}; display: flex; gap: 10px;">
            <span>FL${fl}</span>
            <span>${props?.velocity || 0} kt</span>
            <span>HDG ${props?.heading || 0}°</span>
            <span>${Math.round((props?.altitude || 0))}m</span>
          </div>
        </div>
      `).addTo(map);

      // Async: fetch aircraft photo from Planespotters
      if (icao) {
        fetch(`https://api.planespotters.net/pub/photos/hex/${icao}`)
          .then(r => r.json())
          .then(data => {
            const photos = data.photos || [];
            const imgEl = document.getElementById(`${popupId}-img`);
            const modelEl = document.getElementById(`${popupId}-model`);
            if (photos.length > 0 && imgEl) {
              const photo = photos[0];
              const src = photo.thumbnail_large?.src || photo.thumbnail?.src;
              if (src) {
                imgEl.innerHTML = `<img src="${src}" style="width: 100%; height: auto; border-radius: 3px; border: 1px solid ${theme.surface1};" />`;
              }
              // Show aircraft model/reg if available
              const ac = photo.aircraft || {};
              const model = ac.model || ac.icaotype || '';
              const reg = ac.registration || '';
              if (modelEl && (model || reg)) {
                modelEl.textContent = [model, reg].filter(Boolean).join(' — ');
              }
            }
          })
          .catch(() => {});
      }

      // Show track on hover (unless pinned to different aircraft)
      if (!pinnedAircraft) {
        fetchAndShowTrack(icao, coords[0], coords[1], props?.heading || 0);
      }
    });

    map.on('mouseleave', 'aircraft-icons', () => {
      map.getCanvas().style.cursor = '';
      acPopup.remove();
      // Clear route on mouse leave (unless pinned)
      if (!pinnedAircraft) {
        if (hoverTrackAbort) hoverTrackAbort.abort();
        clearAircraftRoute();
      }
    });

    // Click aircraft: pin route
    map.on('click', 'aircraft-icons', (e) => {
      markerClicked = true;
      stopRotation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
      const icao = props?.icao24;

      if (pinnedAircraft === icao) {
        // Unpin
        pinnedAircraft = null;
        clearAircraftRoute();
      } else {
        pinnedAircraft = icao;
        fetchAndShowTrack(icao, coords[0], coords[1], props?.heading || 0);
      }
    });

    // Click empty space: also unpin aircraft
    map.on('click', () => {
      setTimeout(() => {
        if (markerClicked) return;
        if (pinnedAircraft) {
          pinnedAircraft = null;
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

    for (const layer of layers) {
      // Aircraft has dedicated icon rendering — skip generic circle system
      if (layer.id === 'aircraft') continue;

      const sourceId = `layer-${layer.id}`;
      const circleId = `layer-${layer.id}-circles`;
      const labelId = `layer-${layer.id}-labels`;
      const lineId = `layer-${layer.id}-lines`;
      const visibility = layer.enabled ? 'visible' : 'none';

      if (layer.type === 'points') {
        const features = (layer.points || []).map(p => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: { label: p.label, subLabel: p.subLabel || '', color: p.color },
        }));
        const geojson = { type: 'FeatureCollection' as const, features };

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          // Update existing source data
          existing.setData(geojson);
        } else if (features.length > 0) {
          // Create source + layers for first time
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
    if (!map.isStyleLoaded()) return;

    const acLayer = layers.find(l => l.id === 'aircraft');
    if (!acLayer) return;

    // Clean up any leftover generic circles for aircraft
    try {
      if (map.getLayer('layer-aircraft-circles')) map.removeLayer('layer-aircraft-circles');
      if (map.getLayer('layer-aircraft-labels')) map.removeLayer('layer-aircraft-labels');
      if (map.getSource('layer-aircraft')) map.removeSource('layer-aircraft');
    } catch (_) {}

    const source = map.getSource('aircraft-live') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

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
      if (map.getLayer('aircraft-track-dashed')) map.setLayoutProperty('aircraft-track-dashed', 'visibility', visibility);
      if (map.getLayer('aircraft-endpoints-dots')) map.setLayoutProperty('aircraft-endpoints-dots', 'visibility', visibility);
      if (map.getLayer('aircraft-endpoints-labels')) map.setLayoutProperty('aircraft-endpoints-labels', 'visibility', visibility);
    } catch (_) {}
  }, [layers]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
});
