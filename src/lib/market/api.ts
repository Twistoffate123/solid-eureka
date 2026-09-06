import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Bar, ChartPayload, NewsItem, Quote, SearchHit } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 240;

function fromCache<T>(key: string, ttl: number): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function toCache(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

async function yahooGet(path: string): Promise<unknown> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Market data unavailable");
}

function emptyQuote(symbol: string): Quote {
  return {
    symbol,
    shortName: symbol,
    longName: symbol,
    exchange: "",
    fullExchange: "",
    type: "",
    currency: "",
    price: 0,
    change: 0,
    changePercent: 0,
    previousClose: 0,
    open: null,
    dayHigh: null,
    dayLow: null,
    volume: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketTime: 0,
    spark: [],
  };
}

function quoteFromMeta(meta: Record<string, unknown>, spark: number[] = []): Quote {
  const price = Number(meta.regularMarketPrice ?? 0);
  // Never use chartPreviousClose — that is the first bar of the requested range
  // (years ago on 1W/1M), not yesterday's close.
  const prevRaw = meta.previousClose ?? meta.regularMarketPreviousClose;
  const prev =
    prevRaw != null && Number.isFinite(Number(prevRaw)) && Number(prevRaw) !== 0
      ? Number(prevRaw)
      : 0;
  const changePercent = Number(
    meta.regularMarketChangePercent ?? (prev ? ((price - prev) / prev) * 100 : 0),
  );
  const change = prev ? price - prev : (price * changePercent) / 100;
  return {
    symbol: String(meta.symbol ?? ""),
    shortName: String(meta.shortName ?? meta.symbol ?? ""),
    longName: String(meta.longName ?? meta.shortName ?? meta.symbol ?? ""),
    exchange: String(meta.exchangeName ?? ""),
    fullExchange: String(meta.fullExchangeName ?? meta.exchangeName ?? ""),
    type: String(meta.instrumentType ?? ""),
    currency: String(meta.currency ?? ""),
    price,
    change,
    changePercent,
    previousClose: prev || (changePercent && price ? price / (1 + changePercent / 100) : 0),
    open: meta.regularMarketOpen == null ? null : Number(meta.regularMarketOpen),
    dayHigh: meta.regularMarketDayHigh == null ? null : Number(meta.regularMarketDayHigh),
    dayLow: meta.regularMarketDayLow == null ? null : Number(meta.regularMarketDayLow),
    volume: meta.regularMarketVolume == null ? null : Number(meta.regularMarketVolume),
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh == null ? null : Number(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow == null ? null : Number(meta.fiftyTwoWeekLow),
    marketTime: Number(meta.regularMarketTime ?? 0),
    spark,
  };
}

function intervalSeconds(interval: string): number {
  switch (interval) {
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "60m":
    case "1h":
      return 3600;
    case "1d":
      return 86_400;
    case "1wk":
      return 604_800;
    case "1mo":
      return 2_592_000;
    default:
      return 86_400;
  }
}

function mergeInProgressBar(bars: Bar[], seconds: number): Bar[] {
  if (bars.length < 2 || seconds < 86_400) return bars;
  const prev = bars[bars.length - 2]!;
  const last = bars[bars.length - 1]!;
  // Yahoo appends a "now" stub inside the current week/month bucket.
  if (last.time - prev.time >= seconds * 0.85) return bars;
  return [
    ...bars.slice(0, -2),
    {
      time: prev.time,
      open: prev.open,
      high: Math.max(prev.high, last.high),
      low: Math.min(prev.low, last.low),
      close: last.close,
      volume: prev.volume + last.volume,
    },
  ];
}

function aggregateBars(bars: Bar[], size: number): Bar[] {
  if (size <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += size) {
    const slice = bars.slice(i, i + size);
    if (!slice.length) continue;
    const first = slice[0]!;
    out.push({
      time: first.time,
      open: first.open,
      high: Math.max(...slice.map((b) => b.high)),
      low: Math.min(...slice.map((b) => b.low)),
      close: slice[slice.length - 1]!.close,
      volume: slice.reduce((s, b) => s + b.volume, 0),
    });
  }
  return out;
}

function parseChart(
  json: unknown,
  symbol: string,
  aggregate?: number,
  interval = "1d",
): ChartPayload {
  const root = json as {
    chart?: {
      result?: Array<{
        meta?: Record<string, unknown>;
        timestamp?: number[];
        indicators?: { quote?: Array<Record<string, Array<number | null>>> };
      }>;
      error?: { description?: string };
    };
  };
  const result = root.chart?.result?.[0];
  if (!result) {
    throw new Error(root.chart?.error?.description || `No chart data for ${symbol}`);
  }
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    if (![open, high, low, close].every(Number.isFinite)) continue;
    bars.push({
      time: ts[i]!,
      open,
      high,
      low,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  const packed = mergeInProgressBar(
    aggregate ? aggregateBars(bars, aggregate) : bars,
    intervalSeconds(interval) * (aggregate && aggregate > 1 ? aggregate : 1),
  );
  const meta = result.meta ?? { symbol };
  const spark = packed.slice(-40).map((b) => b.close);
  const quote = quoteFromMeta(meta, spark);
  return { symbol: quote.symbol || symbol, bars: packed, quote };
}

export const searchSymbols = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (q.length < 1) return { ok: true as const, hits: [] as SearchHit[] };
    const key = `search:${q.toLowerCase()}`;
    const cached = fromCache<{ ok: true; hits: SearchHit[] }>(key, 60_000);
    if (cached) return cached;
    try {
      const json = (await yahooGet(
        `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=24&newsCount=0&enableFuzzyQuery=true`,
      )) as { quotes?: Array<Record<string, unknown>> };
      const hits: SearchHit[] = (json.quotes ?? [])
        .filter((row) => typeof row.symbol === "string")
        .map((row) => ({
          symbol: String(row.symbol),
          name: String(row.shortname ?? row.longname ?? row.symbol),
          exchange: String(row.exchange ?? ""),
          exchDisp: String(row.exchDisp ?? row.exchange ?? ""),
          type: String(row.quoteType ?? ""),
          typeDisp: String(row.typeDisp ?? row.quoteType ?? ""),
        }));
      const payload = { ok: true as const, hits };
      toCache(key, payload);
      return payload;
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Search failed",
        hits: [] as SearchHit[],
      };
    }
  });

