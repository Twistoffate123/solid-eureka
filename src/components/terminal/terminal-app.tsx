import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { AnalyzePanels } from "@/components/terminal/analyze-panels";
import { ChartView } from "@/components/terminal/chart-view";
import { MarketDataContext } from "@/components/terminal/data-context";
import { HeaderBar } from "@/components/terminal/header-bar";
import { SymbolSearch } from "@/components/terminal/symbol-search";
import { WatchlistPanel } from "@/components/terminal/watchlist-panel";
import { fetchChart, fetchQuotes } from "@/lib/market/api";
import { MARKET_HEATMAP, UNIVERSES } from "@/lib/market/exchanges";
import { timeframeById, type ChartPayload, type Quote } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TerminalApp() {
  const hydrate = useTerminalStore((s) => s.hydrate);
  const hydrated = useTerminalStore((s) => s.hydrated);
  const theme = useTerminalStore((s) => s.theme);
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const watchlists = useTerminalStore((s) => s.watchlists);
  const compare = useTerminalStore((s) => s.compare);
  const alerts = useTerminalStore((s) => s.alerts);
  const markAlert = useTerminalStore((s) => s.markAlertTriggered);
  const mobileTab = useTerminalStore((s) => s.mobileTab);
  const setMobileTab = useTerminalStore((s) => s.setMobileTab);
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const fired = useRef(new Set<string>());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, typeof timeframe> = {
        "1": "1m",
        "2": "5m",
        "3": "15m",
        "4": "1h",
        "5": "4h",
        "6": "1D",
        "7": "1W",
        "8": "1M",
      };
      const tf = map[e.key];
      if (tf) setTimeframe(tf);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTimeframe]);

  const watchSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const w of watchlists) for (const s of w.symbols) set.add(s);
    for (const u of Object.values(UNIVERSES)) for (const s of u.symbols) set.add(s);
    for (const c of MARKET_HEATMAP) set.add(c.symbol);
    set.add(symbol);
    for (const c of compare) set.add(c);
    return [...set];
  }, [watchlists, symbol, compare]);

  const quotesQuery = useQuery({
    queryKey: ["quotes", watchSymbols.join(",")],
    queryFn: () => fetchQuotes({ data: { symbols: watchSymbols } }),
    refetchInterval: 8_000,
    enabled: hydrated,
  });

  const tf = timeframeById(timeframe);
  const chartQuery = useQuery({
    queryKey: ["chart", symbol, tf.interval, tf.range, tf.aggregate ?? 1],
    queryFn: () =>
      fetchChart({
        data: {
          symbol,
          interval: tf.interval,
          range: tf.range,
          aggregate: tf.aggregate,
        },
      }),
    refetchInterval: tf.seconds < 3600 ? 15_000 : 60_000,
    enabled: hydrated,
  });

  const compareQuery = useQuery({
    queryKey: ["compare", compare.join(","), tf.interval, tf.range],
    queryFn: async () => {
      const entries = await Promise.all(
        compare
          .filter((s) => s !== symbol)
          .map(async (s) => {
            const res = await fetchChart({
              data: { symbol: s, interval: tf.interval, range: tf.range, aggregate: tf.aggregate },
            });
            return [s, res] as const;
          }),
      );
      return entries;
    },
    enabled: hydrated && compare.length > 0,
    staleTime: 30_000,
  });

  const quotes = useMemo(() => {
    const map: Record<string, Quote> = {};
    if (quotesQuery.data?.ok) {
      for (const q of quotesQuery.data.quotes) map[q.symbol] = q;
    }
    if (chartQuery.data?.ok) {
      const q = chartQuery.data.payload.quote;
      map[q.symbol] = { ...map[q.symbol], ...q, spark: map[q.symbol]?.spark ?? q.spark };
    }
    return map;
  }, [quotesQuery.data, chartQuery.data]);

  useEffect(() => {
    for (const alert of alerts) {
      if (alert.triggeredAt || fired.current.has(alert.id)) continue;
      const q = quotes[alert.symbol];
      if (!q) continue;
      const hit =
        (alert.operator === "above" && q.price >= alert.price) ||
        (alert.operator === "below" && q.price <= alert.price);
      if (hit) {
        fired.current.add(alert.id);
        markAlert(alert.id);
        toast(`${alert.symbol} ${alert.operator} ${alert.price}`, {
          description: `Last ${q.price}`,
        });
      }
    }
  }, [quotes, alerts, markAlert]);

  const compareCharts = useMemo(() => {
    const out: Record<string, ChartPayload> = {};
    if (!compareQuery.data) return out;
    for (const [s, res] of compareQuery.data) {
      if (res.ok) out[s] = res.payload;
    }
    return out;
  }, [compareQuery.data]);

  const chart = chartQuery.data?.ok ? chartQuery.data.payload : null;
  const chartError = chartQuery.data && !chartQuery.data.ok ? chartQuery.data.error : null;

  return (
    <MarketDataContext.Provider
      value={{
        quotes,
        chart,
        chartLoading: chartQuery.isLoading,
        chartError,
        compareCharts,
      }}
    >
      <div className="flex h-dvh flex-col bg-bg text-fg">
        <HeaderBar />
        <SymbolSearch />
        <div className="hidden min-h-0 flex-1 md:flex">
          <Group orientation="horizontal" className="h-full w-full">
            <Panel id="watch" defaultSize="20" minSize="14" maxSize="32" className="min-w-0">
              <WatchlistPanel />
            </Panel>
            <Separator className="resize-handle" />
            <Panel id="chart" defaultSize="56" minSize="36" className="min-w-0">
              <ChartView />
            </Panel>
            <Separator className="resize-handle" />
            <Panel id="analyze" defaultSize="24" minSize="18" maxSize="40" className="min-w-0">
              <AnalyzePanels />
            </Panel>
          </Group>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          <div className={cn("min-h-0 flex-1", mobileTab !== "watchlist" && "hidden")}>
            <WatchlistPanel />
          </div>
          <div className={cn("min-h-0 flex-1", mobileTab !== "chart" && "hidden")}>
            <ChartView />
          </div>
          <div className={cn("min-h-0 flex-1", mobileTab !== "analyze" && "hidden")}>
            <AnalyzePanels />
          </div>
          <nav className="grid grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
            {(
              [
                ["watchlist", "Watchlist"],
                ["chart", "Chart"],
                ["analyze", "Analyze"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobileTab(id)}
                className={cn(
                  "h-12 text-sm",
                  mobileTab === id ? "text-primary" : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </MarketDataContext.Provider>
  );
}