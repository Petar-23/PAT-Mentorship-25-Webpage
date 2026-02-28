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

type GlobeInstance = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => any;
};

export function Globe({ events, layers, onSelect, focusEvent, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const colors = severityColors(theme);

  const initGlobe = useCallback(async () => {
    if (!containerRef.current || globeRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GlobeGL = (await import('globe.gl')).default as any;
    const globe = GlobeGL({ animateIn: true })(containerRef.current);

    // Get all layer points (non-event layers)
    const militaryPoints = layers.filter(l => l.id === 'military' && l.enabled).flatMap(l => l.points || []);
    const nuclearPoints = layers.filter(l => l.id === 'nuclear' && l.enabled).flatMap(l => l.points || []);
    const shipPoints = layers.filter(l => l.id === 'ships' && l.enabled).flatMap(l => l.points || []);
    const aircraftPoints = layers.filter(l => l.id === 'aircraft' && l.enabled).flatMap(l => l.points || []);
    const protestPoints = layers.filter(l => l.id === 'protests' && l.enabled).flatMap(l => l.points || []);
    const infraPoints = layers.filter(l => l.id === 'infrastructure' && l.enabled).flatMap(l => l.points || []);
    const allLayerPoints = [...militaryPoints, ...nuclearPoints, ...shipPoints, ...aircraftPoints, ...protestPoints, ...infraPoints];

    const cableArcs = layers.filter(l => l.id === 'cables' && l.enabled).flatMap(l => l.arcs || []);

    globe
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor(theme.blue)
      .atmosphereAltitude(0.15)
      // Event points
      .pointsData(events)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude((d: GeoEvent) => d.severity === 4 ? 0.12 : d.severity === 3 ? 0.08 : 0.04)
      .pointRadius((d: GeoEvent) => d.severity === 4 ? 0.6 : d.severity === 3 ? 0.45 : 0.3)
      .pointColor((d: GeoEvent) => colors[d.severity])
      .pointResolution(12)
      .onPointClick((point: GeoEvent) => onSelect(point))
      // Rings on critical events
      .ringsData(events.filter(e => e.severity >= 3))
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d: GeoEvent) => d.severity === 4 ? 4 : 2.5)
      .ringPropagationSpeed(1.5)
      .ringRepeatPeriod((d: GeoEvent) => d.severity === 4 ? 800 : 1200)
      .ringColor(() => () => theme.red + '50')
      // Country labels for critical events
      .labelsData(events.filter(e => e.severity >= 3))
      .labelLat('lat')
      .labelLng('lng')
      .labelText('country')
      .labelSize(0.8)
      .labelDotRadius(0.3)
      .labelColor(() => theme.text + 'cc')
      .labelAltitude(0.01)
      // Custom layer points (military, nuclear, ships, etc.)
      .customLayerData(allLayerPoints)
      .customThreeObject(() => {
        const THREE = (globe as GlobeInstance).__threeObj;
        if (!THREE) return null;
        return null; // Use default
      })
      // Undersea cables as arcs
      .arcsData(cableArcs)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor('color')
      .arcAltitude(0.3)
      .arcStroke(0.5)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(3000);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
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
        background: theme.base,
        overflow: 'hidden',
        position: 'relative',
      }}
    />
  );
}
