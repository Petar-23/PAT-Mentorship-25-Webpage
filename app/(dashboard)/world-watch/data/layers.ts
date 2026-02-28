import type { DataLayer, LayerPoint, LayerArc } from '../types';

// ─── MILITARY BASES ───────────────────────────────────────────────────────────
const militaryBases: LayerPoint[] = [
  // USA
  { id: 'mb-001', lat: 21.46, lng: -157.97, label: 'Pearl Harbor', subLabel: 'US Navy HQ Pacific', color: '#89b4fa' },
  { id: 'mb-002', lat: 13.58, lng: 144.93, label: 'Andersen AFB', subLabel: 'US Air Force, Guam', color: '#89b4fa' },
  { id: 'mb-003', lat: 35.55, lng: 139.77, label: 'Yokota AB', subLabel: 'US Air Force, Japan', color: '#89b4fa' },
  { id: 'mb-004', lat: 37.12, lng: 127.06, label: 'Camp Humphreys', subLabel: 'US Army, South Korea', color: '#89b4fa' },
  { id: 'mb-005', lat: 26.27, lng: 127.74, label: 'Kadena AB', subLabel: 'US Air Force, Okinawa', color: '#89b4fa' },
  { id: 'mb-006', lat: 36.87, lng: -76.30, label: 'Norfolk Naval', subLabel: 'US Navy, Virginia', color: '#89b4fa' },
  { id: 'mb-007', lat: 30.47, lng: -86.53, label: 'Eglin AFB', subLabel: 'US Air Force, Florida', color: '#89b4fa' },
  { id: 'mb-008', lat: -7.32, lng: 72.42, label: 'Diego Garcia', subLabel: 'US/UK Naval, BIOT', color: '#89b4fa' },
  { id: 'mb-009', lat: 49.97, lng: -97.25, label: 'CFB Winnipeg', subLabel: 'US pre-position, Canada', color: '#89b4fa' },
  { id: 'mb-010', lat: 36.63, lng: -4.50, label: 'Rota Naval', subLabel: 'US Navy, Spain', color: '#89b4fa' },
  { id: 'mb-011', lat: 43.83, lng: 18.33, label: 'Eagle Base', subLabel: 'US Army, Bosnia', color: '#89b4fa' },
  { id: 'mb-012', lat: 41.69, lng: 20.43, label: 'Camp Bondsteel', subLabel: 'US Army, Kosovo', color: '#89b4fa' },
  // Russia
  { id: 'mb-013', lat: 35.16, lng: 36.05, label: 'Khmeimim AB', subLabel: 'Russia Air Force, Syria', color: '#f38ba8' },
  { id: 'mb-014', lat: 34.96, lng: 35.94, label: 'Tartus Naval', subLabel: 'Russia Navy, Syria', color: '#f38ba8' },
  { id: 'mb-015', lat: 44.72, lng: 33.37, label: 'Sevastopol', subLabel: 'Russia Black Sea Fleet', color: '#f38ba8' },
  { id: 'mb-016', lat: 56.84, lng: 60.63, label: 'Yekaterinburg', subLabel: 'Russia Central HQ', color: '#f38ba8' },
  { id: 'mb-017', lat: 43.13, lng: 131.92, label: 'Vladivostok', subLabel: 'Russia Pacific Fleet', color: '#f38ba8' },
  { id: 'mb-018', lat: 68.97, lng: 33.09, label: 'Severomorsk', subLabel: 'Russia Northern Fleet', color: '#f38ba8' },
  { id: 'mb-019', lat: 11.58, lng: 43.15, label: 'Camp Lemonnier', subLabel: 'Russia ally, Djibouti', color: '#f38ba8' },
  // China
  { id: 'mb-020', lat: 11.47, lng: 43.05, label: 'Djibouti Base', subLabel: 'PLA Navy, Djibouti', color: '#fab387' },
  { id: 'mb-021', lat: 9.97, lng: 114.01, label: 'Fiery Cross Reef', subLabel: 'PLA, South China Sea', color: '#fab387' },
  { id: 'mb-022', lat: 10.23, lng: 113.82, label: 'Mischief Reef', subLabel: 'PLA, South China Sea', color: '#fab387' },
  { id: 'mb-023', lat: 39.91, lng: 116.39, label: 'Beijing HQ', subLabel: 'PLA Strategic HQ', color: '#fab387' },
  { id: 'mb-024', lat: 22.25, lng: 113.92, label: 'Zhuhai Naval', subLabel: 'PLA South Sea Fleet', color: '#fab387' },
  { id: 'mb-025', lat: 30.68, lng: 103.99, label: 'Chengdu Garrison', subLabel: 'PLA Western Theater', color: '#fab387' },
  // UK
  { id: 'mb-026', lat: 31.83, lng: -64.68, label: 'NAS Bermuda', subLabel: 'UK Navy, Bermuda', color: '#a6e3a1' },
  { id: 'mb-027', lat: 35.95, lng: 14.44, label: 'AFB Malta', subLabel: 'UK/NATO, Malta', color: '#a6e3a1' },
  { id: 'mb-028', lat: 1.27, lng: 103.82, label: 'Sembawang', subLabel: 'UK Navy, Singapore', color: '#a6e3a1' },
  { id: 'mb-029', lat: -7.31, lng: 72.41, label: 'Diego Garcia', subLabel: 'UK/US Shared, BIOT', color: '#a6e3a1' },
  // France
  { id: 'mb-030', lat: 11.53, lng: 43.14, label: 'Camp Lemonnier', subLabel: 'France, Djibouti', color: '#cba6f7' },
  { id: 'mb-031', lat: 48.46, lng: -4.42, label: 'Brest Naval', subLabel: 'France Navy HQ', color: '#cba6f7' },
  { id: 'mb-032', lat: -17.54, lng: -149.57, label: 'Papeete Base', subLabel: 'France, Tahiti', color: '#cba6f7' },
  { id: 'mb-033', lat: 43.10, lng: 5.93, label: 'Toulon Naval', subLabel: 'France Navy, Med', color: '#cba6f7' },
];

