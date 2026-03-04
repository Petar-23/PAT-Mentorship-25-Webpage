'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, BarChart3, Gem, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import type { ThemeColors } from '../types';

interface MarketRow {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  type: string;
}

interface Props {
  theme: ThemeColors;
}

function getSentiment(data: MarketRow[]): 'BULLISH' | 'BEARISH' | 'MIXED' {
  const pos = data.filter(r => r.changePercent.startsWith('+')).length;
  const neg = data.filter(r => r.changePercent.startsWith('-') && r.changePercent !== '-').length;
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
  const isPos = row.changePercent.startsWith('+');
  const isNeg = row.changePercent.startsWith('-') && row.changePercent !== '-';
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
          {row.symbol}
        </span>
      </div>
      <span style={{ fontSize: 13, color: theme.subtext0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 90, whiteSpace: 'nowrap' }}>
        {row.price}
      </span>
      <span style={{ fontSize: 12, textAlign: 'right', minWidth: 65, color: changeColor, fontVariantNumeric: 'tabular-nums' }}>
        {row.changePercent}
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
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-watch/markets')
      .then(r => r.json())
      .then(data => { setMarkets(data); setLoading(false); })
      .catch(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/world-watch/markets')
        .then(r => r.json())
        .then(setMarkets)
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const indices = markets.filter(m => m.type === 'index');
  const commodities = markets.filter(m => m.type === 'commodity');
  const forex = markets.filter(m => m.type === 'forex');

  const sentiment = getSentiment([...indices, ...commodities]);
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
          {!loading && (
            <span style={{
              fontSize: 9,
              padding: '2px 6px',
              background: sentimentColor + '33',
              color: sentimentColor,
              borderRadius: 3,
            }}>
              {sentiment}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} color={loading ? theme.blue : theme.overlay0} style={loading ? { animation: 'wwSpin 1s linear infinite' } : undefined} />
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
        {loading ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: theme.overlay0, textAlign: 'center' }}>
            Loading market data...
          </div>
        ) : (
          <>
            <SectionHeader icon={<BarChart3 size={11} />} label="INDICES" theme={theme} />
            {indices.map(r => <Row key={r.symbol} row={r} theme={theme} />)}

            <SectionHeader icon={<Gem size={11} />} label="COMMODITIES" theme={theme} />
            {commodities.map(r => <Row key={r.symbol} row={r} theme={theme} />)}

            <SectionHeader icon={<DollarSign size={11} />} label="FOREX" theme={theme} />
            {forex.map(r => <Row key={r.symbol} row={r} theme={theme} />)}
          </>
        )}
      </div>
    </div>
  );
}
