import { INDICATOR_PALETTE } from "@/lib/theme";
import type { Bar } from "./types";

export type LinePoint = { time: number; value: number; color?: string };

export type PlotSpec = {
  key: string;
  title: string;
  kind: "line" | "histogram";
  pane: "main" | "own";
  color: string;
  data: LinePoint[];
  lineWidth?: number;
  lineStyle?: 0 | 1 | 2;
};

export type ParamDef = {
  key: string;
  label: string;
  def: number;
  min: number;
  max: number;
  step: number;
};

export type IndicatorGroup = "Trend" | "Momentum" | "Volatility" | "Volume" | "Other";

export type IndicatorDef = {
  id: string;
  name: string;
  short: string;
  group: IndicatorGroup;
  pane: "main" | "own";
  params: ParamDef[];
  compute: (bars: Bar[], params: Record<string, number>, color: string) => PlotSpec[];
};

function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.close);
}
function highs(bars: Bar[]): number[] {
  return bars.map((b) => b.high);
}
function lows(bars: Bar[]): number[] {
  return bars.map((b) => b.low);
}

function smaArr(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function emaArr(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (i < period) {
      seed += v;
      if (i === period - 1) {
        prev = seed / period;
        out[i] = prev;
      }
    } else if (prev != null) {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rmaArr(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (i < period) {
      seed += v;
      if (i === period - 1) {
        prev = seed / period;
        out[i] = prev;
      }
    } else if (prev != null) {
      prev = (prev * (period - 1) + v) / period;
      out[i] = prev;
    }
  }
  return out;
}

function wmaArr(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j]! * (period - j);
    out[i] = sum / denom;
  }
  return out;
}

function stdevArr(values: number[], period: number): (number | null)[] {
  const mean = smaArr(values, period);
  const out: (number | null)[] = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = mean[i];
    if (m == null) continue;
    let acc = 0;
    for (let j = 0; j < period; j++) {
      const d = values[i - j]! - m;
      acc += d * d;
    }
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

function trueRange(bars: Bar[]): number[] {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prev = bars[i - 1]!.close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
}

function highest(values: number[], period: number, i: number): number {
  let m = -Infinity;
  for (let j = 0; j < period && i - j >= 0; j++) m = Math.max(m, values[i - j]!);
  return m;
}
function lowest(values: number[], period: number, i: number): number {
  let m = Infinity;
  for (let j = 0; j < period && i - j >= 0; j++) m = Math.min(m, values[i - j]!);
  return m;
}

function toLine(bars: Bar[], values: (number | null)[], color?: string): LinePoint[] {
  const data: LinePoint[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v) || !Number.isFinite(v)) continue;
    data.push(color ? { time: bars[i]!.time, value: v, color } : { time: bars[i]!.time, value: v });
  }
  return data;
}

function line(
  key: string,
  title: string,
  bars: Bar[],
  values: (number | null)[],
  color: string,
  pane: "main" | "own",
  extra?: Partial<PlotSpec>,
): PlotSpec {
  return { key, title, kind: "line", pane, color, data: toLine(bars, values), lineWidth: 2, ...extra };
}

function p(key: string, label: string, def: number, min: number, max: number, step = 1): ParamDef {
  return { key, label, def, min, max, step };
}