// ─── NUCLEAR FACILITIES ───────────────────────────────────────────────────────
const nuclearFacilities: LayerPoint[] = [
  // Power Plants
  { id: 'nf-001', lat: 48.45, lng: 6.78, label: 'Cattenom NPP', subLabel: '4×1300MW, France', color: '#f9e2af' },
  { id: 'nf-002', lat: 51.38, lng: -1.32, label: 'Aldermaston AWE', subLabel: 'UK Warhead facility', color: '#f38ba8' },
  { id: 'nf-003', lat: 47.62, lng: 8.23, label: 'Leibstadt NPP', subLabel: '1×1275MW, Switzerland', color: '#f9e2af' },
  { id: 'nf-004', lat: 35.32, lng: 136.02, label: 'Hamaoka NPP', subLabel: '3 reactors, Japan', color: '#f9e2af' },
  { id: 'nf-005', lat: 37.42, lng: 126.53, label: 'Hanul NPP', subLabel: 'S.Korea, 6 reactors', color: '#f9e2af' },
  { id: 'nf-006', lat: 61.28, lng: 21.44, label: 'Olkiluoto NPP', subLabel: 'Finland, 3 reactors', color: '#f9e2af' },
  { id: 'nf-007', lat: 35.70, lng: 139.77, label: 'Tokai-2 NPP', subLabel: 'Japan, 1×1100MW', color: '#f9e2af' },
  { id: 'nf-008', lat: 32.87, lng: 35.70, label: 'Dimona', subLabel: 'Israel weapons research', color: '#f38ba8' },
  { id: 'nf-009', lat: 33.24, lng: 48.30, label: 'Arak IR-40', subLabel: 'Iran heavy water', color: '#f38ba8' },
  { id: 'nf-010', lat: 29.65, lng: 60.94, label: 'Chagai Range', subLabel: 'Pakistan test site', color: '#f38ba8' },
  // Weapons Sites
  { id: 'nf-011', lat: 44.60, lng: 33.48, label: 'Balaklava Complex', subLabel: 'Russia nuclear storage', color: '#f38ba8' },
  { id: 'nf-012', lat: 51.19, lng: 58.29, label: 'Dombarovsky ICBM', subLabel: 'Russia SS-18 base', color: '#f38ba8' },
  { id: 'nf-013', lat: 51.56, lng: -0.10, label: 'Whitehall MOD', subLabel: 'UK nuclear command', color: '#f38ba8' },
  { id: 'nf-014', lat: 32.22, lng: 74.19, label: 'Sargodha AB', subLabel: 'Pakistan nuclear delivery', color: '#f38ba8' },
  { id: 'nf-015', lat: 41.00, lng: 28.90, label: 'İncirlik AB', subLabel: 'NATO B61 bombs, Turkey', color: '#f38ba8' },
  { id: 'nf-016', lat: 49.47, lng: 8.46, label: 'Büchel AB', subLabel: 'NATO B61 bombs, Germany', color: '#f38ba8' },
  { id: 'nf-017', lat: 40.18, lng: 29.28, label: 'Ghedi AB', subLabel: 'NATO B61 bombs, Italy', color: '#f38ba8' },
  { id: 'nf-018', lat: 50.56, lng: 5.44, label: 'Kleine Brogel AB', subLabel: 'NATO B61 bombs, Belgium', color: '#f38ba8' },
  { id: 'nf-019', lat: 39.04, lng: -104.70, label: 'NORAD/Peterson AFB', subLabel: 'US nuclear command', color: '#89b4fa' },
  { id: 'nf-020', lat: 38.56, lng: -97.44, label: 'McConnell AFB', subLabel: 'US B-2 nuclear bombers', color: '#89b4fa' },
];

