// src/components/trading-performance-data.tsx

// Type definitions
export interface Trade {
    date: string;
    pnl: number;
  }
  
  export interface TradingDay {
    date: string;
    equity: number;
    trades: Trade[];
  }
  
  // Initial equity for P&L-based CSVs (not used for equity-curve CSVs)
  const INITIAL_EQUITY = 2000;
  
  // Helper to format date string to YYYY-MM-DD
  function formatDate(dateString: string): string {
    try {
      // Trim whitespace and extract date part
      const trimmed = dateString.trim();
      // Extract date part (2024-10-14 16:52:04 -> 2024-10-14)
      return trimmed.split(' ')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }
  
  // Process CSV data into structured trading data
  function processTradingData(csvData: string): TradingDay[] {
    try {
      const lines = csvData
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length <= 1) return [];

      // Try to auto-detect delimiter (comma vs semicolon) from header row
      const header = lines[0] ?? "";
      const commaCount = (header.match(/,/g) || []).length;
      const semicolonCount = (header.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ";" : ",";
      const headerLower = header.toLowerCase();
      const isEquityCurveCsv =
        headerLower.includes('equity') &&
        !headerLower.includes('p&l') &&
        !headerLower.includes('pnl');

      // Case 1: Equity curve CSV (Date + Equity)
      // Example:
      // ,Equity
      // 2025-11-05,2378.36
      if (isEquityCurveCsv) {
        const rows = lines
          .slice(1)
          .map((line) => line.split(delimiter).map((str) => str.trim()))
          .map((cols) => {
            const dateRaw = cols[0] ?? "";
            const equityRaw = cols[1] ?? "";
            const date = formatDate(dateRaw);
            if (!date) return null;

            const cleaned = equityRaw.replace(/"/g, "").replace(/\s/g, "");
            const normalizedNumber =
              cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned;
            const equityValue = Number.parseFloat(normalizedNumber);
            if (!Number.isFinite(equityValue)) return null;

            return { date, equityValue };
          })
          .filter((x): x is { date: string; equityValue: number } => x != null)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (rows.length === 0) return [];

        let prevEquity: number | null = null;

        return rows.map((row) => {
          const pnl = prevEquity == null ? 0 : row.equityValue - prevEquity;
          prevEquity = row.equityValue;

          return {
            date: row.date,
            equity: row.equityValue,
            trades: [{ date: row.date, pnl }],
          };
        });
      }

      // Parse CSV into array of trades
      const trades = lines
        .slice(1) // Skip header row
        .map((line) => {
          const [datetimeRaw, pnlRaw] = line.split(delimiter).map((str) => str.trim());
          const datetime = datetimeRaw ?? "";
          const pnlString = (pnlRaw ?? "").replace(/"/g, "").replace(/\s/g, "");
          const date = formatDate(datetime);
          if (!date) {
            console.warn('Skipping trade with invalid date:', datetime);
            return null;
          }
          const normalizedPnL =
            pnlString.includes(',') && !pnlString.includes('.') ? pnlString.replace(',', '.') : pnlString;
          const pnlValue = Number.parseFloat(normalizedPnL);
          if (!Number.isFinite(pnlValue)) {
            console.warn('Skipping trade with invalid PnL:', pnlRaw);
            return null;
          }
          return {
            date,
            pnl: pnlValue
          };
        })
        .filter((trade): trade is Trade => trade !== null); // Type guard to remove null trades
  
      // Group trades by date
      const tradesByDate = trades.reduce((acc, trade) => {
        if (!acc[trade.date]) {
          acc[trade.date] = [];
        }
        acc[trade.date].push(trade);
        return acc;
      }, {} as Record<string, Trade[]>);
  
      // Calculate daily equity
      let currentEquity = INITIAL_EQUITY;
      const tradingDays = Object.keys(tradesByDate)
        .sort()
        .map(date => {
          const dailyTrades = tradesByDate[date];
          const dailyPnL = dailyTrades.reduce((sum, trade) => sum + trade.pnl, 0);
          currentEquity += dailyPnL;
  
          return {
            date,
            equity: currentEquity,
            trades: dailyTrades
          };
        });
  
      
      return tradingDays;
    } catch (error) {
      console.error('Error processing trading data:', error);
      return [];
    }
  }
  
  // Your CSV data (Equity curve)
  const csvData = `,Equity
2025-11-05,2378.36
2025-11-06,2151.58
2025-11-07,2134.2999999999997
2025-11-10,2163.9999999999995
2025-11-12,2173.9999999999995
2025-11-13,2253.0999999999995
2025-11-14,2326.7999999999993
2025-11-17,2311.899999999999
2025-11-18,2045.5999999999992
2025-11-19,2265.399999999999
2025-11-20,2272.7999999999993
2025-11-21,2391.999999999999
2025-11-24,2401.999999999999
2025-11-25,2682.899999999999
2025-11-26,2880.599999999999
2025-12-01,2929.259999999999
2025-12-02,3176.679999999999
2025-12-03,3233.3799999999987
2025-12-04,3326.679999999999
2025-12-05,3219.479999999999
2025-12-08,3265.679999999999
2025-12-09,3402.479999999999
2025-12-10,3497.079999999999
2025-12-11,3520.039999999999
2025-12-12,3574.639999999999
2025-12-16,3623.239999999999
2025-12-18,3723.54`;
  
  // Process the data
  export const processedTradingData = processTradingData(csvData);
  
  // Export the helper function for potential reuse
  export { processTradingData };