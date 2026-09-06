import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  BarChart3,
  CandlestickChart,
  Crosshair,
  Eraser,
  LineChart,
  Minus,
  MoveUpRight,
  Spline,
  Square,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useMarketData } from "@/components/terminal/data-context";
import { formatPrice, formatVolume } from "@/lib/format";
import { heikinAshi, INDICATOR_BY_ID } from "@/lib/market/indicators";
import { TIMEFRAMES, type Bar, type Drawing, type DrawingTool } from "@/lib/market/types";
import { DARK_CHART, LIGHT_CHART } from "@/lib/theme";
import { useTerminalStore } from "@/lib/store";
import { cn, uid } from "@/lib/utils";
import type {
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

type Lwc = typeof import("lightweight-charts");

const FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];

type Hover = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function ChartView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area"> | null>(null);
  const lwcRef = useRef<Lwc | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const pendingRef = useRef<{ tool: DrawingTool; t1: number; p1: number } | null>(null);
  const hoverPtRef = useRef<{ t: number; p: number } | null>(null);
  const fitKeyRef = useRef("");
  const [engine, setEngine] = useState(0);

  const { chart, chartLoading, chartError, quotes, compareCharts } = useMarketData();
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const chartType = useTerminalStore((s) => s.chartType);
  const setChartType = useTerminalStore((s) => s.setChartType);
  const logScale = useTerminalStore((s) => s.logScale);
  const setLogScale = useTerminalStore((s) => s.setLogScale);
  const showVolume = useTerminalStore((s) => s.showVolume);
  const setShowVolume = useTerminalStore((s) => s.setShowVolume);
  const showGrid = useTerminalStore((s) => s.showGrid);
  const indicators = useTerminalStore((s) => s.indicators);
  const drawings = useTerminalStore((s) => s.drawings);
  const addDrawing = useTerminalStore((s) => s.addDrawing);
  const clearDrawings = useTerminalStore((s) => s.clearDrawings);
  const drawingTool = useTerminalStore((s) => s.drawingTool);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const theme = useTerminalStore((s) => s.theme);
  const quote = quotes[symbol] ?? chart?.quote;
  const [hover, setHover] = useState<Hover | null>(null);

  const bars = useMemo(() => {
    const raw = chart?.bars ?? [];
    if (!raw.length) return raw;
    let next = raw;
    if (quote && quote.price) {
      const last = next[next.length - 1]!;
      const tf = TIMEFRAMES.find((t) => t.id === timeframe)!;
      if (quote.marketTime >= last.time && quote.marketTime - last.time < tf.seconds * 1.6) {
        next = [
          ...next.slice(0, -1),
          {
            ...last,
            high: Math.max(last.high, quote.price),
            low: Math.min(last.low, quote.price),
            close: quote.price,
            volume: quote.volume ?? last.volume,
          },
        ];
      }
    }
    return chartType === "heikin" ? heikinAshi(next) : next;
  }, [chart, quote, timeframe, chartType]);

  barsRef.current = bars;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let dead = false;
    let chartApi: IChartApi | undefined;
    let ro: ResizeObserver | undefined;

    (async () => {
      const lwc = await import("lightweight-charts");
      if (dead || !hostRef.current) return;
      lwcRef.current = lwc;
      const pal = theme === "light" ? LIGHT_CHART : DARK_CHART;
      chartApi = lwc.createChart(hostRef.current, {
        autoSize: false,
        layout: {
          background: { color: pal.bg },
          textColor: pal.muted,
          fontFamily: "IBM Plex Sans, sans-serif",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: pal.grid, visible: showGrid },
          horzLines: { color: pal.grid, visible: showGrid },
        },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
          vertLine: { color: pal.crosshair, labelBackgroundColor: pal.border },
          horzLine: { color: pal.crosshair, labelBackgroundColor: pal.border },
        },
        rightPriceScale: { borderColor: pal.border },
        timeScale: {
          borderColor: pal.border,
          timeVisible: timeframe !== "1D" && timeframe !== "1W" && timeframe !== "1M",
          secondsVisible: timeframe === "1m",
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true },
      });
      chartRef.current = chartApi;
      const applySize = () => {
        if (!hostRef.current || !chartApi) return;
        const { clientWidth, clientHeight } = hostRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          chartApi.resize(clientWidth, clientHeight);
        }
      };
      applySize();
      ro = new ResizeObserver(applySize);
      ro.observe(hostRef.current);
      setEngine((n) => n + 1);
    })();

    return () => {
      dead = true;
      ro?.disconnect();
      chartApi?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Recreate on theme / timeframe label density / grid — data is applied in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, timeframe, showGrid]);

  useEffect(() => {
    const chartApi = chartRef.current;
    const lwc = lwcRef.current;
    if (!chartApi || !lwc || !engine) return;
    const pal = theme === "light" ? LIGHT_CHART : DARK_CHART;

    chartApi.applyOptions({
      layout: { background: { color: pal.bg }, textColor: pal.muted },
      grid: {
        vertLines: { color: pal.grid, visible: showGrid },
        horzLines: { color: pal.grid, visible: showGrid },
      },
    });

    const existing = chartApi.panes().flatMap((p) => p.getSeries());
    for (const s of existing) chartApi.removeSeries(s);
    while (chartApi.panes().length > 1) {
      chartApi.removePane(chartApi.panes().length - 1);
    }

    if (!bars.length) return;

    const ohlc = bars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const line = bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close }));

    let main: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;
    if (chartType === "line") {
      main = chartApi.addSeries(lwc.LineSeries, {
        color: pal.up,
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
      });
      main.setData(line);
    } else if (chartType === "area") {
      main = chartApi.addSeries(lwc.AreaSeries, {
        lineColor: pal.up,
        topColor: "rgba(38, 166, 154, 0.28)",
        bottomColor: "rgba(38, 166, 154, 0.02)",
        lineWidth: 2,
      });
      main.setData(line);
    } else if (chartType === "bar") {
      main = chartApi.addSeries(lwc.BarSeries, {
        upColor: pal.up,
        downColor: pal.down,
      });
      main.setData(ohlc);
    } else {
      main = chartApi.addSeries(lwc.CandlestickSeries, {
        upColor: pal.up,
        downColor: pal.down,
        borderUpColor: pal.up,
        borderDownColor: pal.down,
        wickUpColor: pal.up,
        wickDownColor: pal.down,
      });
      main.setData(ohlc);
    }
    seriesRef.current = main;
    chartApi.priceScale("right").applyOptions({
      mode: logScale ? lwc.PriceScaleMode.Logarithmic : lwc.PriceScaleMode.Normal,
    });

    let pane = 1;
    if (showVolume) {
      const vol = chartApi.addSeries(
        lwc.HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
        },
        pane,
      );
      vol.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? pal.volumeUp : pal.volumeDown,
        })),
      );
      chartApi.panes()[pane]?.setHeight(72);
      pane += 1;
    }

    const usedPanes: Record<string, number> = {};
    for (const inst of indicators) {
      if (!inst.visible) continue;
      const def = INDICATOR_BY_ID[inst.type];
      if (!def) continue;
      const plots = def.compute(bars, inst.params, inst.color);
      for (const plot of plots) {
        let pIndex = 0;
        if (plot.pane === "own") {
          const key = inst.id;
          if (usedPanes[key] == null) {
            usedPanes[key] = pane;
            pane += 1;
          }
          pIndex = usedPanes[key]!;
        }
        if (plot.kind === "histogram") {
          const s = chartApi.addSeries(
            lwc.HistogramSeries,
            { priceScaleId: plot.pane === "own" ? `${inst.id}-h` : "right" },
            pIndex,
          );
          s.setData(
            plot.data.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
              color: d.color ?? inst.color,
            })),
          );
        } else {
          const s = chartApi.addSeries(
            lwc.LineSeries,
            {
              color: plot.color,
              lineWidth: (plot.lineWidth ?? 2) as 1 | 2 | 3 | 4,
              lineStyle: plot.lineStyle ?? 0,
              lastValueVisible: plot.pane === "main",
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            },
            pIndex,
          );
          s.setData(plot.data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
        }
        if (plot.pane === "own") chartApi.panes()[pIndex]?.setHeight(88);
      }
    }

    for (const [sym, payload] of Object.entries(compareCharts)) {
      if (!payload.bars.length) continue;
      const first = payload.bars[0]!.close;
      const s = chartApi.addSeries(lwc.LineSeries, {
        color: "#d4a574",
        lineWidth: 1,
        priceScaleId: "left",
        title: sym,
      });
      s.setData(
        payload.bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: first ? (b.close / first) * 100 : b.close,
        })),
      );
    }
    if (Object.keys(compareCharts).length) {
      chartApi.priceScale("left").applyOptions({ visible: true, borderColor: pal.border });
    }

    try {
      lwc.createTextWatermark(chartApi.panes()[0]!, {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: "MERIDIAN",
            color: pal.watermark,
            fontSize: 42,
            fontFamily: "IBM Plex Sans, sans-serif",
            fontStyle: "600",
          },
        ],
      });
    } catch {
      /* watermark optional */
    }

    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.seriesData.size) {
        setHover(null);
        return;
      }
      const t = param.time as number;
      const bar = barsRef.current.find((b) => b.time === t);
      if (bar) setHover(bar);
    };
    chartApi.subscribeCrosshairMove(onMove);
    const key = `${symbol}-${timeframe}-${chartType}`;
    if (fitKeyRef.current !== key) {
      chartApi.timeScale().fitContent();
      fitKeyRef.current = key;
    }
    drawOverlay();

    return () => {
      chartApi.unsubscribeCrosshairMove(onMove);
    };
  }, [bars, chartType, indicators, showVolume, logScale, compareCharts, theme, showGrid, engine, symbol, timeframe]);

  const drawOverlay = () => {
    const canvas = overlayRef.current;
    const chartApi = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chartApi || !series) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const pal = theme === "light" ? LIGHT_CHART : DARK_CHART;
    ctx.lineWidth = 1.25;
    ctx.font = "11px IBM Plex Sans, sans-serif";

    const xOf = (t: number) => chartApi.timeScale().timeToCoordinate(t as UTCTimestamp);
    const yOf = (p: number) => series.priceToCoordinate(p);

    const stroke = (color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    };

    const all: Drawing[] = [...drawings];
    const pending = pendingRef.current;
    const hoverPt = hoverPtRef.current;
    if (pending && hoverPt) {
      if (pending.tool === "trend") {
        all.push({
          id: "tmp",
          tool: "trend",
          t1: pending.t1,
          p1: pending.p1,
          t2: hoverPt.t,
          p2: hoverPt.p,
        });
      } else if (pending.tool === "fib") {
        all.push({
          id: "tmp",
          tool: "fib",
          t1: pending.t1,
          p1: pending.p1,
          t2: hoverPt.t,
          p2: hoverPt.p,
        });
      } else if (pending.tool === "rect") {
        all.push({
          id: "tmp",
          tool: "rect",
          t1: pending.t1,
          p1: pending.p1,
          t2: hoverPt.t,
          p2: hoverPt.p,
        });
      }
    }

    for (const d of all) {
      if (d.tool === "hline") {
        const y = yOf(d.price);
        if (y == null) continue;
        stroke(pal.up);
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(formatPrice(d.price), 8, y - 4);
      } else if (d.tool === "trend") {
        const x1 = xOf(d.t1);
        const y1 = yOf(d.p1);
        const x2 = xOf(d.t2);
        const y2 = yOf(d.p2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        stroke("#7eb8da");
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (d.tool === "rect") {
        const x1 = xOf(d.t1);
        const y1 = yOf(d.p1);
        const x2 = xOf(d.t2);
        const y2 = yOf(d.p2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        ctx.fillStyle = "rgba(77, 182, 168, 0.12)";
        ctx.strokeStyle = "#4db6a8";
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (d.tool === "fib") {
        const x1 = xOf(d.t1);
        const y1 = yOf(d.p1);
        const x2 = xOf(d.t2);
        const y2 = yOf(d.p2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        for (const lv of FIBS) {
          const y = y1 + (y2 - y1) * lv;
          const price = d.p1 + (d.p2 - d.p1) * lv;
          ctx.strokeStyle = lv === 0.618 || lv === 0.5 ? "#4db6a8" : pal.muted;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(Math.max(right, left + 80), y);
          ctx.stroke();
          ctx.fillStyle = pal.text;
          ctx.fillText(`${(lv * 100).toFixed(1)}  ${formatPrice(price)}`, left + 4, y - 3);
        }
      }
    }
  };

  useEffect(() => {
    const canvas = overlayRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const sync = () => {
      const r = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOverlay();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(host);
    const chartApi = chartRef.current;
    const onRange = () => drawOverlay();
    chartApi?.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => {
      ro.disconnect();
      chartApi?.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
    };
    // drawings / theme changes should redraw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings, theme, bars, drawingTool, engine]);

  const onOverlayPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingTool === "cursor") return;
    const chartApi = chartRef.current;
    const series = seriesRef.current;
    const canvas = overlayRef.current;
    if (!chartApi || !series || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = chartApi.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return;
    const t = time as number;

    if (e.type === "pointermove") {
      hoverPtRef.current = { t, p: price };
      if (pendingRef.current) drawOverlay();
      return;
    }
    if (e.type !== "pointerdown") return;

    if (drawingTool === "hline") {
      addDrawing({ id: uid("d"), tool: "hline", price });
      pendingRef.current = null;
      return;
    }
    if (!pendingRef.current) {
      pendingRef.current = { tool: drawingTool, t1: t, p1: price };
      return;
    }
    const p = pendingRef.current;
    if (p.tool === "trend" || p.tool === "fib" || p.tool === "rect") {
      addDrawing({ id: uid("d"), tool: p.tool, t1: p.t1, p1: p.p1, t2: t, p2: price });
    }
    pendingRef.current = null;
  };

  const last = bars[bars.length - 1];
  const shown = hover ?? last;
  const up = shown ? shown.close >= shown.open : true;
  const periodMove = useMemo(() => {
    if ((timeframe !== "1W" && timeframe !== "1M") || bars.length < 2) return null;
    const cur = bars[bars.length - 1]!;
    const prev = bars[bars.length - 2]!;
    if (!prev.close) return null;
    return { change: cur.close - prev.close, pct: ((cur.close - prev.close) / prev.close) * 100 };
  }, [bars, timeframe]);
  const move = periodMove
    ? periodMove
    : quote
      ? { change: quote.change, pct: quote.changePercent }
      : null;
  const liveUp = (move?.pct ?? 0) >= 0;

  return (
    <section className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="truncate text-base font-medium tracking-tight text-fg">
              {quote?.shortName || symbol}
            </h1>
            <span className="font-mono text-xs text-muted">{symbol}</span>
            {quote?.fullExchange ? (
              <span className="text-xs text-subtle">{quote.fullExchange}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
            <span className={cn("tabular font-mono text-xl font-medium", liveUp ? "text-up" : "text-down")}>
              {quote ? formatPrice(quote.price) : shown ? formatPrice(shown.close) : "—"}
            </span>
            {move ? (
              <span className={cn("tabular text-sm", liveUp ? "text-up" : "text-down")}>
                {liveUp ? "+" : ""}
                {formatPrice(move.change)} ({liveUp ? "+" : ""}
                {move.pct.toFixed(2)}%)
                {periodMove ? (
                  <span className="ml-1 text-[0.6875rem] text-subtle">{timeframe}</span>
                ) : null}
              </span>
            ) : null}
            {quote?.currency ? <span className="text-xs text-subtle">{quote.currency}</span> : null}
          </div>
        </div>
        {shown ? (
          <div className="hidden gap-3 font-mono text-[0.6875rem] text-muted sm:flex">
            <span>
              O <span className="text-fg">{formatPrice(shown.open)}</span>
            </span>
            <span>
              H <span className="text-up">{formatPrice(shown.high)}</span>
            </span>
            <span>
              L <span className="text-down">{formatPrice(shown.low)}</span>
            </span>
            <span>
              C <span className={up ? "text-up" : "text-down"}>{formatPrice(shown.close)}</span>
            </span>
            <span>
              V <span className="text-fg">{formatVolume(shown.volume)}</span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="flex items-center">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframe(tf.id)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 font-mono text-xs",
                timeframe === tf.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-border" />
        {(
          [
            ["candle", CandlestickChart, "Candles"],
            ["bar", BarChart3, "Bars"],
            ["line", LineChart, "Line"],
            ["area", AreaChart, "Area"],
            ["heikin", Spline, "Heikin Ashi"],
          ] as const
        ).map(([id, Icon, label]) => (
          <Tooltip key={id} content={label}>
            <Button
              size="icon-sm"
              variant={chartType === id ? "secondary" : "ghost"}
              aria-label={label}
              onClick={() => setChartType(id)}
            >
              <Icon className="size-4" />
            </Button>
          </Tooltip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {(
          [
            ["cursor", Crosshair, "Cursor"],
            ["hline", Minus, "Horizontal"],
            ["trend", MoveUpRight, "Trend line"],
            ["fib", TrendingUp, "Fibonacci"],
            ["rect", Square, "Rectangle"],
          ] as const
        ).map(([id, Icon, label]) => (
          <Tooltip key={id} content={label}>
            <Button
              size="icon-sm"
              variant={drawingTool === id ? "secondary" : "ghost"}
              aria-label={label}
              onClick={() => setDrawingTool(id)}
            >
              <Icon className="size-4" />
            </Button>
          </Tooltip>
        ))}
        <Tooltip content="Clear drawings">
          <Button size="icon-sm" variant="ghost" aria-label="Clear drawings" onClick={clearDrawings}>
            <Eraser className="size-4" />
          </Button>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setLogScale(!logScale)}
          className={cn(
            "h-8 rounded-md px-2 text-xs",
            logScale ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          Log
        </button>
        <button
          type="button"
          onClick={() => setShowVolume(!showVolume)}
          className={cn(
            "h-8 rounded-md px-2 text-xs",
            showVolume ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          Vol
        </button>
      </div>

      <div className="chart-stage relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        <canvas
          ref={overlayRef}
          className={cn(
            "absolute inset-0",
            drawingTool === "cursor" ? "pointer-events-none" : "cursor-crosshair",
          )}
          onPointerDown={onOverlayPointer}
          onPointerMove={onOverlayPointer}
        />
        {chartLoading && !bars.length ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading chart…</div>
        ) : null}
        {chartError && !bars.length ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">
            {chartError}
          </div>
        ) : null}
      </div>
    </section>
  );
}