// ─── UNDERSEA CABLES ──────────────────────────────────────────────────────────
const underseaCables: LayerArc[] = [
  { id: 'uc-001', startLat: 51.50, startLng: -0.13, endLat: 40.71, endLng: -74.01, label: 'TAT-14', color: '#89b4fa' },
  { id: 'uc-002', startLat: 35.68, startLng: 139.69, endLat: 37.77, endLng: -122.42, label: 'PLCN', color: '#89b4fa' },
  { id: 'uc-003', startLat: 22.32, startLng: 114.17, endLat: 37.77, endLng: -122.42, label: 'TPE', color: '#89b4fa' },
  { id: 'uc-004', startLat: 51.50, startLng: -0.13, endLat: 1.35, endLng: 103.82, label: 'EASSy', color: '#a6e3a1' },
  { id: 'uc-005', startLat: 40.71, startLng: -74.01, endLat: 4.69, endLng: -74.05, label: 'ARCOS', color: '#a6e3a1' },
  { id: 'uc-006', startLat: 35.68, startLng: 139.69, endLat: -33.87, endLng: 151.21, label: 'Southern Cross', color: '#94e2d5' },
  { id: 'uc-007', startLat: 22.32, startLng: 114.17, endLat: 1.35, endLng: 103.82, label: 'SMW5', color: '#94e2d5' },
  { id: 'uc-008', startLat: 1.35, startLng: 103.82, endLat: -6.17, endLng: 35.74, label: 'SAFE', color: '#a6e3a1' },
  { id: 'uc-009', startLat: 51.50, startLng: -0.13, endLat: 25.77, endLng: -80.19, label: 'FLAG Atlantic', color: '#89b4fa' },
  { id: 'uc-010', startLat: 37.77, startLng: -122.42, endLat: 21.46, endLng: -157.97, label: 'Hawaii-US', color: '#89b4fa' },
  { id: 'uc-011', startLat: 21.46, startLng: -157.97, endLat: 35.68, endLng: 139.69, label: 'TPC-5', color: '#89b4fa' },
  { id: 'uc-012', startLat: 48.86, startLng: 2.35, endLat: 40.41, endLng: -3.70, label: 'Laperouse', color: '#89b4fa' },
  { id: 'uc-013', startLat: 40.41, startLng: -3.70, endLat: 25.77, endLng: -80.19, label: 'Columbus-III', color: '#89b4fa' },
  { id: 'uc-014', startLat: -33.87, startLng: 151.21, endLat: -36.85, endLng: 174.76, label: 'Tasman-1', color: '#94e2d5' },
  { id: 'uc-015', startLat: 14.69, startLng: -17.44, endLat: -33.93, endLng: 25.57, label: 'SAT-3', color: '#a6e3a1' },
  { id: 'uc-016', startLat: 22.32, startLng: 114.17, endLat: 35.68, endLng: 139.69, label: 'SJC2', color: '#94e2d5' },
  { id: 'uc-017', startLat: 1.35, startLng: 103.82, endLat: -25.97, endLng: 32.58, label: 'SEACOM', color: '#a6e3a1' },
  { id: 'uc-018', startLat: 28.60, startLng: 77.21, endLat: 1.35, endLng: 103.82, label: 'Bay of Bengal', color: '#94e2d5' },
  { id: 'uc-019', startLat: 25.20, startLng: 55.27, endLat: 22.32, endLng: 114.17, label: 'SMW3 East', color: '#94e2d5' },
  { id: 'uc-020', startLat: 51.50, startLng: -0.13, endLat: 25.20, endLng: 55.27, label: 'SMW3 West', color: '#94e2d5' },
];

