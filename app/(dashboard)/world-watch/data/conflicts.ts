export interface ActiveConflict {
  id: string;
  name: string;
  shortName: string;
  parties: string[];
  status: 'active-war' | 'escalating' | 'ceasefire' | 'frozen';
  region: string;
  startDate: string;
  lat: number;
  lng: number;
  zoom: number;
  bounds: [number, number][];
  keywords: string[];
  color: string;
  severity: 'critical' | 'high' | 'medium';
}

export const ACTIVE_CONFLICTS: ActiveConflict[] = [
  {
    id: 'ru-ua',
    name: 'Russia-Ukraine War',
    shortName: 'UKRAINE',
    parties: ['Russia', 'Ukraine'],
    status: 'active-war',
    region: 'Eastern Europe',
    startDate: '2022-02-24',
    lat: 48.5,
    lng: 37.0,
    zoom: 6,
    bounds: [
      [52.4, 22.1],
      [52.4, 40.2],
      [44.3, 40.2],
      [44.3, 22.1],
    ],
    keywords: ['ukraine', 'ukrainian', 'kyiv', 'kiev', 'donbas', 'donetsk', 'luhansk', 'crimea', 'kherson', 'zaporizhzhia', 'odesa', 'kharkiv', 'zelensky', 'zelenskyy', 'russian invasion', 'bakhmut', 'avdiivka', 'kursk'],
    color: '#89b4fa',
    severity: 'critical',
  },
  {
    id: 'il-ps',
    name: 'Israel-Palestine Conflict',
    shortName: 'GAZA',
    parties: ['Israel', 'Hamas', 'Hezbollah'],
    status: 'active-war',
    region: 'Middle East',
    startDate: '2023-10-07',
    lat: 31.4,
    lng: 34.5,
    zoom: 8,
    bounds: [
      [33.5, 34.0],
      [33.5, 36.0],
      [29.5, 36.0],
      [29.5, 34.0],
    ],
    keywords: ['israel', 'israeli', 'gaza', 'hamas', 'hezbollah', 'netanyahu', 'idf', 'west bank', 'palestinian', 'rafah', 'tel aviv', 'jerusalem', 'hostage', 'ceasefire gaza', 'lebanese', 'lebanon war'],
    color: '#f38ba8',
    severity: 'critical',
  },
  {
    id: 'ir-us',
    name: 'Iran-US/Israel Tensions',
    shortName: 'IRAN',
    parties: ['Iran', 'United States', 'Israel'],
    status: 'escalating',
    region: 'Middle East / Persian Gulf',
    startDate: '2024-01-01',
    lat: 32.4,
    lng: 53.7,
    zoom: 5,
    bounds: [
      [40.0, 44.0],
      [40.0, 63.5],
      [25.0, 63.5],
      [25.0, 44.0],
    ],
    keywords: ['iran', 'iranian', 'tehran', 'irgc', 'strait of hormuz', 'persian gulf', 'houthi', 'red sea', 'proxy war', 'nuclear iran', 'sanctions iran', 'axis of resistance'],
    color: '#fab387',
    severity: 'high',
  },
  {
    id: 'sudan',
    name: 'Sudan Civil War',
    shortName: 'SUDAN',
    parties: ['SAF', 'RSF'],
    status: 'active-war',
    region: 'East Africa',
    startDate: '2023-04-15',
    lat: 15.0,
    lng: 32.5,
    zoom: 6,
    bounds: [
      [22.2, 21.8],
      [22.2, 38.6],
      [8.7, 38.6],
      [8.7, 21.8],
    ],
    keywords: ['sudan', 'sudanese', 'khartoum', 'darfur', 'rsf', 'rapid support forces', 'hemeti'],
    color: '#f9e2af',
    severity: 'high',
  },
  {
    id: 'myanmar',
    name: 'Myanmar Civil War',
    shortName: 'MYANMAR',
    parties: ['Military Junta', 'NUG/PDF', 'Ethnic Armies'],
    status: 'active-war',
    region: 'Southeast Asia',
    startDate: '2021-02-01',
    lat: 19.8,
    lng: 96.2,
    zoom: 6,
    bounds: [
      [28.5, 92.2],
      [28.5, 101.2],
      [9.8, 101.2],
      [9.8, 92.2],
    ],
    keywords: ['myanmar', 'burma', 'junta', 'naypyidaw', 'rohingya'],
    color: '#94e2d5',
    severity: 'medium',
  },
  {
    id: 'sahel',
    name: 'Sahel Insurgency',
    shortName: 'SAHEL',
    parties: ['JNIM', 'ISGS', 'Various States'],
    status: 'active-war',
    region: 'West Africa',
    startDate: '2012-01-01',
    lat: 14.5,
    lng: 2.0,
    zoom: 5,
    bounds: [
      [25.0, -17.0],
      [25.0, 16.0],
      [10.0, 16.0],
      [10.0, -17.0],
    ],
    keywords: ['sahel', 'mali', 'burkina faso', 'niger', 'boko haram', 'isis sahel', 'wagner africa', 'jnim'],
    color: '#cba6f7',
    severity: 'medium',
  },
  {
    id: 'taiwan-strait',
    name: 'Taiwan Strait Tensions',
    shortName: 'TAIWAN',
    parties: ['China', 'Taiwan', 'United States'],
    status: 'escalating',
    region: 'Indo-Pacific',
    startDate: '2022-08-01',
    lat: 24.0,
    lng: 121.0,
    zoom: 6,
    bounds: [
      [26.0, 117.0],
      [26.0, 123.0],
      [21.0, 123.0],
      [21.0, 117.0],
    ],
    keywords: ['taiwan', 'taiwanese', 'taipei', 'taiwan strait', 'south china sea', 'china military', 'pla', 'one china'],
    color: '#74c7ec',
    severity: 'medium',
  },
];
