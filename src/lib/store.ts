import { create } from "zustand";
import { INDICATOR_PALETTE } from "@/lib/theme";
import { DEFAULT_WATCHLISTS } from "@/lib/market/exchanges";
import { defaultParams, INDICATOR_BY_ID } from "@/lib/market/indicators";
import { uid } from "@/lib/utils";
import type {
  ChartType,
  Drawing,
  DrawingTool,
  IndicatorInstance,
  PriceAlert,
  RightTab,
  TimeframeId,
  Watchlist,
} from "@/lib/market/types";

const STORAGE_KEY = "meridian-v1";

type PersistSlice = {
  symbol: string;
  timeframe: TimeframeId;
  chartType: ChartType;
  logScale: boolean;
  showVolume: boolean;
  showGrid: boolean;
  theme: "dark" | "light";
  watchlists: Watchlist[];
  activeWatchlistId: string;
  indicators: IndicatorInstance[];
  drawings: Drawing[];
  alerts: PriceAlert[];
  compare: string[];
  rightTab: RightTab;
};

type TerminalState = PersistSlice & {
  hydrated: boolean;
  drawingTool: DrawingTool;
  searchOpen: boolean;
  mobileTab: "watchlist" | "chart" | "analyze";
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: TimeframeId) => void;
  setChartType: (t: ChartType) => void;
  setLogScale: (v: boolean) => void;
  setShowVolume: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setTheme: (t: "dark" | "light") => void;
  setRightTab: (t: RightTab) => void;
  setDrawingTool: (t: DrawingTool) => void;
  setSearchOpen: (v: boolean) => void;
  setMobileTab: (t: TerminalState["mobileTab"]) => void;
  setActiveWatchlist: (id: string) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  createWatchlist: (name: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
  addIndicator: (type: string) => void;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, patch: Partial<IndicatorInstance>) => void;
  addDrawing: (d: Drawing) => void;
  clearDrawings: () => void;
  removeDrawing: (id: string) => void;
  addAlert: (alert: Omit<PriceAlert, "id" | "createdAt">) => void;
  removeAlert: (id: string) => void;
  markAlertTriggered: (id: string) => void;
  toggleCompare: (symbol: string) => void;
  hydrate: () => void;
};

const defaults: PersistSlice = {
  symbol: "AAPL",
  timeframe: "1D",
  chartType: "candle",
  logScale: false,
  showVolume: true,
  showGrid: true,
  theme: "dark",
  watchlists: DEFAULT_WATCHLISTS,
  activeWatchlistId: "core",
  indicators: [
    {
      id: "sma20",
      type: "sma",
      params: { length: 20 },
      visible: true,
      color: INDICATOR_PALETTE[0],
    },
    {
      id: "sma50",
      type: "sma",
      params: { length: 50 },
      visible: true,
      color: INDICATOR_PALETTE[1],
    },
  ],
  drawings: [],
  alerts: [],
  compare: [],
  rightTab: "outlook",
};

function persist(slice: PersistSlice) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
  } catch {
    /* ignore quota */
  }
}

