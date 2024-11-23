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
  
  // Define initial equity
  const INITIAL_EQUITY = 25000;
  
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
      // Parse CSV into array of trades
      const trades = csvData
        .split('\n')
        .slice(1) // Skip header row
        .filter(line => line.trim()) // Remove empty lines
        .map(line => {
          const [datetime, pnl] = line.split(',').map(str => str.trim());
          const date = formatDate(datetime);
          if (!date) {
            console.warn('Skipping trade with invalid date:', datetime);
            return null;
          }
          return {
            date,
            pnl: parseFloat(pnl)
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
  
  // Your CSV data (unchanged)
  const csvData = `Time,Realized P&L (value),Realized P&L (currency)
  2024-11-20 20:57:48,525,USD
  2024-11-20 20:15:40,0,USD
  2024-11-20 14:39:40,325,USD
  2024-11-19 19:07:02,-150,USD
  2024-11-19 16:56:52,20,USD
  2024-11-19 16:04:24,25,USD
  2024-11-19 10:02:39,510,USD
  2024-11-18 19:57:35,560,USD
  2024-11-15 20:44:45,985,USD
  2024-11-15 20:24:28,-205,USD
  2024-11-14 15:21:21,-215,USD
  2024-11-12 16:11:54,-340,USD
  2024-11-06 21:09:49,475,USD
  2024-11-06 20:06:29,-235,USD
  2024-11-05 16:46:32,-430,USD
  2024-11-05 16:18:26,-405,USD
  2024-11-01 19:30:29,-220,USD
  2024-11-01 13:55:39,-375,USD
  2024-11-01 13:47:39,-235,USD
  2024-10-31 20:05:21,400,USD
  2024-10-31 18:02:07,336.6666666666424,USD
  2024-10-31 18:00:13,156.6666666666424,USD
  2024-10-31 17:55:02,456.6666666666424,USD
  2024-10-29 12:16:15,64.99999999992724,USD
  2024-10-29 12:00:31,-510,USD
  2024-10-29 09:09:04,580,USD
  2024-10-29 08:53:29,-315,USD
  2024-10-29 08:21:20,-360,USD
  2024-10-25 19:17:06,1580,USD
  2024-10-22 18:53:01,975,USD
  2024-10-22 18:19:20,-240,USD
  2024-10-18 16:13:50,47.5,USD
  2024-10-18 16:08:14,562.5,USD
  2024-10-15 16:54:48,910,USD
  2024-10-14 16:52:04,922.5,USD
  2024-10-14 16:51:18,497.5,USD
  2024-10-11 20:19:05,435,USD
  2024-10-11 20:04:33,-120,USD`;
  
  // Process the data
  export const processedTradingData = processTradingData(csvData);
  
  // Export the helper function for potential reuse
  export { processTradingData };