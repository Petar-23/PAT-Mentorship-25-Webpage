import type { DataLayer, LayerPoint, LayerArc } from '../types';

// ─── MILITARY BASES ───────────────────────────────────────────────────────────
const militaryBases: LayerPoint[] = [
  // ── USA ──────────────────────────────────────────────────────────────────────
  { id: 'mb-001', lat: 21.46, lng: -157.97, label: 'Pearl Harbor NWS', subLabel: 'US Navy HQ Pacific', color: '#89b4fa' },
  { id: 'mb-002', lat: 13.58, lng: 144.93, label: 'Andersen AFB', subLabel: 'US Air Force, Guam', color: '#89b4fa' },
  { id: 'mb-003', lat: 35.55, lng: 139.77, label: 'Yokota AB', subLabel: 'US Air Force, Japan', color: '#89b4fa' },
  { id: 'mb-004', lat: 37.12, lng: 127.06, label: 'Camp Humphreys', subLabel: 'US Army, South Korea — largest overseas', color: '#89b4fa' },
  { id: 'mb-005', lat: 26.27, lng: 127.74, label: 'Kadena AB', subLabel: 'US Air Force, Okinawa', color: '#89b4fa' },
  { id: 'mb-006', lat: 36.87, lng: -76.30, label: 'Naval Station Norfolk', subLabel: 'US Navy, Virginia — world\'s largest naval base', color: '#89b4fa' },
  { id: 'mb-007', lat: 30.47, lng: -86.53, label: 'Eglin AFB', subLabel: 'US Air Force, Florida', color: '#89b4fa' },
  { id: 'mb-008', lat: -7.32, lng: 72.42, label: 'Diego Garcia', subLabel: 'US/UK Naval & Air, BIOT Indian Ocean', color: '#89b4fa' },
  { id: 'mb-009', lat: 36.63, lng: -4.50, label: 'Naval Station Rota', subLabel: 'US Navy, Spain — key Atlantic hub', color: '#89b4fa' },
  { id: 'mb-010', lat: 43.83, lng: 18.33, label: 'Eagle Base', subLabel: 'US Army, Bosnia', color: '#89b4fa' },
  { id: 'mb-011', lat: 41.69, lng: 20.43, label: 'Camp Bondsteel', subLabel: 'US Army, Kosovo — KFOR HQ', color: '#89b4fa' },
  { id: 'mb-012', lat: 49.44, lng: 7.60, label: 'Ramstein AB', subLabel: 'US Air Force, Germany — USAFE/AFAFRICA HQ', color: '#89b4fa' },
  { id: 'mb-013', lat: 45.99, lng: 12.60, label: 'Aviano AB', subLabel: 'US Air Force, Italy — 31st FW', color: '#89b4fa' },
  { id: 'mb-014', lat: 19.72, lng: -155.08, label: 'Pohakuloa TS', subLabel: 'US Army, Hawaii', color: '#89b4fa' },
  { id: 'mb-015', lat: 28.23, lng: -80.60, label: 'Patrick SFB', subLabel: 'US Space Force, Florida', color: '#89b4fa' },
  { id: 'mb-016', lat: 38.81, lng: -77.05, label: 'Fort Myer-Henderson Hall', subLabel: 'US Army, Arlington VA', color: '#89b4fa' },
  { id: 'mb-017', lat: 30.55, lng: -97.64, label: 'Fort Cavazos', subLabel: 'US Army, Texas — III Corps HQ', color: '#89b4fa' },
  { id: 'mb-018', lat: 35.14, lng: 33.93, label: 'Akrotiri RAF', subLabel: 'UK/US shared, Cyprus — SBA', color: '#89b4fa' },
  { id: 'mb-019', lat: 11.58, lng: 43.15, label: 'Camp Lemonnier', subLabel: 'US AFRICOM/NAVAF, Djibouti', color: '#89b4fa' },
  { id: 'mb-020', lat: 33.96, lng: 130.87, label: 'Sasebo Naval', subLabel: 'US Navy, Japan', color: '#89b4fa' },
  { id: 'mb-021', lat: 37.45, lng: 127.01, label: 'Osan AB', subLabel: 'US Air Force, South Korea — 7AF HQ', color: '#89b4fa' },
  { id: 'mb-022', lat: 14.18, lng: -87.10, label: 'Soto Cano AB', subLabel: 'US SOUTHCOM/JTF-Bravo, Honduras', color: '#89b4fa' },
  { id: 'mb-023', lat: 9.00, lng: -79.60, label: 'Howard AFB', subLabel: 'US, Panamá', color: '#89b4fa' },
  { id: 'mb-024', lat: 19.91, lng: -75.16, label: 'Guantanamo Bay', subLabel: 'US Naval Station, Cuba', color: '#89b4fa' },
  { id: 'mb-025', lat: 32.84, lng: -117.16, label: 'MCAS Miramar', subLabel: 'US Marine Corps, California', color: '#89b4fa' },
  { id: 'mb-026', lat: 47.52, lng: -122.68, label: 'NSAB Bremerton', subLabel: 'US Navy, Washington — USS Nimitz homeport', color: '#89b4fa' },
  { id: 'mb-027', lat: 30.20, lng: 66.94, label: 'Al Udeid AB', subLabel: 'US Air Force, Qatar — CENTCOM Forward HQ', color: '#89b4fa' },
  { id: 'mb-028', lat: 24.43, lng: 54.65, label: 'Al Dhafra AB', subLabel: 'US Air Force, UAE', color: '#89b4fa' },
  { id: 'mb-029', lat: 29.23, lng: 47.97, label: 'Ali Al Salem AB', subLabel: 'US Air Force, Kuwait', color: '#89b4fa' },
  { id: 'mb-030', lat: 33.43, lng: 44.36, label: 'Al Asad AB', subLabel: 'US Army, Iraq — Anbar Province', color: '#89b4fa' },
  // ── RUSSIA ───────────────────────────────────────────────────────────────────
  { id: 'mb-040', lat: 35.16, lng: 36.05, label: 'Khmeimim AB', subLabel: 'Russia Air Force, Syria', color: '#f38ba8' },
  { id: 'mb-041', lat: 34.96, lng: 35.94, label: 'Tartus Naval', subLabel: 'Russia Navy, Syria — only Mediterranean base', color: '#f38ba8' },
  { id: 'mb-042', lat: 44.72, lng: 33.37, label: 'Sevastopol', subLabel: 'Russia Black Sea Fleet HQ', color: '#f38ba8' },
  { id: 'mb-043', lat: 43.13, lng: 131.92, label: 'Vladivostok', subLabel: 'Russia Pacific Fleet HQ', color: '#f38ba8' },
  { id: 'mb-044', lat: 68.97, lng: 33.09, label: 'Severomorsk', subLabel: 'Russia Northern Fleet HQ', color: '#f38ba8' },
  { id: 'mb-045', lat: 54.72, lng: 20.51, label: 'Kaliningrad Oblast', subLabel: 'Russia — Baltic exclave, Iskander missiles', color: '#f38ba8' },
  { id: 'mb-046', lat: 63.17, lng: 29.46, label: 'Nikel Air Base', subLabel: 'Russia, near Finnish border', color: '#f38ba8' },
  { id: 'mb-047', lat: 69.73, lng: 30.08, label: 'Pechenga Garrison', subLabel: 'Russia Arctic, Norway border', color: '#f38ba8' },
  { id: 'mb-048', lat: 55.47, lng: 37.32, label: 'Kubinka AB', subLabel: 'Russia Air Force, Moscow district', color: '#f38ba8' },
  { id: 'mb-049', lat: 56.84, lng: 60.63, label: 'Yekaterinburg Garrison', subLabel: 'Russia Central Military District', color: '#f38ba8' },
  { id: 'mb-050', lat: 48.46, lng: 135.07, label: 'Khabarovsk Garrison', subLabel: 'Russia Eastern Military District', color: '#f38ba8' },
  { id: 'mb-051', lat: 58.60, lng: 49.66, label: 'Kirov RVSN Base', subLabel: 'Russia ICBM missile division', color: '#f38ba8' },
  { id: 'mb-052', lat: 53.18, lng: 50.10, label: 'Togliatti-Engels AB', subLabel: 'Russia Tu-160 strategic bombers', color: '#f38ba8' },
  { id: 'mb-053', lat: 14.94, lng: -23.50, label: 'Russia Spy Ship Station', subLabel: 'Russia intelligence, Atlantic listening post', color: '#f38ba8' },
  // ── CHINA ────────────────────────────────────────────────────────────────────
  { id: 'mb-060', lat: 11.47, lng: 43.05, label: 'PLA Djibouti Base', subLabel: 'PLA Navy — first overseas base', color: '#fab387' },
  { id: 'mb-061', lat: 9.97, lng: 114.01, label: 'Fiery Cross Reef', subLabel: 'PLA, SCS — artificial island, airstrip', color: '#fab387' },
  { id: 'mb-062', lat: 10.23, lng: 113.82, label: 'Mischief Reef', subLabel: 'PLA, SCS — artificial island', color: '#fab387' },
  { id: 'mb-063', lat: 10.71, lng: 114.47, label: 'Subi Reef', subLabel: 'PLA, SCS — artificial island, radar', color: '#fab387' },
  { id: 'mb-064', lat: 39.91, lng: 116.39, label: 'Beijing Joint HQ', subLabel: 'PLA Strategic HQ, Central Theater', color: '#fab387' },
  { id: 'mb-065', lat: 22.25, lng: 113.92, label: 'Zhuhai Naval', subLabel: 'PLA South Sea Fleet', color: '#fab387' },
  { id: 'mb-066', lat: 30.68, lng: 103.99, label: 'Chengdu Garrison', subLabel: 'PLA Western Theater Command', color: '#fab387' },
  { id: 'mb-067', lat: 36.06, lng: 103.83, label: 'Lanzhou Garrison', subLabel: 'PLA Northwestern Command', color: '#fab387' },
  { id: 'mb-068', lat: 43.80, lng: 87.60, label: 'Ürümqi Military', subLabel: 'PLA Xinjiang garrison', color: '#fab387' },
  { id: 'mb-069', lat: 29.65, lng: 91.11, label: 'Lhasa Garrison', subLabel: 'PLA Tibet garrison', color: '#fab387' },
  { id: 'mb-070', lat: 22.50, lng: 113.96, label: 'Yulin Naval Base', subLabel: 'PLA Navy, Hainan — submarine base', color: '#fab387' },
  { id: 'mb-071', lat: 30.88, lng: 121.17, label: 'Donghai Fleet HQ', subLabel: 'PLA Navy, Shanghai', color: '#fab387' },
  // ── UK ───────────────────────────────────────────────────────────────────────
  { id: 'mb-080', lat: 34.57, lng: 32.97, label: 'Dhekelia SBA', subLabel: 'UK Sovereign Base, Cyprus', color: '#a6e3a1' },
  { id: 'mb-081', lat: 36.14, lng: -5.35, label: 'Gibraltar Garrison', subLabel: 'UK, Gibraltar — NATO chokepoint', color: '#a6e3a1' },
  { id: 'mb-082', lat: -7.31, lng: 72.41, label: 'Diego Garcia', subLabel: 'UK BIOT / US joint facility', color: '#a6e3a1' },
  { id: 'mb-083', lat: 4.94, lng: 115.00, label: 'Seria Garrison', subLabel: 'UK, Brunei', color: '#a6e3a1' },
  { id: 'mb-084', lat: -51.70, lng: -57.85, label: 'RAF Mount Pleasant', subLabel: 'UK Air Force, Falkland Islands', color: '#a6e3a1' },
  { id: 'mb-085', lat: 57.07, lng: -2.08, label: 'RAF Lossiemouth', subLabel: 'UK Air Force, Scotland — P-8 Maritime', color: '#a6e3a1' },
  { id: 'mb-086', lat: 52.21, lng: -2.19, label: 'RAF Credenhill', subLabel: 'UK SAS HQ, Hereford', color: '#a6e3a1' },
  // ── FRANCE ───────────────────────────────────────────────────────────────────
  { id: 'mb-090', lat: 11.53, lng: 43.14, label: 'Camp Lemonnier (FR)', subLabel: 'France, Djibouti — 5th BOMAR', color: '#cba6f7' },
  { id: 'mb-091', lat: 48.46, lng: -4.42, label: 'Brest Naval', subLabel: 'France Navy HQ, Atlantic', color: '#cba6f7' },
  { id: 'mb-092', lat: -17.54, lng: -149.57, label: 'Papeete Base', subLabel: 'France FANF, Tahiti', color: '#cba6f7' },
  { id: 'mb-093', lat: 43.10, lng: 5.93, label: 'Toulon Naval', subLabel: 'France Navy Mediterranean HQ — Charles de Gaulle', color: '#cba6f7' },
  { id: 'mb-094', lat: 24.47, lng: 54.40, label: 'Al Minhad AB', subLabel: 'France Air Force, UAE', color: '#cba6f7' },
  { id: 'mb-095', lat: 12.35, lng: 15.03, label: 'N\'Djamena (Barkhane)', subLabel: 'France, Chad', color: '#cba6f7' },
  { id: 'mb-096', lat: 14.14, lng: -10.45, label: 'Bamako Base', subLabel: 'France, Mali (Barkhane, withdrawn)', color: '#cba6f7' },
  // ── NATO ─────────────────────────────────────────────────────────────────────
  { id: 'mb-100', lat: 50.87, lng: 4.42, label: 'SHAPE (Mons)', subLabel: 'NATO Supreme HQ Allied Powers Europe', color: '#74c7ec' },
  { id: 'mb-101', lat: 51.00, lng: 5.97, label: 'Geilenkirchen AB', subLabel: 'NATO AWACS base, Germany', color: '#74c7ec' },
  { id: 'mb-102', lat: 40.94, lng: 14.43, label: 'JFC Naples', subLabel: 'NATO Joint Force Command, Italy', color: '#74c7ec' },
  { id: 'mb-103', lat: 41.00, lng: 28.90, label: 'İncirlik AB', subLabel: 'NATO, Turkey — US B61 nuclear bombs', color: '#74c7ec' },
  { id: 'mb-104', lat: 44.85, lng: 24.88, label: 'Deveselu', subLabel: 'NATO Aegis Ashore, Romania — BMD', color: '#74c7ec' },
  { id: 'mb-105', lat: 54.63, lng: 18.54, label: 'Redzikowo', subLabel: 'NATO Aegis Ashore, Poland — BMD', color: '#74c7ec' },
  { id: 'mb-106', lat: 56.98, lng: 24.07, label: 'Ādaži Base', subLabel: 'NATO/Latvia, eFP battlegroup', color: '#74c7ec' },
  { id: 'mb-107', lat: 59.44, lng: 24.73, label: 'Tapa Base', subLabel: 'NATO/Estonia, eFP battlegroup', color: '#74c7ec' },
  { id: 'mb-108', lat: 54.85, lng: 23.96, label: 'Rukla', subLabel: 'NATO/Lithuania, eFP battlegroup', color: '#74c7ec' },
  // ── IRAN & IRGC ──────────────────────────────────────────────────────────────
  { id: 'mb-110', lat: 35.69, lng: 51.39, label: 'IRGC Tehran HQ', subLabel: 'Iran, IRGC Aerospace Force', color: '#f38ba8' },
  { id: 'mb-111', lat: 32.29, lng: 48.71, label: 'Dezful AB', subLabel: 'Iran Air Force, Khuzestan', color: '#f38ba8' },
  { id: 'mb-112', lat: 27.22, lng: 56.28, label: 'Bandar Abbas Naval', subLabel: 'Iran Navy, Strait of Hormuz', color: '#f38ba8' },
  { id: 'mb-113', lat: 26.54, lng: 54.04, label: 'Qeshm Island Base', subLabel: 'Iran IRGCN, Gulf patrol', color: '#f38ba8' },
  // ── ISRAEL ───────────────────────────────────────────────────────────────────
  { id: 'mb-120', lat: 31.84, lng: 34.94, label: 'Palmachim AB', subLabel: 'Israel IAF — satellite launch, special units', color: '#94e2d5' },
  { id: 'mb-121', lat: 31.06, lng: 34.89, label: 'Nevatim AB', subLabel: 'Israel IAF — F-35I Adir home base', color: '#94e2d5' },
  { id: 'mb-122', lat: 29.56, lng: 34.96, label: 'Ramon AB', subLabel: 'Israel IAF, Negev', color: '#94e2d5' },
  { id: 'mb-123', lat: 31.22, lng: 34.36, label: 'Hatzerim AB', subLabel: 'Israel IAF — aerobatics school', color: '#94e2d5' },
  // ── INDIA & PAKISTAN ─────────────────────────────────────────────────────────
  { id: 'mb-130', lat: 12.95, lng: 74.84, label: 'INS Kadamba', subLabel: 'India Navy, Karwar — largest naval base Asia', color: '#94e2d5' },
  { id: 'mb-131', lat: 15.50, lng: 73.83, label: 'INS Hansa', subLabel: 'India Navy Air, Goa', color: '#94e2d5' },
  { id: 'mb-132', lat: 10.82, lng: 79.86, label: 'INS Baaz', subLabel: 'India Navy, Andaman Islands', color: '#94e2d5' },
  { id: 'mb-133', lat: 33.57, lng: 73.10, label: 'PAF Nur Khan AB', subLabel: 'Pakistan Air Force, Rawalpindi', color: '#f38ba8' },
  { id: 'mb-134', lat: 29.35, lng: 66.72, label: 'Panjgur Air Base', subLabel: 'Pakistan AF — near Iranian border', color: '#f38ba8' },
  // ── TURKEY ───────────────────────────────────────────────────────────────────
  { id: 'mb-140', lat: 39.91, lng: 32.83, label: 'Ankara Garrison', subLabel: 'Turkey Land Forces Command', color: '#94e2d5' },
  { id: 'mb-141', lat: 38.57, lng: 38.69, label: 'Malatya Radar Station', subLabel: 'NATO BMD X-band radar, Turkey', color: '#74c7ec' },
  { id: 'mb-142', lat: 40.13, lng: 26.41, label: 'Gallipoli Garrison', subLabel: 'Turkey Navy — Dardanelles control', color: '#94e2d5' },
  // ── NORTH KOREA ──────────────────────────────────────────────────────────────
  { id: 'mb-150', lat: 40.85, lng: 129.67, label: 'Punggye-ri', subLabel: 'North Korea — nuclear test site', color: '#f38ba8' },
  { id: 'mb-151', lat: 39.66, lng: 124.71, label: 'Sohae Satellite Launching', subLabel: 'North Korea — ICBM launch site', color: '#f38ba8' },
  { id: 'mb-152', lat: 39.95, lng: 125.89, label: 'Pyongyang Garrison', subLabel: 'Korean People\'s Army General HQ', color: '#f38ba8' },
  // ── SOUTH KOREA & JAPAN ──────────────────────────────────────────────────────
  { id: 'mb-160', lat: 37.51, lng: 126.85, label: 'ROKAF Osan HQ', subLabel: 'ROK Air Force, Combined Defense HQ', color: '#94e2d5' },
  { id: 'mb-161', lat: 35.10, lng: 129.04, label: 'ROK Navy Busan', subLabel: 'Republic of Korea Navy, main port', color: '#94e2d5' },
  { id: 'mb-162', lat: 34.85, lng: 137.43, label: 'JMSDF Atsugi', subLabel: 'Japan Maritime SDF, main naval air', color: '#94e2d5' },
  { id: 'mb-163', lat: 34.11, lng: 131.81, label: 'JGSDF Kengun', subLabel: 'Japan Ground SDF, Western Army HQ', color: '#94e2d5' },
  // ── AUSTRALIA ────────────────────────────────────────────────────────────────
  { id: 'mb-170', lat: -12.42, lng: 130.88, label: 'RAAF Darwin', subLabel: 'Australia Air Force — US Marines rotation', color: '#94e2d5' },
  { id: 'mb-171', lat: -32.24, lng: 115.81, label: 'RAAF Pearce', subLabel: 'Australia Air Force, Western Australia', color: '#94e2d5' },
  { id: 'mb-172', lat: -23.80, lng: 133.89, label: 'Pine Gap', subLabel: 'Australia/US joint intelligence facility', color: '#89b4fa' },
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
// Placeholder — will be populated by live AIS data in future
const shipPositions: LayerPoint[] = [];

// ─── AIRCRAFT TRACKING ───────────────────────────────────────────────────────
// Populated by OpenSky live API via world-watch-client.tsx
const aircraftPositions: LayerPoint[] = [];

// ─── PROTESTS ────────────────────────────────────────────────────────────────
// Populated by GDELT live API
const protests: LayerPoint[] = [];

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
    id: 'active-conflicts', name: 'Active Conflicts', icon: '⚔', enabled: true,
    type: 'points', color: '#f38ba8',
    points: [],
  },
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
  {
    id: 'pipelines', name: 'Gas & Oil Pipelines', icon: '⚡', enabled: false,
    type: 'arcs', color: '#a6e3a1',
    arcs: [],  // populated from /data/pipelines.json via Globe.tsx
  },
];