// ─── SHIP TRACKING ────────────────────────────────────────────────────────────
const shipPositions: LayerPoint[] = [
  { id: 'sh-001', lat: 1.35, lng: 104.20, label: 'MV EVER GIVEN', subLabel: 'Container', color: '#a6e3a1' },
  { id: 'sh-002', lat: 29.38, lng: 32.55, label: 'COSCO HOPE', subLabel: 'Container, Suez transit', color: '#a6e3a1' },
  { id: 'sh-003', lat: 12.79, lng: 45.40, label: 'GULF PIONEER', subLabel: 'Tanker, Gulf of Aden', color: '#fab387' },
  { id: 'sh-004', lat: 51.45, lng: 2.45, label: 'MSC ARIA', subLabel: 'Container, North Sea', color: '#a6e3a1' },
  { id: 'sh-005', lat: 37.91, lng: 23.95, label: 'AEGEAN BREEZE', subLabel: 'Cargo, Mediterranean', color: '#a6e3a1' },
  { id: 'sh-006', lat: 22.32, lng: 113.84, label: 'CHINA STAR', subLabel: 'VLCC Tanker', color: '#fab387' },
  { id: 'sh-007', lat: -33.58, lng: 26.89, label: 'CAPE HOPE', subLabel: 'Bulk Carrier, S.Africa', color: '#a6e3a1' },
  { id: 'sh-008', lat: -5.12, lng: 39.60, label: 'OCEAN PEARL', subLabel: 'LNG Tanker', color: '#89b4fa' },
  { id: 'sh-009', lat: 8.97, lng: -79.57, label: 'PANAMA STAR', subLabel: 'Container, Pacific', color: '#a6e3a1' },
  { id: 'sh-010', lat: 35.34, lng: 23.92, label: 'ARIS-13', subLabel: 'Tanker, Crete', color: '#fab387' },
  { id: 'sh-011', lat: 53.89, lng: 8.67, label: 'HAMBURG EXPRESS', subLabel: 'Container, Cuxhaven', color: '#a6e3a1' },
  { id: 'sh-012', lat: 55.68, lng: 12.57, label: 'SCANDINAVIAN', subLabel: 'Ro-Ro, Øresund', color: '#a6e3a1' },
  { id: 'sh-013', lat: -8.86, lng: 115.21, label: 'BALI SPIRIT', subLabel: 'Cruise, Lombok Strait', color: '#89b4fa' },
  { id: 'sh-014', lat: 14.29, lng: 42.87, label: 'POLAR STAR', subLabel: 'LNG, Red Sea', color: '#89b4fa' },
  { id: 'sh-015', lat: 25.77, lng: -80.19, label: 'MIAMI BRIDGE', subLabel: 'Container, Florida', color: '#a6e3a1' },
  { id: 'sh-016', lat: 59.91, lng: 10.76, label: 'NORD STREAM', subLabel: 'Supply, Oslofjord', color: '#a6e3a1' },
  { id: 'sh-017', lat: -25.86, lng: 32.95, label: 'MAPUTO TRADER', subLabel: 'Bulk, Mozambique', color: '#a6e3a1' },
  { id: 'sh-018', lat: 18.47, lng: -66.12, label: 'CARIBBEAN SUN', subLabel: 'Container, Puerto Rico', color: '#a6e3a1' },
  { id: 'sh-019', lat: 60.18, lng: -23.42, label: 'ATLANTIC NORTH', subLabel: 'Container, North Atlantic', color: '#a6e3a1' },
  { id: 'sh-020', lat: -17.73, lng: 177.44, label: 'PACIFIC PHOENIX', subLabel: 'LNG, Fiji region', color: '#89b4fa' },
  { id: 'sh-021', lat: 43.76, lng: -1.44, label: 'AZUL MARINE', subLabel: 'Tanker, Bay of Biscay', color: '#fab387' },
  { id: 'sh-022', lat: 3.54, lng: -8.68, label: 'GUINEA TRADER', subLabel: 'FPSO, Gulf of Guinea', color: '#fab387' },
  { id: 'sh-023', lat: 45.26, lng: 12.33, label: 'ADRIATIC STAR', subLabel: 'RoPax, Adriatic', color: '#a6e3a1' },
  { id: 'sh-024', lat: -4.03, lng: 39.66, label: 'MOMBASA LINK', subLabel: 'Cargo, Kenya coast', color: '#a6e3a1' },
  { id: 'sh-025', lat: 36.00, lng: 5.36, label: 'GIBRALTAR PASS', subLabel: 'Tanker, Strait of Gibraltar', color: '#fab387' },
  { id: 'sh-026', lat: 21.30, lng: -158.08, label: 'HAWAII CHIEF', subLabel: 'Container, Pearl Harbor approach', color: '#a6e3a1' },
  { id: 'sh-027', lat: 31.22, lng: 121.49, label: 'SHANGHAI EXPO', subLabel: 'ULCV, Yangshan Port', color: '#a6e3a1' },
  { id: 'sh-028', lat: -34.60, lng: -58.38, label: 'BUENOS AIRES', subLabel: 'Ro-Ro, Río de la Plata', color: '#a6e3a1' },
  { id: 'sh-029', lat: 10.32, lng: -61.42, label: 'PORT OF SPAIN', subLabel: 'Tanker, Trinidad', color: '#fab387' },
  { id: 'sh-030', lat: 64.13, lng: -21.95, label: 'REYKJAVIK RUN', subLabel: 'Supply, Iceland', color: '#89b4fa' },
];