export const fetchChart = createServerFn({ method: "POST" })
  .validator(
    z.object({
      symbol: z.string(),
      interval: z.string(),
      range: z.string(),
      aggregate: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const key = `chart:${data.symbol}:${data.interval}:${data.range}:${data.aggregate ?? 1}`;
    const ttl = data.interval.includes("m") || data.interval.includes("h") ? 15_000 : 60_000;
    const cached = fromCache<{ ok: true; payload: ChartPayload }>(key, ttl);
    if (cached) return cached;
    try {
      const path = `/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=${encodeURIComponent(data.interval)}&range=${encodeURIComponent(data.range)}&includePrePost=false&events=div%7Csplit`;
      const json = await yahooGet(path);
      const payload = parseChart(json, data.symbol, data.aggregate, data.interval);
      const result = { ok: true as const, payload };
      toCache(key, result);
      return result;
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Chart failed",
      };
    }
  });

export const fetchQuotes = createServerFn({ method: "POST" })
  .validator(z.object({ symbols: z.array(z.string()).max(80) }))
  .handler(async ({ data }) => {
    const symbols = [...new Set(data.symbols.map((s) => s.trim()).filter(Boolean))];
    if (!symbols.length) return { ok: true as const, quotes: [] as Quote[] };
    const key = `quotes:${symbols.slice().sort().join(",")}`;
    const cached = fromCache<{ ok: true; quotes: Quote[] }>(key, 5_000);
    if (cached) return cached;
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < symbols.length; i += 20) chunks.push(symbols.slice(i, i + 20));
      const quotes: Quote[] = [];
      for (const chunk of chunks) {
        const json = (await yahooGet(
          `/v7/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=5m`,
        )) as {
          spark?: {
            result?: Array<{
              symbol?: string;
              response?: Array<{
                meta?: Record<string, unknown>;
                timestamp?: number[];
                indicators?: { quote?: Array<{ close?: Array<number | null> }> };
              }>;
            }>;
          };
        };
        for (const row of json.spark?.result ?? []) {
          const resp = row.response?.[0];
          const meta = resp?.meta;
          if (!meta) {
            quotes.push(emptyQuote(row.symbol ?? ""));
            continue;
          }
          const closes = (resp?.indicators?.quote?.[0]?.close ?? []).filter(
            (v): v is number => v != null && Number.isFinite(v),
          );
          const spark = closes.filter((_, i) => i % Math.max(1, Math.floor(closes.length / 28)) === 0);
          quotes.push(quoteFromMeta(meta, spark.length ? spark : closes.slice(-28)));
        }
      }
      const result = { ok: true as const, quotes };
      toCache(key, result);
      return result;
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Quotes failed",
        quotes: [] as Quote[],
      };
    }
  });

export const fetchNews = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => {
    const q = data.q.trim() || "markets";
    const key = `news:${q.toLowerCase()}`;
    const cached = fromCache<{ ok: true; items: NewsItem[] }>(key, 120_000);
    if (cached) return cached;
    try {
      const json = (await yahooGet(
        `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=16`,
      )) as {
        news?: Array<Record<string, unknown>>;
      };
      const items: NewsItem[] = (json.news ?? []).map((n, i) => ({
        id: String(n.uuid ?? n.id ?? i),
        title: String(n.title ?? ""),
        publisher: String(n.publisher ?? ""),
        link: String(n.link ?? ""),
        published: Number(n.providerPublishTime ?? 0),
      }));
      const result = { ok: true as const, items };
      toCache(key, result);
      return result;
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "News failed",
        items: [] as NewsItem[],
      };
    }
  });
