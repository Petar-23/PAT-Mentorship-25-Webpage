import { NextResponse } from 'next/server';

export const revalidate = 60; // cache 1 min

const SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500', type: 'index' },
  { symbol: '^IXIC', name: 'NASDAQ', type: 'index' },
  { symbol: '^DJI', name: 'Dow Jones', type: 'index' },
  { symbol: '^GDAXI', name: 'DAX', type: 'index' },
  { symbol: '^FTSE', name: 'FTSE 100', type: 'index' },
  { symbol: '^N225', name: 'Nikkei 225', type: 'index' },
  { symbol: 'GC=F', name: 'Gold', type: 'commodity' },
  { symbol: 'CL=F', name: 'Crude Oil', type: 'commodity' },
  { symbol: 'SI=F', name: 'Silver', type: 'commodity' },
  { symbol: 'EURUSD=X', name: 'EUR/USD', type: 'forex' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD', type: 'forex' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', type: 'forex' },
];

export async function GET() {
  try {
    const results = await Promise.all(
      SYMBOLS.map(async ({ symbol, name, type }) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
            {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              next: { revalidate: 60 },
            }
          );
          const data = await res.json();
          const meta = data.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prevClose = meta.previousClose;
          const change = price - prevClose;
          const changePercent = (change / prevClose) * 100;

          return {
            symbol: name,
            price: price.toFixed(type === 'forex' ? 4 : 2),
            change: `${change >= 0 ? '+' : ''}${change.toFixed(type === 'forex' ? 4 : 2)}`,
            changePercent: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
            type,
          };
        } catch {
          return { symbol: name, price: '-', change: '-', changePercent: '-', type };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