// ─── AIRCRAFT TRACKING ───────────────────────────────────────────────────────
const aircraftPositions: LayerPoint[] = [
  { id: 'ac-001', lat: 51.50, lng: -30.00, label: 'BA001', subLabel: 'Boeing 747 LHR→JFK', color: '#89b4fa' },
  { id: 'ac-002', lat: 35.00, lng: 60.00, label: 'EK773', subLabel: 'A380 DXB→SYD', color: '#89b4fa' },
  { id: 'ac-003', lat: 25.00, lng: 100.00, label: 'CX831', subLabel: 'B777 HKG→LHR', color: '#89b4fa' },
  { id: 'ac-004', lat: -10.00, lng: 30.00, label: 'QF63', subLabel: 'B787 LHR→SYD', color: '#89b4fa' },
  { id: 'ac-005', lat: 60.00, lng: -70.00, label: 'AC848', subLabel: 'A330 YYZ→FRA', color: '#89b4fa' },
  { id: 'ac-006', lat: 50.00, lng: 20.00, label: 'LH500', subLabel: 'A340 FRA→JFK', color: '#89b4fa' },
  { id: 'ac-007', lat: -30.00, lng: 150.00, label: 'SQ281', subLabel: 'A350 SIN→SFO', color: '#89b4fa' },
  { id: 'ac-008', lat: 10.00, lng: -80.00, label: 'AA931', subLabel: 'B777 DFW→GRU', color: '#89b4fa' },
  { id: 'ac-009', lat: 30.00, lng: 45.00, label: 'TK001', subLabel: 'A350 IST→JFK', color: '#89b4fa' },
  { id: 'ac-010', lat: 55.00, lng: 80.00, label: 'SU100', subLabel: 'B737 SVO→PEK', color: '#89b4fa' },
  // Military
  { id: 'ac-011', lat: 68.00, lng: -20.00, label: 'DARK12', subLabel: 'RC-135W RIVET JOINT', color: '#f38ba8' },
  { id: 'ac-012', lat: 35.00, lng: 140.00, label: 'GIANT31', subLabel: 'P-8 Poseidon, ISR', color: '#f38ba8' },
  { id: 'ac-013', lat: 47.00, lng: 35.00, label: 'NATO03', subLabel: 'E-3 Sentry AWACS', color: '#f38ba8' },
  { id: 'ac-014', lat: 35.00, lng: 25.00, label: 'GHOST21', subLabel: 'RQ-4 Global Hawk', color: '#f38ba8' },
  { id: 'ac-015', lat: 27.00, lng: 60.00, label: 'DARK45', subLabel: 'U-2S surveillance', color: '#f38ba8' },
  { id: 'ac-016', lat: 65.00, lng: 10.00, label: 'COBRA11', subLabel: 'P-8 ASW patrol', color: '#f38ba8' },
  { id: 'ac-017', lat: 20.00, lng: 60.00, label: 'OPR99', subLabel: 'B-52H BUFF, Diego Garcia', color: '#f38ba8' },
  { id: 'ac-018', lat: 12.00, lng: 45.00, label: 'SHARK07', subLabel: 'MQ-9 Reaper, Yemen', color: '#f38ba8' },
  { id: 'ac-019', lat: 60.00, lng: 30.00, label: 'SIGINT2', subLabel: 'EP-3E ARIES II', color: '#f38ba8' },
  { id: 'ac-020', lat: 45.00, lng: -60.00, label: 'MANTA55', subLabel: 'E-6B TACAMO, Atlantic', color: '#f38ba8' },
];