function num(params: Record<string, number>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const CATALOG: IndicatorDef[] = [
  {
    id: "sma",
    name: "Simple Moving Average",
    short: "SMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 20, 2, 400)],
    compute: (bars, params, color) => [
      line("sma", `SMA ${num(params, "length", 20)}`, bars, smaArr(closes(bars), num(params, "length", 20)), color, "main"),
    ],
  },
  {
    id: "ema",
    name: "Exponential Moving Average",
    short: "EMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 21, 2, 400)],
    compute: (bars, params, color) => [
      line("ema", `EMA ${num(params, "length", 21)}`, bars, emaArr(closes(bars), num(params, "length", 21)), color, "main"),
    ],
  },
  {
    id: "wma",
    name: "Weighted Moving Average",
    short: "WMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 20, 2, 400)],
    compute: (bars, params, color) => [
      line("wma", `WMA ${num(params, "length", 20)}`, bars, wmaArr(closes(bars), num(params, "length", 20)), color, "main"),
    ],
  },
  {
    id: "dema",
    name: "Double EMA",
    short: "DEMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 21, 2, 400)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 21);
      const e1 = emaArr(closes(bars), n);
      const e1n = e1.map((v) => v ?? 0);
      const e2 = emaArr(e1n, n);
      const out = e1.map((v, i) => (v == null || e2[i] == null ? null : 2 * v - e2[i]!));
      return [line("dema", `DEMA ${n}`, bars, out, color, "main")];
    },
  },
  {
    id: "tema",
    name: "Triple EMA",
    short: "TEMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 21, 2, 400)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 21);
      const c = closes(bars);
      const e1 = emaArr(c, n);
      const e2 = emaArr(e1.map((v) => v ?? 0), n);
      const e3 = emaArr(e2.map((v) => v ?? 0), n);
      const out = e1.map((v, i) =>
        v == null || e2[i] == null || e3[i] == null ? null : 3 * v - 3 * e2[i]! + e3[i]!,
      );
      return [line("tema", `TEMA ${n}`, bars, out, color, "main")];
    },
  },
  {
    id: "hma",
    name: "Hull Moving Average",
    short: "HMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 21, 2, 400)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 21);
      const c = closes(bars);
      const half = wmaArr(c, Math.max(1, Math.round(n / 2)));
      const full = wmaArr(c, n);
      const raw = c.map((_, i) =>
        half[i] == null || full[i] == null ? 0 : 2 * half[i]! - full[i]!,
      );
      const hull = wmaArr(raw, Math.max(1, Math.round(Math.sqrt(n))));
      const cleaned = hull.map((v, i) => (i < n ? null : v));
      return [line("hma", `HMA ${n}`, bars, cleaned, color, "main")];
    },
  },
  {
    id: "vwma",
    name: "Volume Weighted MA",
    short: "VWMA",
    group: "Trend",
    pane: "main",
    params: [p("length", "Length", 20, 2, 400)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        let pv = 0;
        let vol = 0;
        for (let j = 0; j < n; j++) {
          const b = bars[i - j]!;
          pv += b.close * b.volume;
          vol += b.volume;
        }
        out[i] = vol ? pv / vol : null;
      }
      return [line("vwma", `VWMA ${n}`, bars, out, color, "main")];
    },
  },
  {
    id: "bb",
    name: "Bollinger Bands",
    short: "BB",
    group: "Volatility",
    pane: "main",
    params: [p("length", "Length", 20, 2, 200), p("mult", "StdDev", 2, 0.5, 5, 0.1)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const m = num(params, "mult", 2);
      const mid = smaArr(closes(bars), n);
      const sd = stdevArr(closes(bars), n);
      const upper = mid.map((v, i) => (v == null || sd[i] == null ? null : v + m * sd[i]!));
      const lower = mid.map((v, i) => (v == null || sd[i] == null ? null : v - m * sd[i]!));
      return [
        line("bb-u", "BB Upper", bars, upper, color, "main", { lineWidth: 1 }),
        line("bb-m", "BB Mid", bars, mid, color, "main", { lineWidth: 1, lineStyle: 2 }),
        line("bb-l", "BB Lower", bars, lower, color, "main", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "keltner",
    name: "Keltner Channels",
    short: "KC",
    group: "Volatility",
    pane: "main",
    params: [p("length", "Length", 20, 2, 200), p("mult", "ATR mult", 1.5, 0.5, 6, 0.1)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const m = num(params, "mult", 1.5);
      const mid = emaArr(closes(bars), n);
      const atr = rmaArr(trueRange(bars), n);
      const upper = mid.map((v, i) => (v == null || atr[i] == null ? null : v + m * atr[i]!));
      const lower = mid.map((v, i) => (v == null || atr[i] == null ? null : v - m * atr[i]!));
      return [
        line("kc-u", "KC Upper", bars, upper, color, "main", { lineWidth: 1 }),
        line("kc-m", "KC Mid", bars, mid, color, "main", { lineWidth: 1, lineStyle: 2 }),
        line("kc-l", "KC Lower", bars, lower, color, "main", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "donchian",
    name: "Donchian Channels",
    short: "DC",
    group: "Volatility",
    pane: "main",
    params: [p("length", "Length", 20, 2, 200)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const h = highs(bars);
      const l = lows(bars);
      const up: (number | null)[] = Array(bars.length).fill(null);
      const lo: (number | null)[] = Array(bars.length).fill(null);
      const mid: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        up[i] = highest(h, n, i);
        lo[i] = lowest(l, n, i);
        mid[i] = (up[i]! + lo[i]!) / 2;
      }
      return [
        line("dc-u", "Donchian High", bars, up, color, "main", { lineWidth: 1 }),
        line("dc-m", "Donchian Mid", bars, mid, color, "main", { lineWidth: 1, lineStyle: 2 }),
        line("dc-l", "Donchian Low", bars, lo, color, "main", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "envelope",
    name: "MA Envelope",
    short: "ENV",
    group: "Volatility",
    pane: "main",
    params: [p("length", "Length", 20, 2, 200), p("pct", "Percent", 2.5, 0.1, 20, 0.1)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const pct = num(params, "pct", 2.5) / 100;
      const mid = smaArr(closes(bars), n);
      const upper = mid.map((v) => (v == null ? null : v * (1 + pct)));
      const lower = mid.map((v) => (v == null ? null : v * (1 - pct)));
      return [
        line("env-u", "Env Upper", bars, upper, color, "main", { lineWidth: 1 }),
        line("env-m", "Env MA", bars, mid, color, "main", { lineWidth: 1, lineStyle: 2 }),
        line("env-l", "Env Lower", bars, lower, color, "main", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "ichimoku",
    name: "Ichimoku Cloud",
    short: "Ichimoku",
    group: "Trend",
    pane: "main",
    params: [p("tenkan", "Tenkan", 9, 2, 60), p("kijun", "Kijun", 26, 2, 120), p("senkou", "Senkou B", 52, 2, 200)],
    compute: (bars, params, color) => {
      const tenkanN = num(params, "tenkan", 9);
      const kijunN = num(params, "kijun", 26);
      const senkouN = num(params, "senkou", 52);
      const h = highs(bars);
      const l = lows(bars);
      const midHL = (n: number, i: number) => (highest(h, n, i) + lowest(l, n, i)) / 2;
      const tenkan: (number | null)[] = Array(bars.length).fill(null);
      const kijun: (number | null)[] = Array(bars.length).fill(null);
      const sa: (number | null)[] = Array(bars.length).fill(null);
      const sb: (number | null)[] = Array(bars.length).fill(null);
      const chikou: (number | null)[] = Array(bars.length).fill(null);
      const dt =
        bars.length > 1 ? bars[bars.length - 1]!.time - bars[bars.length - 2]!.time : 86400;
      const tenkanPts: LinePoint[] = [];
      const kijunPts: LinePoint[] = [];
      const saPts: LinePoint[] = [];
      const sbPts: LinePoint[] = [];
      const chiPts: LinePoint[] = [];
      for (let i = 0; i < bars.length; i++) {
        if (i >= tenkanN - 1) {
          tenkan[i] = midHL(tenkanN, i);
          tenkanPts.push({ time: bars[i]!.time, value: tenkan[i]! });
        }
        if (i >= kijunN - 1) {
          kijun[i] = midHL(kijunN, i);
          kijunPts.push({ time: bars[i]!.time, value: kijun[i]! });
        }
        if (tenkan[i] != null && kijun[i] != null) {
          const t = i + kijunN < bars.length ? bars[i + kijunN]!.time : bars[bars.length - 1]!.time + (i + kijunN - bars.length + 1) * dt;
          saPts.push({ time: t, value: (tenkan[i]! + kijun[i]!) / 2 });
          sa[i] = (tenkan[i]! + kijun[i]!) / 2;
        }
        if (i >= senkouN - 1) {
          const t = i + kijunN < bars.length ? bars[i + kijunN]!.time : bars[bars.length - 1]!.time + (i + kijunN - bars.length + 1) * dt;
          sbPts.push({ time: t, value: midHL(senkouN, i) });
          sb[i] = midHL(senkouN, i);
        }
        if (i - kijunN >= 0) {
          chikou[i] = bars[i]!.close;
          chiPts.push({ time: bars[i - kijunN]!.time, value: bars[i]!.close });
        }
      }
      return [
        { key: "tenkan", title: "Tenkan", kind: "line", pane: "main", color, data: tenkanPts, lineWidth: 1 },
        { key: "kijun", title: "Kijun", kind: "line", pane: "main", color: INDICATOR_PALETTE[1], data: kijunPts, lineWidth: 1 },
        { key: "sa", title: "Senkou A", kind: "line", pane: "main", color: INDICATOR_PALETTE[5], data: saPts, lineWidth: 1, lineStyle: 2 },
        { key: "sb", title: "Senkou B", kind: "line", pane: "main", color: INDICATOR_PALETTE[4], data: sbPts, lineWidth: 1, lineStyle: 2 },
        { key: "chi", title: "Chikou", kind: "line", pane: "main", color: INDICATOR_PALETTE[3], data: chiPts, lineWidth: 1, lineStyle: 2 },
      ];
    },
  },
  {
    id: "supertrend",
    name: "Supertrend",
    short: "ST",
    group: "Trend",
    pane: "main",
    params: [p("length", "ATR length", 10, 2, 50), p("mult", "Multiplier", 3, 1, 10, 0.1)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 10);
      const m = num(params, "mult", 3);
      const atr = rmaArr(trueRange(bars), n);
      const st: (number | null)[] = Array(bars.length).fill(null);
      const dir: number[] = Array(bars.length).fill(1);
      for (let i = 0; i < bars.length; i++) {
        if (atr[i] == null) continue;
        const hl2 = (bars[i]!.high + bars[i]!.low) / 2;
        let upper = hl2 + m * atr[i]!;
        let lower = hl2 - m * atr[i]!;
        if (i > 0 && st[i - 1] != null) {
          const prevDir = dir[i - 1]!;
          const prevLower = hl2 - m * atr[i]!;
          const prevUpper = hl2 + m * atr[i]!;
          if (prevDir === 1) {
            lower = Math.max(prevLower, (bars[i - 1]!.high + bars[i - 1]!.low) / 2 - m * (atr[i - 1] ?? atr[i]!));
            if (bars[i]!.close < lower) dir[i] = -1;
            else dir[i] = 1;
          } else {
            upper = Math.min(prevUpper, (bars[i - 1]!.high + bars[i - 1]!.low) / 2 + m * (atr[i - 1] ?? atr[i]!));
            if (bars[i]!.close > upper) dir[i] = 1;
            else dir[i] = -1;
          }
        }
        st[i] = dir[i] === 1 ? lower : upper;
      }
      const data: LinePoint[] = [];
      for (let i = 0; i < bars.length; i++) {
        if (st[i] == null) continue;
        data.push({
          time: bars[i]!.time,
          value: st[i]!,
          color: dir[i] === 1 ? "#26a69a" : "#ef5350",
        });
      }
      return [{ key: "st", title: "Supertrend", kind: "line", pane: "main", color, data, lineWidth: 2 }];
    },
  },
  {
    id: "psar",
    name: "Parabolic SAR",
    short: "PSAR",
    group: "Trend",
    pane: "main",
    params: [p("step", "Step", 0.02, 0.005, 0.1, 0.005), p("max", "Max", 0.2, 0.05, 0.5, 0.01)],
    compute: (bars, params, color) => {
      const step = num(params, "step", 0.02);
      const max = num(params, "max", 0.2);
      const out: (number | null)[] = Array(bars.length).fill(null);
      if (bars.length < 3) return [];
      let bull = bars[1]!.close >= bars[0]!.close;
      let af = step;
      let ep = bull ? bars[0]!.high : bars[0]!.low;
      let sar = bull ? bars[0]!.low : bars[0]!.high;
      out[0] = sar;
      for (let i = 1; i < bars.length; i++) {
        sar = sar + af * (ep - sar);
        if (bull) {
          sar = Math.min(sar, bars[i - 1]!.low, i > 1 ? bars[i - 2]!.low : bars[i - 1]!.low);
          if (bars[i]!.low < sar) {
            bull = false;
            sar = ep;
            ep = bars[i]!.low;
            af = step;
          } else {
            if (bars[i]!.high > ep) {
              ep = bars[i]!.high;
              af = Math.min(max, af + step);
            }
          }
        } else {
          sar = Math.max(sar, bars[i - 1]!.high, i > 1 ? bars[i - 2]!.high : bars[i - 1]!.high);
          if (bars[i]!.high > sar) {
            bull = true;
            sar = ep;
            ep = bars[i]!.high;
            af = step;
          } else {
            if (bars[i]!.low < ep) {
              ep = bars[i]!.low;
              af = Math.min(max, af + step);
            }
          }
        }
        out[i] = sar;
      }
      return [line("psar", "PSAR", bars, out, color, "main", { lineWidth: 1 })];
    },
  },
  {
    id: "vwap",
    name: "VWAP",
    short: "VWAP",
    group: "Volume",
    pane: "main",
    params: [],
    compute: (bars, _p, color) => {
      const out: (number | null)[] = Array(bars.length).fill(null);
      let pv = 0;
      let vol = 0;
      let day = "";
      for (let i = 0; i < bars.length; i++) {
        const d = new Date(bars[i]!.time * 1000).toISOString().slice(0, 10);
        if (d !== day) {
          day = d;
          pv = 0;
          vol = 0;
        }
        const tp = (bars[i]!.high + bars[i]!.low + bars[i]!.close) / 3;
        pv += tp * bars[i]!.volume;
        vol += bars[i]!.volume;
        out[i] = vol ? pv / vol : tp;
      }
      return [line("vwap", "VWAP", bars, out, color, "main")];
    },
  },
  {
    id: "rsi",
    name: "Relative Strength Index",
    short: "RSI",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 14, 2, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      const c = closes(bars);
      const gain: number[] = Array(c.length).fill(0);
      const loss: number[] = Array(c.length).fill(0);
      for (let i = 1; i < c.length; i++) {
        const d = c[i]! - c[i - 1]!;
        gain[i] = Math.max(d, 0);
        loss[i] = Math.max(-d, 0);
      }
      const ag = rmaArr(gain, n);
      const al = rmaArr(loss, n);
      const rsi = ag.map((g, i) => {
        if (g == null || al[i] == null) return null;
        if (al[i] === 0) return 100;
        const rs = g / al[i]!;
        return 100 - 100 / (1 + rs);
      });
      return [line("rsi", `RSI ${n}`, bars, rsi, color, "own")];
    },
  },
  {
    id: "stoch",
    name: "Stochastic",
    short: "Stoch",
    group: "Momentum",
    pane: "own",
    params: [p("k", "%K", 14, 2, 80), p("d", "%D", 3, 1, 20), p("smooth", "Smooth", 3, 1, 20)],
    compute: (bars, params, color) => {
      const kN = num(params, "k", 14);
      const dN = num(params, "d", 3);
      const sm = num(params, "smooth", 3);
      const h = highs(bars);
      const l = lows(bars);
      const raw: (number | null)[] = Array(bars.length).fill(null);
      for (let i = kN - 1; i < bars.length; i++) {
        const hh = highest(h, kN, i);
        const ll = lowest(l, kN, i);
        raw[i] = hh === ll ? 50 : ((bars[i]!.close - ll) / (hh - ll)) * 100;
      }
      const k = smaArr(raw.map((v) => v ?? 0), sm).map((v, i) => (raw[i] == null ? null : v));
      const d = smaArr(k.map((v) => v ?? 0), dN).map((v, i) => (k[i] == null ? null : v));
      return [
        line("k", "%K", bars, k, color, "own"),
        line("d", "%D", bars, d, INDICATOR_PALETTE[1], "own", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "stochrsi",
    name: "Stochastic RSI",
    short: "StochRSI",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 14, 2, 80)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      const rsiDef = CATALOG.find((d) => d.id === "rsi")!;
      const rsiPlot = rsiDef.compute(bars, { length: n }, color)[0];
      const values = bars.map((b) => {
        const pt = rsiPlot?.data.find((p) => p.time === b.time);
        return pt?.value ?? null;
      });
      const out: (number | null)[] = Array(bars.length).fill(null);
      const nums = values.map((v) => v ?? 0);
      for (let i = n - 1; i < bars.length; i++) {
        if (values[i] == null) continue;
        const slice = nums.slice(i - n + 1, i + 1);
        const hh = Math.max(...slice);
        const ll = Math.min(...slice);
        out[i] = hh === ll ? 50 : ((nums[i]! - ll) / (hh - ll)) * 100;
      }
      return [line("stochrsi", "StochRSI", bars, out, color, "own")];
    },
  },
  {
    id: "cci",
    name: "Commodity Channel Index",
    short: "CCI",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 20, 2, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
      const sma = smaArr(tp, n);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        const mean = sma[i];
        if (mean == null) continue;
        let md = 0;
        for (let j = 0; j < n; j++) md += Math.abs(tp[i - j]! - mean);
        md /= n;
        out[i] = md === 0 ? 0 : (tp[i]! - mean) / (0.015 * md);
      }
      return [line("cci", `CCI ${n}`, bars, out, color, "own")];
    },
  },
  {
    id: "willr",
    name: "Williams %R",
    short: "%R",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 14, 2, 80)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      const h = highs(bars);
      const l = lows(bars);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        const hh = highest(h, n, i);
        const ll = lowest(l, n, i);
        out[i] = hh === ll ? -50 : ((hh - bars[i]!.close) / (hh - ll)) * -100;
      }
      return [line("willr", "Williams %R", bars, out, color, "own")];
    },
  },
  {
    id: "macd",
    name: "MACD",
    short: "MACD",
    group: "Trend",
    pane: "own",
    params: [p("fast", "Fast", 12, 2, 50), p("slow", "Slow", 26, 5, 100), p("signal", "Signal", 9, 2, 40)],
    compute: (bars, params, color) => {
      const fast = num(params, "fast", 12);
      const slow = num(params, "slow", 26);
      const sigN = num(params, "signal", 9);
      const c = closes(bars);
      const ef = emaArr(c, fast);
      const es = emaArr(c, slow);
      const macd = ef.map((v, i) => (v == null || es[i] == null ? null : v - es[i]!));
      const signal = emaArr(macd.map((v) => v ?? 0), sigN).map((v, i) => (macd[i] == null ? null : v));
      const hist = macd.map((v, i) => (v == null || signal[i] == null ? null : v - signal[i]!));
      const histData: LinePoint[] = [];
      for (let i = 0; i < bars.length; i++) {
        if (hist[i] == null) continue;
        histData.push({
          time: bars[i]!.time,
          value: hist[i]!,
          color: hist[i]! >= 0 ? "#26a69a" : "#ef5350",
        });
      }
      return [
        { key: "hist", title: "MACD Hist", kind: "histogram", pane: "own", color, data: histData },
        line("macd", "MACD", bars, macd, color, "own"),
        line("sig", "Signal", bars, signal, INDICATOR_PALETTE[1], "own", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "adx",
    name: "Average Directional Index",
    short: "ADX",
    group: "Trend",
    pane: "own",
    params: [p("length", "Length", 14, 2, 50)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      const plusDM: number[] = Array(bars.length).fill(0);
      const minusDM: number[] = Array(bars.length).fill(0);
      for (let i = 1; i < bars.length; i++) {
        const up = bars[i]!.high - bars[i - 1]!.high;
        const down = bars[i - 1]!.low - bars[i]!.low;
        plusDM[i] = up > down && up > 0 ? up : 0;
        minusDM[i] = down > up && down > 0 ? down : 0;
      }
      const atr = rmaArr(trueRange(bars), n);
      const pdi = rmaArr(plusDM, n).map((v, i) =>
        v == null || atr[i] == null || atr[i] === 0 ? null : (100 * v) / atr[i]!,
      );
      const mdi = rmaArr(minusDM, n).map((v, i) =>
        v == null || atr[i] == null || atr[i] === 0 ? null : (100 * v) / atr[i]!,
      );
      const dx = pdi.map((p, i) => {
        if (p == null || mdi[i] == null) return 0;
        const s = p + mdi[i]!;
        return s === 0 ? 0 : (100 * Math.abs(p - mdi[i]!)) / s;
      });
      const adx = rmaArr(dx, n);
      return [
        line("adx", "ADX", bars, adx, color, "own"),
        line("pdi", "+DI", bars, pdi, "#26a69a", "own", { lineWidth: 1 }),
        line("mdi", "-DI", bars, mdi, "#ef5350", "own", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "aroon",
    name: "Aroon",
    short: "Aroon",
    group: "Trend",
    pane: "own",
    params: [p("length", "Length", 25, 5, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 25);
      const h = highs(bars);
      const l = lows(bars);
      const up: (number | null)[] = Array(bars.length).fill(null);
      const down: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n; i < bars.length; i++) {
        let hi = 0;
        let lo = 0;
        for (let j = 0; j <= n; j++) {
          if (h[i - j] === highest(h, n + 1, i)) hi = j;
          if (l[i - j] === lowest(l, n + 1, i)) lo = j;
        }
        up[i] = ((n - hi) / n) * 100;
        down[i] = ((n - lo) / n) * 100;
      }
      return [
        line("up", "Aroon Up", bars, up, "#26a69a", "own"),
        line("down", "Aroon Down", bars, down, "#ef5350", "own"),
      ];
    },
  },
  {
    id: "atr",
    name: "Average True Range",
    short: "ATR",
    group: "Volatility",
    pane: "own",
    params: [p("length", "Length", 14, 2, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      return [line("atr", `ATR ${n}`, bars, rmaArr(trueRange(bars), n), color, "own")];
    },
  },
  {
    id: "stdev",
    name: "Standard Deviation",
    short: "StdDev",
    group: "Volatility",
    pane: "own",
    params: [p("length", "Length", 20, 2, 100)],
    compute: (bars, params, color) => [
      line("sd", "StdDev", bars, stdevArr(closes(bars), num(params, "length", 20)), color, "own"),
    ],
  },
  {
    id: "roc",
    name: "Rate of Change",
    short: "ROC",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 12, 1, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 12);
      const c = closes(bars);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n; i < c.length; i++) {
        out[i] = c[i - n] ? ((c[i]! - c[i - n]!) / c[i - n]!) * 100 : null;
      }
      return [line("roc", `ROC ${n}`, bars, out, color, "own")];
    },
  },
  {
    id: "mom",
    name: "Momentum",
    short: "MOM",
    group: "Momentum",
    pane: "own",
    params: [p("length", "Length", 10, 1, 100)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 10);
      const c = closes(bars);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n; i < c.length; i++) out[i] = c[i]! - c[i - n]!;
      return [line("mom", `MOM ${n}`, bars, out, color, "own")];
    },
  },
  {
    id: "uo",
    name: "Ultimate Oscillator",
    short: "UO",
    group: "Momentum",
    pane: "own",
    params: [p("s", "Short", 7, 2, 20), p("m", "Mid", 14, 5, 40), p("l", "Long", 28, 10, 80)],
    compute: (bars, params, color) => {
      const s = num(params, "s", 7);
      const m = num(params, "m", 14);
      const l = num(params, "l", 28);
      const bp: number[] = [];
      const tr: number[] = [];
      for (let i = 0; i < bars.length; i++) {
        const prev = i === 0 ? bars[i]!.close : bars[i - 1]!.close;
        bp.push(bars[i]!.close - Math.min(bars[i]!.low, prev));
        tr.push(Math.max(bars[i]!.high, prev) - Math.min(bars[i]!.low, prev));
      }
      const avg = (n: number, i: number) => {
        let a = 0;
        let b = 0;
        for (let j = 0; j < n; j++) {
          a += bp[i - j]!;
          b += tr[i - j]!;
        }
        return b ? a / b : 0;
      };
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = l; i < bars.length; i++) {
        out[i] = 100 * ((4 * avg(s, i) + 2 * avg(m, i) + avg(l, i)) / 7);
      }
      return [line("uo", "UO", bars, out, color, "own")];
    },
  },
  {
    id: "ao",
    name: "Awesome Oscillator",
    short: "AO",
    group: "Momentum",
    pane: "own",
    params: [],
    compute: (bars, _p, color) => {
      const mid = bars.map((b) => (b.high + b.low) / 2);
      const f = smaArr(mid, 5);
      const s = smaArr(mid, 34);
      const ao = f.map((v, i) => (v == null || s[i] == null ? null : v - s[i]!));
      const data: LinePoint[] = [];
      let prev = 0;
      for (let i = 0; i < bars.length; i++) {
        if (ao[i] == null) continue;
        data.push({
          time: bars[i]!.time,
          value: ao[i]!,
          color: ao[i]! >= prev ? "#26a69a" : "#ef5350",
        });
        prev = ao[i]!;
      }
      return [{ key: "ao", title: "AO", kind: "histogram", pane: "own", color, data }];
    },
  },
  {
    id: "trix",
    name: "TRIX",
    short: "TRIX",
    group: "Trend",
    pane: "own",
    params: [p("length", "Length", 15, 2, 50)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 15);
      const c = closes(bars);
      const e1 = emaArr(c, n);
      const e2 = emaArr(e1.map((v) => v ?? 0), n);
      const e3 = emaArr(e2.map((v) => v ?? 0), n);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = 1; i < bars.length; i++) {
        if (e3[i] == null || e3[i - 1] == null || e3[i - 1] === 0) continue;
        out[i] = ((e3[i]! - e3[i - 1]!) / e3[i - 1]!) * 100;
      }
      return [line("trix", "TRIX", bars, out, color, "own")];
    },
  },
  {
    id: "ppo",
    name: "Percentage Price Oscillator",
    short: "PPO",
    group: "Momentum",
    pane: "own",
    params: [p("fast", "Fast", 12, 2, 50), p("slow", "Slow", 26, 5, 100)],
    compute: (bars, params, color) => {
      const fast = emaArr(closes(bars), num(params, "fast", 12));
      const slow = emaArr(closes(bars), num(params, "slow", 26));
      const out = fast.map((v, i) =>
        v == null || slow[i] == null || slow[i] === 0 ? null : ((v - slow[i]!) / slow[i]!) * 100,
      );
      return [line("ppo", "PPO", bars, out, color, "own")];
    },
  },
  {
    id: "tsi",
    name: "True Strength Index",
    short: "TSI",
    group: "Momentum",
    pane: "own",
    params: [p("long", "Long", 25, 5, 50), p("short", "Short", 13, 2, 30)],
    compute: (bars, params, color) => {
      const longN = num(params, "long", 25);
      const shortN = num(params, "short", 13);
      const mom: number[] = [0];
      for (let i = 1; i < bars.length; i++) mom.push(bars[i]!.close - bars[i - 1]!.close);
      const abs = mom.map((v) => Math.abs(v));
      const d1 = emaArr(mom, longN);
      const d2 = emaArr(d1.map((v) => v ?? 0), shortN);
      const a1 = emaArr(abs, longN);
      const a2 = emaArr(a1.map((v) => v ?? 0), shortN);
      const out = d2.map((v, i) => (v == null || a2[i] == null || a2[i] === 0 ? null : (100 * v) / a2[i]!));
      return [line("tsi", "TSI", bars, out, color, "own")];
    },
  },
  {
    id: "obv",
    name: "On-Balance Volume",
    short: "OBV",
    group: "Volume",
    pane: "own",
    params: [],
    compute: (bars, _p, color) => {
      const out: (number | null)[] = [];
      let v = 0;
      for (let i = 0; i < bars.length; i++) {
        if (i === 0) v = bars[i]!.volume;
        else if (bars[i]!.close > bars[i - 1]!.close) v += bars[i]!.volume;
        else if (bars[i]!.close < bars[i - 1]!.close) v -= bars[i]!.volume;
        out.push(v);
      }
      return [line("obv", "OBV", bars, out, color, "own")];
    },
  },
  {
    id: "mfi",
    name: "Money Flow Index",
    short: "MFI",
    group: "Volume",
    pane: "own",
    params: [p("length", "Length", 14, 2, 50)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 14);
      const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
      const pos: number[] = Array(bars.length).fill(0);
      const neg: number[] = Array(bars.length).fill(0);
      for (let i = 1; i < bars.length; i++) {
        const mf = tp[i]! * bars[i]!.volume;
        if (tp[i]! > tp[i - 1]!) pos[i] = mf;
        else if (tp[i]! < tp[i - 1]!) neg[i] = mf;
      }
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n; i < bars.length; i++) {
        let pSum = 0;
        let nSum = 0;
        for (let j = 0; j < n; j++) {
          pSum += pos[i - j]!;
          nSum += neg[i - j]!;
        }
        const ratio = nSum === 0 ? 100 : pSum / nSum;
        out[i] = 100 - 100 / (1 + ratio);
      }
      return [line("mfi", "MFI", bars, out, color, "own")];
    },
  },
  {
    id: "cmf",
    name: "Chaikin Money Flow",
    short: "CMF",
    group: "Volume",
    pane: "own",
    params: [p("length", "Length", 20, 2, 80)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 20);
      const mfv = bars.map((b) => {
        const den = b.high - b.low;
        const mfm = den === 0 ? 0 : (2 * b.close - b.low - b.high) / den;
        return mfm * b.volume;
      });
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        let a = 0;
        let b = 0;
        for (let j = 0; j < n; j++) {
          a += mfv[i - j]!;
          b += bars[i - j]!.volume;
        }
        out[i] = b ? a / b : 0;
      }
      return [line("cmf", "CMF", bars, out, color, "own")];
    },
  },
  {
    id: "ad",
    name: "Accumulation / Distribution",
    short: "A/D",
    group: "Volume",
    pane: "own",
    params: [],
    compute: (bars, _p, color) => {
      let acc = 0;
      const out: (number | null)[] = [];
      for (const b of bars) {
        const den = b.high - b.low;
        const clv = den === 0 ? 0 : (2 * b.close - b.low - b.high) / den;
        acc += clv * b.volume;
        out.push(acc);
      }
      return [line("ad", "A/D", bars, out, color, "own")];
    },
  },
  {
    id: "force",
    name: "Force Index",
    short: "FI",
    group: "Volume",
    pane: "own",
    params: [p("length", "Length", 13, 1, 50)],
    compute: (bars, params, color) => {
      const raw: number[] = [0];
      for (let i = 1; i < bars.length; i++) {
        raw.push((bars[i]!.close - bars[i - 1]!.close) * bars[i]!.volume);
      }
      return [line("fi", "Force", bars, emaArr(raw, num(params, "length", 13)), color, "own")];
    },
  },
  {
    id: "vo",
    name: "Volume Oscillator",
    short: "VO",
    group: "Volume",
    pane: "own",
    params: [p("fast", "Fast", 5, 2, 30), p("slow", "Slow", 10, 5, 60)],
    compute: (bars, params, color) => {
      const vol = bars.map((b) => b.volume);
      const f = emaArr(vol, num(params, "fast", 5));
      const s = emaArr(vol, num(params, "slow", 10));
      const out = f.map((v, i) =>
        v == null || s[i] == null || s[i] === 0 ? null : ((v - s[i]!) / s[i]!) * 100,
      );
      return [line("vo", "VO", bars, out, color, "own")];
    },
  },
  {
    id: "dpo",
    name: "Detrended Price Oscillator",
    short: "DPO",
    group: "Other",
    pane: "own",
    params: [p("length", "Length", 21, 5, 80)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 21);
      const shift = Math.floor(n / 2) + 1;
      const ma = smaArr(closes(bars), n);
      const out: (number | null)[] = Array(bars.length).fill(null);
      for (let i = 0; i < bars.length; i++) {
        const j = i - shift;
        if (j >= 0 && ma[i] != null) out[i] = bars[j]!.close - ma[i]!;
      }
      return [line("dpo", "DPO", bars, out, color, "own")];
    },
  },
  {
    id: "elder",
    name: "Elder Ray",
    short: "Elder",
    group: "Other",
    pane: "own",
    params: [p("length", "Length", 13, 2, 50)],
    compute: (bars, params, color) => {
      const ema = emaArr(closes(bars), num(params, "length", 13));
      const bull = bars.map((b, i) => (ema[i] == null ? null : b.high - ema[i]!));
      const bear = bars.map((b, i) => (ema[i] == null ? null : b.low - ema[i]!));
      return [
        line("bull", "Bull Power", bars, bull, "#26a69a", "own"),
        line("bear", "Bear Power", bars, bear, "#ef5350", "own"),
      ];
    },
  },
  {
    id: "kst",
    name: "Know Sure Thing",
    short: "KST",
    group: "Momentum",
    pane: "own",
    params: [],
    compute: (bars, _p, color) => {
      const roc = (n: number) => {
        const c = closes(bars);
        const out: number[] = Array(c.length).fill(0);
        for (let i = n; i < c.length; i++) {
          out[i] = c[i - n] ? ((c[i]! - c[i - n]!) / c[i - n]!) * 100 : 0;
        }
        return out;
      };
      const r1 = smaArr(roc(10), 10);
      const r2 = smaArr(roc(15), 10);
      const r3 = smaArr(roc(20), 10);
      const r4 = smaArr(roc(30), 15);
      const kst = r1.map((v, i) =>
        v == null || r2[i] == null || r3[i] == null || r4[i] == null
          ? null
          : v + 2 * r2[i]! + 3 * r3[i]! + 4 * r4[i]!,
      );
      const sig = smaArr(kst.map((v) => v ?? 0), 9).map((v, i) => (kst[i] == null ? null : v));
      return [
        line("kst", "KST", bars, kst, color, "own"),
        line("sig", "Signal", bars, sig, INDICATOR_PALETTE[1], "own", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "chandelier",
    name: "Chandelier Exit",
    short: "CE",
    group: "Other",
    pane: "main",
    params: [p("length", "Length", 22, 5, 50), p("mult", "ATR mult", 3, 1, 6, 0.1)],
    compute: (bars, params, color) => {
      const n = num(params, "length", 22);
      const m = num(params, "mult", 3);
      const atr = rmaArr(trueRange(bars), n);
      const h = highs(bars);
      const l = lows(bars);
      const long: (number | null)[] = Array(bars.length).fill(null);
      const short: (number | null)[] = Array(bars.length).fill(null);
      for (let i = n - 1; i < bars.length; i++) {
        if (atr[i] == null) continue;
        long[i] = highest(h, n, i) - m * atr[i]!;
        short[i] = lowest(l, n, i) + m * atr[i]!;
      }
      return [
        line("long", "CE Long", bars, long, "#26a69a", "main", { lineWidth: 1 }),
        line("short", "CE Short", bars, short, "#ef5350", "main", { lineWidth: 1 }),
      ];
    },
  },
  {
    id: "pivot",
    name: "Pivot Points",
    short: "Pivots",
    group: "Other",
    pane: "main",
    params: [],
    compute: (bars, _p, color) => {
      if (bars.length < 2) return [];
      const prev = bars[bars.length - 2]!;
      const pp = (prev.high + prev.low + prev.close) / 3;
      const r1 = 2 * pp - prev.low;
      const s1 = 2 * pp - prev.high;
      const r2 = pp + (prev.high - prev.low);
      const s2 = pp - (prev.high - prev.low);
      const r3 = prev.high + 2 * (pp - prev.low);
      const s3 = prev.low - 2 * (prev.high - pp);
      const mk = (key: string, title: string, value: number, c: string): PlotSpec => ({
        key,
        title,
        kind: "line",
        pane: "main",
        color: c,
        lineWidth: 1,
        lineStyle: 2,
        data: bars.slice(-80).map((b) => ({ time: b.time, value })),
      });
      return [
        mk("r3", "R3", r3, "#ef5350"),
        mk("r2", "R2", r2, "#ef5350"),
        mk("r1", "R1", r1, "#ef5350"),
        mk("p", "P", pp, color),
        mk("s1", "S1", s1, "#26a69a"),
        mk("s2", "S2", s2, "#26a69a"),
        mk("s3", "S3", s3, "#26a69a"),
      ];
    },
  },
];

export const INDICATORS: IndicatorDef[] = CATALOG;

export const INDICATOR_BY_ID: Record<string, IndicatorDef> = Object.fromEntries(
  CATALOG.map((d) => [d.id, d]),
);

export function defaultParams(def: IndicatorDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) out[p.key] = p.def;
  return out;
}

export function lastValue(plot: PlotSpec): number | null {
  if (!plot.data.length) return null;
  return plot.data[plot.data.length - 1]!.value;
}

export function heikinAshi(bars: Bar[]): Bar[] {
  if (!bars.length) return [];
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (out[i - 1]!.open + out[i - 1]!.close) / 2;
    out.push({
      time: b.time,
      open: haOpen,
      close: haClose,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      volume: b.volume,
    });
  }
  return out;
}

export { smaArr, emaArr, rmaArr, trueRange, stdevArr, closes };