function pick(s: TerminalState): PersistSlice {
  return {
    symbol: s.symbol,
    timeframe: s.timeframe,
    chartType: s.chartType,
    logScale: s.logScale,
    showVolume: s.showVolume,
    showGrid: s.showGrid,
    theme: s.theme,
    watchlists: s.watchlists,
    activeWatchlistId: s.activeWatchlistId,
    indicators: s.indicators,
    drawings: s.drawings,
    alerts: s.alerts,
    compare: s.compare,
    rightTab: s.rightTab,
  };
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  ...defaults,
  hydrated: false,
  drawingTool: "cursor",
  searchOpen: false,
  mobileTab: "chart",
  setSymbol: (symbol) => {
    set({ symbol, drawings: [] });
    persist(pick(get()));
  },
  setTimeframe: (timeframe) => {
    set({ timeframe });
    persist(pick(get()));
  },
  setChartType: (chartType) => {
    set({ chartType });
    persist(pick(get()));
  },
  setLogScale: (logScale) => {
    set({ logScale });
    persist(pick(get()));
  },
  setShowVolume: (showVolume) => {
    set({ showVolume });
    persist(pick(get()));
  },
  setShowGrid: (showGrid) => {
    set({ showGrid });
    persist(pick(get()));
  },
  setTheme: (theme) => {
    set({ theme });
    persist(pick(get()));
  },
  setRightTab: (rightTab) => {
    set({ rightTab });
    persist(pick(get()));
  },
  setDrawingTool: (drawingTool) => set({ drawingTool }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  setActiveWatchlist: (activeWatchlistId) => {
    set({ activeWatchlistId });
    persist(pick(get()));
  },
  addToWatchlist: (symbol) => {
    const { watchlists, activeWatchlistId } = get();
    set({
      watchlists: watchlists.map((w) =>
        w.id === activeWatchlistId && !w.symbols.includes(symbol)
          ? { ...w, symbols: [...w.symbols, symbol] }
          : w,
      ),
    });
    persist(pick(get()));
  },
  removeFromWatchlist: (symbol) => {
    const { watchlists, activeWatchlistId } = get();
    set({
      watchlists: watchlists.map((w) =>
        w.id === activeWatchlistId
          ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) }
          : w,
      ),
    });
    persist(pick(get()));
  },
  createWatchlist: (name) => {
    const list: Watchlist = { id: uid("wl"), name, symbols: [] };
    set({ watchlists: [...get().watchlists, list], activeWatchlistId: list.id });
    persist(pick(get()));
  },
  renameWatchlist: (id, name) => {
    set({
      watchlists: get().watchlists.map((w) => (w.id === id ? { ...w, name } : w)),
    });
    persist(pick(get()));
  },
  deleteWatchlist: (id) => {
    const next = get().watchlists.filter((w) => w.id !== id);
    const lists = next.length ? next : defaults.watchlists;
    set({
      watchlists: lists,
      activeWatchlistId: lists[0]?.id ?? "core",
    });
    persist(pick(get()));
  },
  addIndicator: (type) => {
    const def = INDICATOR_BY_ID[type];
    if (!def) return;
    const n = get().indicators.length;
    const inst: IndicatorInstance = {
      id: uid(type),
      type,
      params: defaultParams(def),
      visible: true,
      color: INDICATOR_PALETTE[n % INDICATOR_PALETTE.length]!,
    };
    set({ indicators: [...get().indicators, inst] });
    persist(pick(get()));
  },
  removeIndicator: (id) => {
    set({ indicators: get().indicators.filter((i) => i.id !== id) });
    persist(pick(get()));
  },
  updateIndicator: (id, patch) => {
    set({
      indicators: get().indicators.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
    persist(pick(get()));
  },
  addDrawing: (d) => {
    set({ drawings: [...get().drawings, d], drawingTool: "cursor" });
    persist(pick(get()));
  },
  clearDrawings: () => {
    set({ drawings: [] });
    persist(pick(get()));
  },
  removeDrawing: (id) => {
    set({ drawings: get().drawings.filter((d) => d.id !== id) });
    persist(pick(get()));
  },
  addAlert: (alert) => {
    set({
      alerts: [
        ...get().alerts,
        { ...alert, id: uid("al"), createdAt: Date.now() },
      ],
    });
    persist(pick(get()));
  },
  removeAlert: (id) => {
    set({ alerts: get().alerts.filter((a) => a.id !== id) });
    persist(pick(get()));
  },
  markAlertTriggered: (id) => {
    set({
      alerts: get().alerts.map((a) =>
        a.id === id ? { ...a, triggeredAt: Date.now() } : a,
      ),
    });
    persist(pick(get()));
  },
  toggleCompare: (symbol) => {
    const cur = get().compare;
    set({
      compare: cur.includes(symbol) ? cur.filter((s) => s !== symbol) : [...cur, symbol].slice(0, 3),
    });
    persist(pick(get()));
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistSlice>;
        set({
          ...defaults,
          ...parsed,
          watchlists: parsed.watchlists?.length ? parsed.watchlists : defaults.watchlists,
          hydrated: true,
        });
        return;
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },
}));
