'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, BarChart3, Gem, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import type { ThemeColors } from '../types';

interface MarketRow {
  name: string;
  region?: string;
  price: string;
  change: string;
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
  const neg = data.filter(r => r.change.startsWith('-') && r.change !== '-').length;
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
      padding: '8px 12px',
      fontSize: 11,
      color: theme.overlay0,
      textTransform: 'uppercase',
      letterSpacing: '1px',
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
      height: 36,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderBottom: `1px solid ${(theme.surface0 as string) + '22'}`,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.name}
        </span>
        {row.region && (
          <span style={{
            fontSize: 8,
            padding: '1px 4px',
            background: theme.overlay0 + '33',
            color: theme.overlay0,
            borderRadius: 2,
            marginLeft: 6,
            flexShrink: 0,
          }}>
            {row.region}
          </span>
        )}
      </div>
      <span style={{ fontSize: 13, color: theme.subtext0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 90, whiteSpace: 'nowrap' }}>
        {row.price}
      </span>
      <span style={{ fontSize: 12, textAlign: 'right', minWidth: 65, color: changeColor, fontVariantNumeric: 'tabular-nums' }}>
        {row.change}
      </span>
      <span style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
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
    <div style={{
      borderRadius: 6,
      background: theme.mantle + 'ee',
      border: `1px solid ${theme.surface0}`,
      boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: collapsed ? 'none' : `1px solid ${theme.surface0}`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={14} color={theme.blue} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: theme.text }}>
            MARKETS
          </span>
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            background: sentimentColor + '33',
            color: sentimentColor,
            borderRadius: 3,
          }}>
            {sentiment}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} color={theme.overlay0} />
          {collapsed
            ? <ChevronDown size={14} color={theme.overlay0} />
            : <ChevronUp size={14} color={theme.overlay0} />}
        </div>
      </div>

      {/* Collapsible content */}
      <div style={{
        maxHeight: collapsed ? 0 : 400,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}>
        <SectionHeader icon={<BarChart3 size={11} />} label="INDICES" theme={theme} />
        {INDICES.map(r => <Row key={r.name} row={r} theme={theme} />)}

        <SectionHeader icon={<Gem size={11} />} label="COMMODITIES" theme={theme} />
        {COMMODITIES.map(r => <Row key={r.name} row={r} theme={theme} />)}

        <SectionHeader icon={<DollarSign size={11} />} label="FOREX" theme={theme} />
        {FOREX.map(r => <Row key={r.name} row={r} theme={theme} />)}
      </div>
    </div>
  );
}
