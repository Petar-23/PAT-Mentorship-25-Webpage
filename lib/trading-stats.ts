// src/lib/trading-stats.ts

import type { TradingDay } from '@/components/tradingData/trading-performance-data';

export interface TradingStats {
  winRate: string;
  profitFactor: string;
  avgWinLossRatio: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalReturn: string;
}

export function calculateTradingStats(data: TradingDay[]): TradingStats {
  let winCount = 0;
  let lossCount = 0;
  let totalWins = 0;
  let totalLosses = 0;
  
  const allTrades = data.flatMap(day => day.trades);
  const totalTrades = allTrades.length;
  
  allTrades.forEach(trade => {
    if (trade.pnl > 0) {
      winCount++;
      totalWins += trade.pnl;
    } else if (trade.pnl < 0) {
      lossCount++;
      totalLosses += Math.abs(trade.pnl);
    }
  });

  const winRate = (winCount / (winCount + lossCount)) * 100;
  const avgWin = winCount > 0 ? totalWins / winCount : 0;
  const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;
  const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin;

  // Calculate total return
  const initialEquity = data[0]?.equity || 0;
  const finalEquity = data[data.length - 1]?.equity || 0;
  const totalReturn = ((finalEquity - initialEquity) / initialEquity) * 100;

  return {
    winRate: winRate.toFixed(1),
    profitFactor: profitFactor.toFixed(2),
    avgWinLossRatio: avgWinLossRatio.toFixed(2),
    totalTrades,
    winningTrades: winCount,
    losingTrades: lossCount,
    totalReturn: totalReturn.toFixed(1)
  };
}