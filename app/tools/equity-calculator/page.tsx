// src/app/tools/equity-calculator/page.tsx
'use client'

import React, { useDeferredValue, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { EquityChartPoint } from "@/components/tools/equity-growth-chart";

const EquityGrowthChart = dynamic(
  () => import("@/components/tools/equity-growth-chart").then((mod) => mod.EquityGrowthChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-md bg-gray-50 text-sm text-gray-500">
        Chart wird geladen...
      </div>
    ),
  }
);

// Type definitions
type FuturesSymbol = 'MNQ' | 'MES';

interface FuturesContract {
    name: string;
    symbol: string;
    exchange: string;
    tickValue: number;
    margin: number;
    minStopLoss: number;
    descriptions: Record<Language, string>;
  }
  
  type FuturesCharacteristics = Record<FuturesSymbol, FuturesContract>;
  
  interface MonthlyData extends EquityChartPoint {
    month: number;
    capital: number;
    contracts: number;
    stopLossTicks: number;
    takeProfitTicks: number;
    riskAmount: number;
    riskPercent: string;
    pnl: number;
    monthlyReturn: string;
    nextContractAt: number;
  }

  type Language = 'en' | 'de';

  interface Translation {
    title: string;
    parameters: string;
    statistics: string;
    characteristics: string;
    chart: string;
    progress: string;
    symbol: string;
    initialCapital: string;
    tickValue: string;
    margin: string;
    exchange: string;
    description: string;
    currentPositionSize: string;
    maxRiskPerTrade: string;
    nextContractAt: string;
    winRate: string;
    riskReward: string;
    riskTrade: string;
    monthlyReturn: string;
    yearlyReturn: string;
    month: string;
    capital: string;
    contracts: string;
    stopLoss: string;
    takeProfit: string;
    monthlyPnL: string;
    risk: string;
    minCapitalWarning: string;
    minimumStopLoss: string;
    perContract: string;
    coreAssumptions: string;
    tradesPerMonth: string;
    stopLossSize: string;
  }


// Constants outside component
const FUTURES_DATA: FuturesCharacteristics = {
    MNQ: {
      name: "Micro E-mini Nasdaq-100",
      symbol: "MNQ",
      exchange: "CME",
      tickValue: 0.50,
      margin: 100,
      minStopLoss: 80,
      descriptions: {
        en: "Tracks the Nasdaq-100 Index at 1/10th the size of the E-mini",
        de: "Bildet den Nasdaq-100 Index in 1/10 der Größe des E-mini ab"
      }
    },
    MES: {
      name: "Micro E-mini S&P 500",
      symbol: "MES",
      exchange: "CME",
      tickValue: 1.25,
      margin: 40,
      minStopLoss: 32,
      descriptions: {
        en: "Tracks the S&P 500 Index at 1/10th the size of the E-mini",
        de: "Bildet den S&P 500 Index in 1/10 der Größe des E-mini ab"
      }
    }
  } as const;

const TRADES_PER_MONTH = 10;

const TRANSLATIONS: Record<Language, Translation> = {
  en: {
    title: "Micro E-mini Futures Trading Dashboard",
    parameters: "Trading Parameters",
    statistics: "Position Sizing Analysis",
    characteristics: "Contract Specifications",
    chart: "Account Growth Projection",
    progress: "Monthly Progress",
    symbol: "Symbol",
    initialCapital: "Initial Capital",
    tickValue: "Tick Value",
    margin: "Day Trading Margin",
    exchange: "Exchange",
    description: "Description",
    currentPositionSize: "Current Position Size",
    maxRiskPerTrade: "Max Risk per Trade",
    nextContractAt: "Capital for Next Contract",
    winRate: "Win Rate",
    riskReward: "Risk/Reward",
    riskTrade: "Risk per Trade",
    monthlyReturn: "Monthly Return",
    yearlyReturn: "Yearly Return",
    month: "Month",
    capital: "Capital",
    contracts: "Contracts",
    stopLoss: "Stop Loss (Ticks)",
    takeProfit: "Take Profit (Ticks)",
    monthlyPnL: "Monthly P&L",
    risk: "Risk",
    minCapitalWarning: "Minimum capital required for {risk}% risk with {stopLoss} ticks SL is ${capital}",
    minimumStopLoss: "Minimum SL",
    perContract: "per contract",
    coreAssumptions: "Core Assumptions",
    tradesPerMonth: "Trades per Month",
    stopLossSize: "Stop Loss Size",
  },
  de: {
    title: "Micro E-mini Futures Handelsdashboard",
    parameters: "Handelsparameter",
    statistics: "Positionsgrößenanalyse",
    characteristics: "Kontraktspezifikationen",
    chart: "Kontoentwicklung",
    progress: "Monatlicher Fortschritt",
    symbol: "Symbol",
    initialCapital: "Startkapital",
    tickValue: "Tick-Wert",
    margin: "Daytrading-Margin",
    exchange: "Börse",
    description: "Beschreibung",
    currentPositionSize: "Aktuelle Positionsgröße",
    maxRiskPerTrade: "Max. Risiko pro Trade",
    nextContractAt: "Kapital für nächsten Kontrakt",
    winRate: "Gewinnrate",
    riskReward: "Risiko/Rendite",
    riskTrade: "Risiko pro Trade",
    monthlyReturn: "Monatliche Rendite",
    yearlyReturn: "Jährliche Rendite",
    month: "Monat",
    capital: "Kapital",
    contracts: "Kontrakte",
    stopLoss: "Stop Loss (Ticks)",
    takeProfit: "Take Profit (Ticks)",
    monthlyPnL: "Monatlicher G/V",
    risk: "Risiko",
    minCapitalWarning: "Mindestkapital für {risk}% Risiko mit {stopLoss} Ticks SL beträgt ${capital}",
    minimumStopLoss: "Mindest-SL",
    perContract: "pro Kontrakt",
    coreAssumptions: "Grundannahmen",
    tradesPerMonth: "Trades pro Monat",
    stopLossSize: "Stop Loss Größe",
  }
} as const;