// ─── PROTESTS ────────────────────────────────────────────────────────────────
const protests: LayerPoint[] = [
  { id: 'pr-001', lat: 48.86, lng: 2.35, label: 'Paris General Strike', subLabel: '200K protesters, pension reform', color: '#f9e2af' },
  { id: 'pr-002', lat: 41.01, lng: 28.96, label: 'Istanbul Opposition Rally', subLabel: '50K attendees, election integrity', color: '#f9e2af' },
  { id: 'pr-003', lat: 52.52, lng: 13.40, label: 'Berlin Climate March', subLabel: '80K Fridays for Future', color: '#f9e2af' },
  { id: 'pr-004', lat: -34.60, lng: -58.38, label: 'Buenos Aires Austerity Protest', subLabel: 'Anti-Milei, 30K workers', color: '#f9e2af' },
  { id: 'pr-005', lat: 28.61, lng: 77.21, label: 'New Delhi Farmers March', subLabel: 'Kisan Union, highway blockade', color: '#f9e2af' },
  { id: 'pr-006', lat: -26.20, lng: 28.04, label: 'Johannesburg Eskom Protests', subLabel: 'Load shedding anger, 15K', color: '#f9e2af' },
  { id: 'pr-007', lat: -12.04, lng: -77.03, label: 'Lima Anti-Government Rally', subLabel: 'Boluarte opposition, 25K', color: '#f9e2af' },
  { id: 'pr-008', lat: 37.57, lng: 126.98, label: 'Seoul Democracy Vigil', subLabel: 'Post-impeachment, 60K', color: '#f9e2af' },
  { id: 'pr-009', lat: 35.69, lng: 51.39, label: 'Tehran Workers Strike', subLabel: 'Unpaid wages, 10K workers', color: '#f9e2af' },
  { id: 'pr-010', lat: 51.51, lng: -0.13, label: 'London Gaza Solidarity', subLabel: 'UCU/SOAS, Whitehall march', color: '#f9e2af' },
];

