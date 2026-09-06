export type InstrumentType =
  | "EQUITY"
  | "ETF"
  | "INDEX"
  | "CRYPTOCURRENCY"
  | "CURRENCY"
  | "FUTURE"
  | "OPTION"
  | "MUTUALFUND"
  | "ECNQUOTE"
  | "NONE";

export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  fullExchange: string;
  type: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketTime: number;
  spark: number[];
};

export type SearchHit = {
  symbol: string;
  name: string;
  exchange: string;
  exchDisp: string;
  type: string;
  typeDisp: string;
};

export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  link: string;
  published: number;
};

export type ChartPayload = {
  symbol: string;
  bars: Bar[];
  quote: Quote;
};

export type TimeframeId =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1D"
  | "1W"
  | "1M";

export type Timeframe = {
  id: TimeframeId;
  label: string;
  interval: string;
  range: string;
  aggregate?: number;
  seconds: number;
};

export const TIMEFRAMES: Timeframe[] = [
  { id: "1m", label: "1m", interval: "1m", range: "1d", seconds: 60 },
  { id: "5m", label: "5m", interval: "5m", range: "5d", seconds: 300 },
  { id: "15m", label: "15m", interval: "15m", range: "1mo", seconds: 900 },
  { id: "1h", label: "1H", interval: "60m", range: "3mo", seconds: 3600 },
  { id: "4h", label: "4H", interval: "60m", range: "6mo", aggregate: 4, seconds: 14400 },
  { id: "1D", label: "1D", interval: "1d", range: "1y", seconds: 86400 },
  { id: "1W", label: "1W", interval: "1wk", range: "5y", seconds: 604800 },
  { id: "1M", label: "1M", interval: "1mo", range: "10y", seconds: 2592000 },
];

export function timeframeById(id: TimeframeId): Timeframe {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[5]!;
}

export type ChartType = "candle" | "bar" | "line" | "area" | "heikin";

export type DrawingTool = "cursor" | "hline" | "trend" | "fib" | "rect";

export type Drawing =
  | { id: string; tool: "hline"; price: number }
  | { id: string; tool: "trend"; t1: number; p1: number; t2: number; p2: number }
  | { id: string; tool: "fib"; t1: number; p1: number; t2: number; p2: number }
  | { id: string; tool: "rect"; t1: number; p1: number; t2: number; p2: number };

export type RightTab =
  | "overview"
  | "outlook"
  | "indicators"
  | "news"
  | "screener"
  | "markets"
  | "alerts";

export type IndicatorInstance = {
  id: string;
  type: string;
  params: Record<string, number>;
  visible: boolean;
  color: string;
};

export type Watchlist = {
  id: string;
  name: string;
  symbols: string[];
};

export type PriceAlert = {
  id: string;
  symbol: string;
  operator: "above" | "below";
  price: number;
  createdAt: number;
  triggeredAt?: number;
};
