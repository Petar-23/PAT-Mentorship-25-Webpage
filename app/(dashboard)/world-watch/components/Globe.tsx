'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GeoEvent, DataLayer, ThemeColors } from '../types';
import { severityColors } from '../styles/themes';

interface Props {
  events: GeoEvent[];
  layers: DataLayer[];
  selectedId: string | null;
  onSelect: (event: GeoEvent) => void;
  focusEvent: GeoEvent | null;
  theme: ThemeColors;
}

// Convert color texture to grayscale at runtime via canvas
function grayscaleTexture(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(url); return; }
      ctx.filter = 'grayscale(100%) contrast(130%) brightness(60%)';
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(url);
    img.src = url.startsWith('//') ? `https:${url}` : url;
  });
}

export function Globe({ events, layers, onSelect, focusEvent, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const colors = severityColors(theme);

  // Only geopolitical events on the globe (no economic)
  const geoEvents = events.filter(e => e.category !== 'economic');

  const initGlobe = useCallback(async () => {
    if (!containerRef.current || globeRef.current) return;

    const grayEarth = await grayscaleTexture('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GlobeGL = (await import('globe.gl')).default as any;
    const globe = GlobeGL({ animateIn: true })(containerRef.current);

    const cableArcs = layers.filter(l => l.id === 'cables' && l.enabled).flatMap(l => l.arcs || []);

    globe
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl(grayEarth)
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#ffffff')
      .atmosphereAltitude(0.12)
      // Event markers — cylinders with minimal height (rounded cap look)
      .pointsData(geoEvents)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.005)
      .pointRadius((d: GeoEvent) => d.severity === 4 ? 0.6 : d.severity === 3 ? 0.4 : 0.25)
      .pointColor((d: GeoEvent) => colors[d.severity])
      .pointResolution(64)
      .onPointClick((point: GeoEvent) => onSelect(point))
      // Pulse rings on critical events
      .ringsData(geoEvents.filter(e => e.severity >= 3))
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d: GeoEvent) => d.severity === 4 ? 3 : 2)
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod((d: GeoEvent) => d.severity === 4 ? 900 : 1400)
      .ringColor(() => () => theme.red + '40')
      // Country labels — larger font
      .labelsData(geoEvents.filter(e => e.severity >= 3))
      .labelLat('lat')
      .labelLng('lng')
      .labelText('country')
      .labelSize(1.4)
      .labelDotRadius(0.3)
      .labelColor(() => '#ffffffcc')
      .labelAltitude(0.015)
      // Undersea cables as arcs
      .arcsData(cableArcs)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor('color')
      .arcAltitude(0.15)
      .arcStroke(0.3)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(4000);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.3;
    globe.controls().addEventListener('start', () => {
      globe.controls().autoRotate = false;
    });
    globe.pointOfView({ lat: 30, lng: 20, altitude: 2.2 });

    globeRef.current = globe;

    const handleResize = () => {
      if (containerRef.current) {
        globe.width(containerRef.current.clientWidth);
        globe.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []); // eslint-disable-line

  useEffect(() => { initGlobe(); }, [initGlobe]);

  useEffect(() => {
    if (focusEvent && globeRef.current) {
      globeRef.current.controls().autoRotate = false;
      globeRef.current.pointOfView(
        { lat: focusEvent.lat, lng: focusEvent.lng, altitude: 1.5 },
        1000
      );
    }
  }, [focusEvent]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: theme.crust,
        overflow: 'hidden',
        position: 'relative',
      }}
    />
  );
}