// ─── INFRASTRUCTURE (Pipelines, Datacenters) ─────────────────────────────────
const infrastructure: LayerPoint[] = [
  { id: 'inf-001', lat: 40.34, lng: 49.83, label: 'BTC Pipeline Hub', subLabel: 'Baku-Tbilisi-Ceyhan', color: '#94e2d5' },
  { id: 'inf-002', lat: 54.63, lng: 23.88, label: 'Nord Stream 1 Rupture', subLabel: 'Baltic Sea sabotage site', color: '#f38ba8' },
  { id: 'inf-003', lat: 38.73, lng: 35.48, label: 'TANAP Terminal', subLabel: 'Trans-Anatolian Pipeline', color: '#94e2d5' },
  { id: 'inf-004', lat: 51.28, lng: -1.08, label: 'Equinix LD8', subLabel: 'Slough Megacampus, 25MW', color: '#89b4fa' },
  { id: 'inf-005', lat: 37.39, lng: -122.08, label: 'Google The Dalles', subLabel: 'Oregon datacenter, 100MW', color: '#89b4fa' },
  { id: 'inf-006', lat: 60.17, lng: 24.94, label: 'Hetzner Helsinki', subLabel: 'HEL DC, 60MW capacity', color: '#89b4fa' },
  { id: 'inf-007', lat: 59.43, lng: 24.75, label: 'Meta Luleå DC', subLabel: 'Sweden, 100% renewable', color: '#89b4fa' },
  { id: 'inf-008', lat: 25.20, lng: 55.27, label: 'UAE TCOM Hub', subLabel: 'Dubai IX, Middle East hub', color: '#89b4fa' },
  { id: 'inf-009', lat: -25.73, lng: 28.21, label: 'SA Internet Exchange', subLabel: 'JINX, Johannesburg', color: '#89b4fa' },
  { id: 'inf-010', lat: 1.35, lng: 103.82, label: 'Equinix SG1', subLabel: 'Singapore, Asia hub', color: '#89b4fa' },
];

// ─── LAYER DEFINITIONS ───────────────────────────────────────────────────────
export const defaultLayers: DataLayer[] = [
  {
    id: 'conflicts', name: 'Conflicts', icon: 'swords', enabled: true,
    type: 'points', color: '#f38ba8',
    points: [],  // populated from mockEvents by component
  },
  {
    id: 'disasters', name: 'Natural Disasters', icon: 'flame', enabled: true,
    type: 'points', color: '#fab387',
    points: [],  // populated from mockEvents by component
  },
  {
    id: 'cables', name: 'Undersea Cables', icon: 'cable', enabled: false,
    type: 'arcs', color: '#89b4fa',
    arcs: underseaCables,
  },
  {
    id: 'military', name: 'Military Bases', icon: '🎖️', enabled: false,
    type: 'points', color: '#89b4fa',
    points: militaryBases,
  },
  {
    id: 'nuclear', name: 'Nuclear Facilities', icon: 'radiation', enabled: false,
    type: 'points', color: '#f9e2af',
    points: nuclearFacilities,
  },
  {
    id: 'ships', name: 'Ship Tracking', icon: 'ship', enabled: false,
    type: 'points', color: '#a6e3a1',
    points: shipPositions,
  },
  {
    id: 'aircraft', name: 'Plane Tracking', icon: 'plane', enabled: false,
    type: 'points', color: '#89b4fa',
    points: aircraftPositions,
  },
  {
    id: 'protests', name: 'Protests', icon: '📢', enabled: false,
    type: 'points', color: '#f9e2af',
    points: protests,
  },
  {
    id: 'infrastructure', name: 'Infrastructure', icon: '🏗️', enabled: false,
    type: 'points', color: '#94e2d5',
    points: infrastructure,
  },
];