function calculateMinimumCapital(symbol: FuturesSymbol, riskPercentage: number) {
  const contract = FUTURES_DATA[symbol];
  const minRiskAmount = contract.minStopLoss * contract.tickValue;
  return Math.ceil((minRiskAmount / (riskPercentage / 100)));
}

function calculateSafeContractSize(
  capital: number,
  selectedSymbol: FuturesSymbol,
  riskPercentage: number
) {
  const minRequiredCapital = calculateMinimumCapital(selectedSymbol, riskPercentage);

  if (capital < minRequiredCapital) {
    return 0;
  }

  const maxRiskAmount = capital * (riskPercentage / 100);
  const riskPerContract = FUTURES_DATA[selectedSymbol].minStopLoss * FUTURES_DATA[selectedSymbol].tickValue;
  return Math.floor(maxRiskAmount / riskPerContract);
}

function calculatePositionRisk(
  capital: number,
  selectedSymbol: FuturesSymbol,
  contracts: number
) {
  const riskPerContract = FUTURES_DATA[selectedSymbol].minStopLoss * FUTURES_DATA[selectedSymbol].tickValue;
  const totalRisk = contracts * riskPerContract;
  const riskPercentage = (totalRisk / capital) * 100;
  return { totalRisk, riskPercentage };
}

function calculateCapitalForNextContract(
  selectedSymbol: FuturesSymbol,
  currentContracts: number,
  riskPercentage: number
) {
  const nextContractCount = currentContracts + 1;
  const totalRiskRequired = nextContractCount * FUTURES_DATA[selectedSymbol].minStopLoss * FUTURES_DATA[selectedSymbol].tickValue;
  return Math.ceil((totalRiskRequired / riskPercentage) * 100);
}

function getCapitalWarning(
  capital: number,
  selectedSymbol: FuturesSymbol,
  riskPercentage: number,
  t: Translation
) {
  const minCapital = calculateMinimumCapital(selectedSymbol, riskPercentage);
  if (capital >= minCapital) return null;

  return t.minCapitalWarning
    .replace('{risk}', riskPercentage.toString())
    .replace('{stopLoss}', FUTURES_DATA[selectedSymbol].minStopLoss.toString())
    .replace('{capital}', minCapital.toLocaleString());
}

// 2. Calculation functions outside the component
const calculateMonthlyResults = (
    startingCapital: number,
    selectedSymbol: FuturesSymbol,
    winRate: number,
    riskReward: number,
    riskPercentage: number,
    tradesPerMonth: number
  ) => {
    // Helper calculation functions
    const monthlyData: MonthlyData[] = [];
    let runningCapital = startingCapital;
      
    for (let month = 1; month <= 12; month++) {
      const safeContracts = calculateSafeContractSize(runningCapital, selectedSymbol, riskPercentage);
      const riskMetrics = calculatePositionRisk(runningCapital, selectedSymbol, safeContracts);
      const contract = FUTURES_DATA[selectedSymbol];
      const takeProfitTicks = contract.minStopLoss * riskReward;
        
      const profitPerWin = takeProfitTicks * contract.tickValue * safeContracts;
      const lossPerLoss = contract.minStopLoss * contract.tickValue * safeContracts;
      const winningTrades = Math.round(tradesPerMonth * (winRate / 100));
      const losingTrades = tradesPerMonth - winningTrades;
      const monthlyPnL = (winningTrades * profitPerWin) - (losingTrades * lossPerLoss);
        
      const monthlyReturn = (monthlyPnL / runningCapital) * 100;
      runningCapital += monthlyPnL;
  
      monthlyData.push({
        month,
        capital: Math.round(runningCapital),
        contracts: safeContracts,
        stopLossTicks: contract.minStopLoss,
        takeProfitTicks: takeProfitTicks,
        riskAmount: riskMetrics.totalRisk,
        riskPercent: riskMetrics.riskPercentage.toFixed(2),
        pnl: Math.round(monthlyPnL),
        monthlyReturn: monthlyReturn.toFixed(2),
        nextContractAt: calculateCapitalForNextContract(selectedSymbol, safeContracts, riskPercentage)
      });
    }
    return monthlyData;
  };



