import { createContext, useContext } from "react";
import type { ChartPayload, Quote } from "@/lib/market/types";

export type MarketData = {
  quotes: Record<string, Quote>;
  chart: ChartPayload | null;
  chartLoading: boolean;
  chartError: string | null;
  compareCharts: Record<string, ChartPayload>;
};

export const MarketDataContext = createContext<MarketData>({
  quotes: {},
  chart: null,
  chartLoading: false,
  chartError: null,
  compareCharts: {},
});

export function useMarketData() {
  return useContext(MarketDataContext);
}
