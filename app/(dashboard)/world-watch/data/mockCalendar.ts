import type { EconCalendarEntry } from '../types';

// Next 7 days of economic events (CET timezone)
export const mockCalendar: EconCalendarEntry[] = [
  // Day 1
  {
    id: 'ec-001', time: '2026-03-03T09:00:00+01:00', currency: 'EUR', impact: 2,
    event: 'German Manufacturing PMI (Final)', forecast: '46.8', previous: '45.4', actual: '',
  },
  {
    id: 'ec-002', time: '2026-03-03T10:00:00+01:00', currency: 'EUR', impact: 2,
    event: 'Eurozone Composite PMI (Final)', forecast: '50.2', previous: '49.9', actual: '',
  },
  {
    id: 'ec-003', time: '2026-03-03T15:45:00+01:00', currency: 'USD', impact: 2,
    event: 'ISM Manufacturing PMI', forecast: '49.3', previous: '48.4', actual: '',
  },
  {
    id: 'ec-004', time: '2026-03-03T16:00:00+01:00', currency: 'USD', impact: 2,
    event: 'Construction Spending m/m', forecast: '0.1%', previous: '-0.2%', actual: '',
  },
  // Day 2
  {
    id: 'ec-005', time: '2026-03-04T11:00:00+01:00', currency: 'EUR', impact: 1,
    event: 'Eurozone PPI m/m', forecast: '0.3%', previous: '0.4%', actual: '',
  },
  {
    id: 'ec-006', time: '2026-03-04T14:30:00+01:00', currency: 'USD', impact: 2,
    event: 'Trade Balance', forecast: '-$68.2B', previous: '-$66.4B', actual: '',
  },
  // Day 3
  {
    id: 'ec-007', time: '2026-03-05T11:00:00+01:00', currency: 'EUR', impact: 3,
    event: 'Eurozone CPI Flash y/y', forecast: '2.3%', previous: '2.5%', actual: '',
  },
  {
    id: 'ec-008', time: '2026-03-05T14:15:00+01:00', currency: 'USD', impact: 3,
    event: 'ADP Non-Farm Employment Change', forecast: '145K', previous: '122K', actual: '',
  },
  {
    id: 'ec-009', time: '2026-03-05T16:00:00+01:00', currency: 'USD', impact: 3,
    event: 'ISM Services PMI', forecast: '52.4', previous: '52.8', actual: '',
  },
  // Day 4 — FOMC
  {
    id: 'ec-010', time: '2026-03-06T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'Initial Jobless Claims', forecast: '225K', previous: '219K', actual: '',
  },
  {
    id: 'ec-011', time: '2026-03-06T14:30:00+01:00', currency: 'USD', impact: 2,
    event: 'Continuing Jobless Claims', forecast: '1,870K', previous: '1,860K', actual: '',
  },
  {
    id: 'ec-012', time: '2026-03-06T16:00:00+01:00', currency: 'USD', impact: 3,
    event: 'FOMC Meeting Minutes', forecast: '-', previous: '-', actual: '',
  },
  // Day 5 — NFP Friday
  {
    id: 'ec-013', time: '2026-03-07T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'Non-Farm Payrolls', forecast: '185K', previous: '143K', actual: '',
  },
  {
    id: 'ec-014', time: '2026-03-07T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'Unemployment Rate', forecast: '4.1%', previous: '4.0%', actual: '',
  },
  {
    id: 'ec-015', time: '2026-03-07T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'Average Hourly Earnings m/m', forecast: '0.3%', previous: '0.4%', actual: '',
  },
  // Next week
  {
    id: 'ec-016', time: '2026-03-10T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'CPI m/m', forecast: '0.3%', previous: '0.5%', actual: '',
  },
  {
    id: 'ec-017', time: '2026-03-10T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'Core CPI m/m', forecast: '0.3%', previous: '0.4%', actual: '',
  },
  {
    id: 'ec-018', time: '2026-03-11T14:30:00+01:00', currency: 'USD', impact: 3,
    event: 'PPI m/m', forecast: '0.3%', previous: '0.4%', actual: '',
  },
  {
    id: 'ec-019', time: '2026-03-12T13:45:00+01:00', currency: 'EUR', impact: 3,
    event: 'ECB Interest Rate Decision', forecast: '3.15%', previous: '3.40%', actual: '',
  },
  {
    id: 'ec-020', time: '2026-03-12T14:30:00+01:00', currency: 'EUR', impact: 3,
    event: 'ECB Press Conference', forecast: '-', previous: '-', actual: '',
  },
];
