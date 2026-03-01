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
      // Use HTML elements for FLAT DOT markers (not pointsData which renders cylinders)
      .htmlElementsData(geoEvents)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(0.01)
      .htmlElement((d: GeoEvent) => {
        const color = colors[d.severity];
        const size = d.severity === 4 ? 16 : d.severity === 3 ? 12 : 8;
        const el = document.createElement('div');
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        el.style.background = color;
        el.style.boxShadow = `0 0 ${size}px ${color}88, 0 0 ${size * 2}px ${color}44`;
        el.style.border = `1.5px solid ${color}`;
        el.style.cursor = 'pointer';
        el.style.transition = 'transform 0.2s';
        el.title = d.title;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        el.addEventListener('click', () => onSelect(d));
        return el;
      })
      // Pulse rings on critical events
      .ringsData(geoEvents.filter(e => e.severity >= 3))
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d: GeoEvent) => d.severity === 4 ? 3 : 2)
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod((d: GeoEvent) => d.severity === 4 ? 900 : 1400)
      .ringColor(() => () => theme.red + '40')
      // Country labels
      .labelsData(geoEvents.filter(e => e.severity >= 3))
      .labelLat('lat')
      .labelLng('lng')
      .labelText('country')
      .labelSize(0.7)
      .labelDotRadius(0)
      .labelColor(() => '#ffffffbb')
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