// 3. Component implementation
export default function EquityCalculatorPage() {
  const [language, setLanguage] = useState<Language>("de");
  const [selectedSymbol, setSelectedSymbol] = useState<FuturesSymbol>('MNQ');
  const [startingCapital, setStartingCapital] = useState(2000);
  const [winRate, setWinRate] = useState(40);
  const [riskReward, setRiskReward] = useState(3);
  const [riskPercentage, setRiskPercentage] = useState(2);
  const deferredSelectedSymbol = useDeferredValue(selectedSymbol);
  const deferredStartingCapital = useDeferredValue(startingCapital);
  const deferredWinRate = useDeferredValue(winRate);
  const deferredRiskReward = useDeferredValue(riskReward);
  const deferredRiskPercentage = useDeferredValue(riskPercentage);
  const isCalculationPending =
    deferredSelectedSymbol !== selectedSymbol ||
    deferredStartingCapital !== startingCapital ||
    deferredWinRate !== winRate ||
    deferredRiskReward !== riskReward ||
    deferredRiskPercentage !== riskPercentage;

   // Memoized calculations
   const monthlyData = useMemo(
    () => calculateMonthlyResults(
      deferredStartingCapital,
      deferredSelectedSymbol,
      deferredWinRate,
      deferredRiskReward,
      deferredRiskPercentage,
      TRADES_PER_MONTH
    ),
    [
      deferredStartingCapital,
      deferredSelectedSymbol,
      deferredWinRate,
      deferredRiskReward,
      deferredRiskPercentage,
    ]
  );

  const t = TRANSLATIONS[language];
  const selectedContract = FUTURES_DATA[selectedSymbol];
  const calculatedSymbol = FUTURES_DATA[deferredSelectedSymbol];

  const currentContracts = calculateSafeContractSize(
    deferredStartingCapital,
    deferredSelectedSymbol,
    deferredRiskPercentage
  );
  const { totalRisk, riskPercentage: actualRiskPercent } = calculatePositionRisk(
    deferredStartingCapital,
    deferredSelectedSymbol,
    currentContracts
  );
  const yearlyReturn = ((monthlyData[11].capital - deferredStartingCapital) / deferredStartingCapital * 100).toFixed(2);
  const capitalWarning = getCapitalWarning(startingCapital, selectedSymbol, riskPercentage, t);
  const chartLabels = {
    month: t.month,
    capital: t.capital,
    contracts: t.contracts,
    risk: t.risk,
    monthlyReturn: t.monthlyReturn,
    monthlyPnL: t.monthlyPnL,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <button 
            onClick={() => setLanguage(language === "en" ? "de" : "en")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {language === "en" ? "Deutsch" : "English"}
          </button>
        </div>

        {/* Contract Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>{t.characteristics}</CardTitle>
          </CardHeader>
          <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column - Contract Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block font-medium">
            {t.symbol}:
            <select 
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value as FuturesSymbol)}
              className="ml-2 p-1 border rounded"
            >
              <option value="MNQ">MNQ</option>
              <option value="MES">MES</option>
            </select>
          </label>
          <div className="space-y-1 mt-3">
            <p><strong>{FUTURES_DATA[selectedSymbol].name}</strong></p>
            <p>{t.exchange}: {selectedContract.exchange}</p>
            <p>{t.tickValue}: ${selectedContract.tickValue}</p>
            <p>{t.margin}: ${selectedContract.margin}</p>
          </div>
        </div>
      </div>

      {/* Right Column - Description and Assumptions */}
      <div className="space-y-6">
        {/* Description */}
        <div>
          <h4 className="font-medium mb-2">{t.description}:</h4>
          <p className="text-gray-600">
            {selectedContract.descriptions[language]}
          </p>
        </div>

        {/* Core Assumptions */}
        <div>
          <h4 className="font-medium mb-2">{t.coreAssumptions}:</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <ul className="text-sm text-gray-600 space-y-2">
              <li>
                <span className="font-medium">{t.tradesPerMonth}:</span> {TRADES_PER_MONTH}
              </li>
              <li>
                <span className="font-medium">{t.stopLossSize}:</span>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>MNQ: {FUTURES_DATA.MNQ.minStopLoss} Ticks (${(FUTURES_DATA.MNQ.minStopLoss * FUTURES_DATA.MNQ.tickValue).toFixed(2)} {t.perContract})</li>
                  <li>MES: {FUTURES_DATA.MES.minStopLoss} Ticks (${(FUTURES_DATA.MES.minStopLoss * FUTURES_DATA.MES.tickValue).toFixed(2)} {t.perContract})</li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </CardContent>
        </Card>

        {/* Parameters and Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.parameters}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div>
                <label className="block text-sm mb-1">
                    {t.initialCapital}: ${startingCapital}
                </label>
                <input
                    type="range"
                    min={calculateMinimumCapital(selectedSymbol, 5)} // Use maximum risk percentage for minimum capital
                    max="10000"
                    step="100"
                    value={startingCapital}
                    onChange={(e) => setStartingCapital(parseInt(e.target.value))}
                    className="w-full"
                />
                {capitalWarning && (
                    <p className="text-red-500 text-sm mt-1">{capitalWarning}</p>
                )}
            </div>
              <div>
                <label className="block text-sm mb-1">{t.winRate}: {winRate}%</label>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={winRate}
                  onChange={(e) => setWinRate(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">{t.riskReward}: 1:{riskReward}</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={riskReward}
                  onChange={(e) => setRiskReward(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
              <label className="block text-sm mb-1">
    {t.riskTrade}: {riskPercentage}%
  </label>
  <input
    type="range"
    min="0.5"
    max="5"
    step="0.5"
    value={riskPercentage}
    onChange={(e) => {
      const newRisk = parseFloat(e.target.value);
      setRiskPercentage(newRisk);
      const minCapital = calculateMinimumCapital(selectedSymbol, newRisk);
      if (startingCapital < minCapital) {
        setStartingCapital(minCapital);
      }
    }}
    className="w-full"
  />
  <p className="text-sm text-gray-600 mt-1">
    {t.minimumStopLoss}: {selectedContract.minStopLoss} ticks (${(selectedContract.minStopLoss * selectedContract.tickValue).toFixed(2)} {t.perContract})
  </p>
    </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
            <CardTitle>{t.statistics}</CardTitle>
            </CardHeader>
            <CardContent>
              {isCalculationPending && (
                <p className="mb-3 text-sm text-gray-500">Berechnung wird aktualisiert...</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold">{t.currentPositionSize}</h4>
                  <p>{currentContracts} {t.contracts}</p>
                  <p className="text-sm text-gray-600">@ {calculatedSymbol.minStopLoss} ticks SL</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold">{t.maxRiskPerTrade}</h4>
                  <p>${totalRisk.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">{actualRiskPercent.toFixed(2)}% {t.risk}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold">{t.yearlyReturn}</h4>
                  <p>{yearlyReturn}%</p>
                  <p className="text-sm text-gray-600">projected</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-semibold">{t.nextContractAt}</h4>
                  <p>${calculateCapitalForNextContract(deferredSelectedSymbol, currentContracts, deferredRiskPercentage).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">{t.contracts}: {currentContracts + 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
        <CardHeader>
            <CardTitle>{t.chart}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="h-80">
            <EquityGrowthChart data={monthlyData} labels={chartLabels} />
            </div>
        </CardContent>
        </Card>


          {/* Monthly Progress Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t.progress}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border bg-gray-50">{t.month}</th>
                    <th className="p-2 border bg-gray-50">{t.capital}</th>
                    <th className="p-2 border bg-gray-50">{t.contracts}</th>
                    <th className="p-2 border bg-gray-50">{t.risk}</th>
                    <th className="p-2 border bg-gray-50">{t.stopLoss}</th>
                    <th className="p-2 border bg-gray-50">{t.takeProfit}</th>
                    <th className="p-2 border bg-gray-50">{t.monthlyPnL}</th>
                    <th className="p-2 border bg-gray-50">{t.monthlyReturn}</th>
                    <th className="p-2 border bg-gray-50">{t.nextContractAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((data) => (
                    <tr key={data.month} className="hover:bg-gray-50">
                      <td className="p-2 border text-center">{data.month}</td>
                      <td className="p-2 border text-right">${data.capital.toLocaleString()}</td>
                      <td className="p-2 border text-center">{data.contracts}</td>
                      <td className="p-2 border text-right">{data.riskPercent}%</td>
                      <td className="p-2 border text-center">{data.stopLossTicks}</td>
                      <td className="p-2 border text-center">{data.takeProfitTicks}</td>
                      <td className="p-2 border text-right">
                        <span className={data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${data.pnl.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-2 border text-right">
                        <span className={parseFloat(data.monthlyReturn) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {data.monthlyReturn}%
                        </span>
                      </td>
                      <td className="p-2 border text-right">${data.nextContractAt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
