'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, BarChart3, Gem, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import type { ThemeColors } from '../types';

interface MarketRow {
  name: string;
  region?: string;
  price: string;
  change: string; // e.g. '+1.38%' | '-0.97%' | '-'
}

const INDICES: MarketRow[] = [
  { name: 'S&P 500',     region: 'US', price: '6,878.88',  change: '-0.97%' },
  { name: 'NASDAQ',      region: 'US', price: '22,668.21', change: '-2.09%' },
  { name: 'Dow Jones',   region: 'US', price: '48,977.92', change: '-1.02%' },
  { name: 'DAX',         region: 'EU', price: '25,284.26', change: '+0.43%' },
  { name: 'FTSE 100',    region: 'UK', price: '10,910.55', change: '+0.96%' },
  { name: 'Nikkei 225',  region: 'JP', price: '58,850.27', change: '+0.16%' },
];

const COMMODITIES: MarketRow[] = [
  { name: 'Gold',       price: '5,247.90', change: '+1.38%' },
  { name: 'Crude Oil',  price: '67.02',    change: '+2.78%' },
  { name: 'Silver',     price: '93.29',    change: '+7.23%' },
];

const FOREX: MarketRow[] = [
  { name: 'EUR/USD', price: '1.1807',  change: '-' },
  { name: 'GBP/USD', price: '1.3478',  change: '-' },
  { name: 'USD/JPY', price: '156.04',  change: '-' },
];

interface Props {
  theme: ThemeColors;
}

function getSentiment(data: MarketRow[]): 'BULLISH' | 'BEARISH' | 'MIXED' {
  const pos = data.filter(r => r.change.startsWith('+')).length;
  const neg = data.filter(r => r.change.startsWith('-')).length;
  if (pos > neg * 2) return 'BULLISH';
  if (neg > pos * 2) return 'BEARISH';
  return 'MIXED';
}

function SectionHeader({ icon, label, theme }: { icon: React.ReactNode; label: string; theme: ThemeColors }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px 3px',
      fontSize: 11,
      color: theme.overlay0,
      textTransform: 'uppercase',
      letterSpacing: '1px',
      borderTop: `1px solid ${theme.surface0}44`,
      marginTop: 2,
    }}>
      {icon}
      {label}
    </div>
  );
}

function Row({ row, theme }: { row: MarketRow; theme: ThemeColors }) {
  const isPos = row.change.startsWith('+');
  const isNeg = row.change.startsWith('-') && row.change !== '-';
  const changeColor = isPos ? theme.green : isNeg ? theme.red : theme.overlay0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '3px 10px',
      gap: 4,
    }}>
      {/* Name + region */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.name}
        </span>
        {row.region && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
            background: theme.overlay0 + '33', color: theme.overlay0,
          }}>
            {row.region}
          </span>
        )}
      </div>
      {/* Price */}
      <span style={{ fontSize: 13, color: theme.subtext0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {row.price}
      </span>
      {/* Change */}
      <span style={{ fontSize: 12, color: changeColor, fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>
        {row.change}
      </span>
      {/* Arrow */}
      <span style={{ width: 14, flexShrink: 0 }}>
        {isPos && <TrendingUp size={12} color={theme.green} />}
        {isNeg && <TrendingDown size={12} color={theme.red} />}
      </span>
    </div>
  );
}

export function MarketsPanel({ theme }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const sentiment = getSentiment([...INDICES, ...COMMODITIES]);
  const sentimentColor = sentiment === 'BULLISH' ? theme.green : sentiment === 'BEARISH' ? theme.red : theme.yellow;

  return (
    <div>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'pointer',
          background: theme.surface0 + '44',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: theme.blue, textTransform: 'uppercase' }}>
            Markets
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
            background: sentimentColor + '33', color: sentimentColor, letterSpacing: '0.5px',
          }}>
            {sentiment}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={12} color={theme.overlay0} />
          {collapsed
            ? <ChevronDown size={14} color={theme.overlay0} />
            : <ChevronUp size={14} color={theme.overlay0} />}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          <SectionHeader icon={<BarChart3 size={11} />} label="Indices" theme={theme} />
          {INDICES.map(r => <Row key={r.name} row={r} theme={theme} />)}

          <SectionHeader icon={<Gem size={11} />} label="Commodities" theme={theme} />
          {COMMODITIES.map(r => <Row key={r.name} row={r} theme={theme} />)}

          <SectionHeader icon={<DollarSign size={11} />} label="Forex" theme={theme} />
          {FOREX.map(r => <Row key={r.name} row={r} theme={theme} />)}
        </div>
      )}
    </div>
  );
}
