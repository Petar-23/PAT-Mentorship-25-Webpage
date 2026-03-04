import { NextResponse } from 'next/server';

export const revalidate = 120; // 2 min cache

// Strait of Hormuz + Persian Gulf + Eastern Med focus area
const FOCUS_AREAS = [
  { latMin: 24.0, latMax: 27.5, lonMin: 55.0, lonMax: 60.0, name: 'Hormuz' },
  { latMin: 22.0, latMax: 27.0, lonMin: 50.0, lonMax: 57.0, name: 'Persian Gulf' },
  { latMin: 30.0, latMax: 38.0, lonMin: 28.0, lonMax: 37.0, name: 'Eastern Med' },
];

interface AisVessel {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  shipType: number; // AIS ship type code
  flag?: string;
  callsign?: string;
}

// Finnish Maritime (Digitraffic) — free, no auth, covers Baltic/North Sea
// Fallback to simulated static data for Hormuz/Gulf area
async function fetchDigitraffic(): Promise<AisVessel[]> {
  const res = await fetch(
    'https://meri.digitraffic.fi/api/ais/v1/locations?from=0&to=200',
    { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const vessels: AisVessel[] = [];
  const ships = Array.isArray(data) ? data : (data.features || []);
  for (const s of ships) {
    const props = s.properties || s;
    const coords = s.geometry?.coordinates || [props.lon, props.lat];
    if (!coords[0] || !coords[1]) continue;
    vessels.push({
      mmsi: String(props.mmsi || ''),
      name: props.name || `MMSI ${props.mmsi}`,
      lat: coords[1],
      lng: coords[0],
      heading: props.heading ?? props.cog ?? 0,
      speed: props.sog ?? 0,
      shipType: props.shipType ?? 0,
      callsign: props.callsign,
    });
  }
  return vessels;
}

// AISHub endpoint — needs free registration at aishub.net
// Returns vessels in a given bounding box
async function fetchAISHub(latMin: number, latMax: number, lonMin: number, lonMax: number): Promise<AisVessel[]> {
  const apiKey = process.env.AISHUB_API_KEY;
  if (!apiKey) return [];
  const url = `https://data.aishub.net/ws.php?username=${apiKey}&format=1&output=json&latmin=${latMin}&latmax=${latMax}&lonmin=${lonMin}&lonmax=${lonMax}`;
  const res = await fetch(url, { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  // AISHub returns [[meta], [vessel, ...]] array structure
  const vesselList = Array.isArray(data) && data.length > 1 ? data[1] : [];
  return vesselList.map((v: any) => ({
    mmsi: String(v.MMSI || ''),
    name: v.NAME?.trim() || `MMSI ${v.MMSI}`,
    lat: parseFloat(v.LATITUDE),
    lng: parseFloat(v.LONGITUDE),
    heading: v.HEADING ?? v.COG ?? 0,
    speed: v.SPEED ?? 0,
    shipType: v.TYPE ?? 0,
    callsign: v.CALLSIGN,
    flag: v.FLAG,
  }));
}

// Simulated Hormuz / Gulf vessels from OSINT naval intelligence
// Used as fallback when no live AIS API is configured
function getStaticHormuzVessels(): AisVessel[] {
  return [
    // Iranian IRGC patrol boats — Hormuz
    { mmsi: '422012345', name: 'IRGC PATROL-1', lat: 26.56, lng: 56.25, heading: 280, speed: 18, shipType: 35, flag: 'IR' },
    { mmsi: '422012346', name: 'IRGC PATROL-2', lat: 26.48, lng: 56.91, heading: 95, speed: 12, shipType: 35, flag: 'IR' },
    { mmsi: '422098001', name: 'ALVAND', lat: 27.1, lng: 56.5, heading: 210, speed: 8, shipType: 37, flag: 'IR' },
    // Tankers transiting Hormuz
    { mmsi: '205761000', name: 'NORDIC LUNA', lat: 26.52, lng: 57.1, heading: 315, speed: 14, shipType: 80, flag: 'BE' },
    { mmsi: '636016718', name: 'GULF NAVIGATOR', lat: 26.45, lng: 56.8, heading: 130, speed: 13, shipType: 80, flag: 'LR' },
    { mmsi: '477173300', name: 'PACIFIC CARRIER', lat: 26.6, lng: 57.3, heading: 320, speed: 12, shipType: 70, flag: 'HK' },
    // USN escorts — Persian Gulf
    { mmsi: '338234567', name: 'USS LABOON', lat: 24.8, lng: 53.9, heading: 45, speed: 16, shipType: 35, flag: 'US' },
    { mmsi: '338234568', name: 'USS BULKELEY', lat: 25.1, lng: 54.3, heading: 180, speed: 14, shipType: 35, flag: 'US' },
    // UKMTO monitored vessels
    { mmsi: '563085600', name: 'ANDROMEDA STAR', lat: 25.9, lng: 55.6, heading: 270, speed: 11, shipType: 70, flag: 'SG' },
  ];
}

// Map AIS ship type to color matching existing OPTICON palette
function shipColor(type: number, flag?: string): string {
  // Military / government
  if (type === 35) {
    if (flag === 'US') return '#89b4fa'; // US navy blue
    if (flag === 'RU') return '#f38ba8'; // Russian red
    if (flag === 'IR' || flag === 'IRN') return '#fab387'; // Iranian orange
    if (flag === 'CN') return '#f38ba8'; // Chinese red-ish
    if (flag === 'GB' || flag === 'UK') return '#cba6f7'; // UK purple
    return '#89dceb'; // generic military teal
  }
  // Tankers
  if (type >= 80 && type <= 89) return '#f9e2af'; // yellow
  // Cargo
  if (type >= 70 && type <= 79) return '#a6e3a1'; // green
  // Passenger
  if (type >= 60 && type <= 69) return '#74c7ec'; // light blue
  return '#a6adc8'; // grey fallback
}

export async function GET() {
  try {
    // Try AISHub first for Hormuz (if key configured)
    let vessels: AisVessel[] = [];
    for (const area of FOCUS_AREAS) {
      const aishubVessels = await fetchAISHub(area.latMin, area.latMax, area.lonMin, area.lonMax);
      vessels.push(...aishubVessels);
    }

    // Also fetch Digitraffic (free, no auth) for Baltic coverage demo
    const digitrafficVessels = await fetchDigitraffic();

    // Filter Digitraffic to focus areas only (it covers Baltic, not Hormuz)
    const allVessels = [...vessels, ...digitrafficVessels].filter(v => {
      if (!v.lat || !v.lng || isNaN(v.lat) || isNaN(v.lng)) return false;
      return FOCUS_AREAS.some(a =>
        v.lat >= a.latMin && v.lat <= a.latMax && v.lng >= a.lonMin && v.lng <= a.lonMax
      );
    });

    // If no live data, use static Hormuz vessels
    const finalVessels = allVessels.length > 0 ? allVessels : getStaticHormuzVessels();

    // Deduplicate by MMSI
    const seen = new Set<string>();
    const unique = finalVessels.filter(v => {
      if (seen.has(v.mmsi)) return false;
      seen.add(v.mmsi);
      return true;
    });

    // Convert to GeoJSON FeatureCollection
    const features = unique.map(v => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [v.lng, v.lat] },
      properties: {
        id: `ais-${v.mmsi}`,
        mmsi: v.mmsi,
        name: v.name,
        heading: v.heading || 0,
        speed: v.speed || 0,
        shipType: v.shipType || 0,
        flag: v.flag || '',
        callsign: v.callsign || '',
        color: shipColor(v.shipType, v.flag),
        isLive: true,
        ts: Date.now(),
      },
    }));

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      meta: {
        count: features.length,
        source: allVessels.length > 0 ? 'live' : 'static-osint',
        ts: Date.now(),
      },
    });
  } catch (err) {
    console.error('[AIS] fetch error', err);
    // Always return something valid
    const fallback = getStaticHormuzVessels();
    const features = fallback.map(v => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [v.lng, v.lat] },
      properties: {
        id: `ais-${v.mmsi}`,
        mmsi: v.mmsi,
        name: v.name,
        heading: v.heading,
        speed: v.speed,
        shipType: v.shipType,
        flag: v.flag || '',
        callsign: '',
        color: shipColor(v.shipType, v.flag),
        isLive: false,
        ts: Date.now(),
      },
    }));
    return NextResponse.json({ type: 'FeatureCollection', features, meta: { count: features.length, source: 'fallback', ts: Date.now() } });
  }
}
