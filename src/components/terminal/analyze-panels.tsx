import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Plus, PenLine, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketData } from "@/components/terminal/data-context";
import { formatDate, formatPct, formatPrice, formatTime, formatVolume } from "@/lib/format";
import { generateAiOutlook } from "@/lib/market/ai";
import { fetchNews } from "@/lib/market/api";
import { MARKET_HEATMAP, UNIVERSES } from "@/lib/market/exchanges";
import { INDICATORS, INDICATOR_BY_ID } from "@/lib/market/indicators";
import { buildOutlook } from "@/lib/market/outlook";
import type { RightTab } from "@/lib/market/types";
import { heatBackground } from "@/lib/theme";
import { useTerminalStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: { id: RightTab; label: string }[] = [
  { id: "outlook", label: "Outlook" },
  { id: "overview", label: "Details" },
  { id: "indicators", label: "Indicators" },
  { id: "news", label: "News" },
  { id: "screener", label: "Screener" },
  { id: "markets", label: "Markets" },
  { id: "alerts", label: "Alerts" },
];

export function AnalyzePanels() {
  const tab = useTerminalStore((s) => s.rightTab);
  const setTab = useTerminalStore((s) => s.setRightTab);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as RightTab)}
      className="flex h-full min-h-0 flex-col bg-surface"
    >
      <TabsList className="shrink-0">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="panel-scroll min-h-0 flex-1">
        <TabsContent value="outlook">
          <OutlookPanel />
        </TabsContent>
        <TabsContent value="overview">
          <DetailsPanel />
        </TabsContent>
        <TabsContent value="indicators">
          <IndicatorsPanel />
        </TabsContent>
        <TabsContent value="news">
          <NewsPanel />
        </TabsContent>
        <TabsContent value="screener">
          <ScreenerPanel />
        </TabsContent>
        <TabsContent value="markets">
          <HeatmapPanel />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function OutlookPanel() {
  const { chart, quotes } = useMarketData();
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = quotes[symbol] ?? chart?.quote;
  const outlook = useMemo(() => {
    if (!chart?.bars.length || !quote) return null;
    return buildOutlook(chart.bars, quote);
  }, [chart, quote]);
  const [ai, setAi] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!outlook || !quote) {
    return <p className="p-4 text-sm text-muted">Load a chart to generate an outlook.</p>;
  }

  const tone =
    outlook.bias.includes("bull") ? "up" : outlook.bias.includes("bear") ? "down" : "neutral";

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant={tone === "up" ? "up" : tone === "down" ? "down" : "default"}>
            {outlook.headline.split("·")[0]?.trim()}
          </Badge>
          <span className="tabular text-xs text-muted">
            Conviction {Math.round(outlook.conviction * 100)}%
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-fg">{outlook.summary}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {outlook.snapshot.map((s) => (
          <div key={s.label} className="rounded-lg bg-elevated px-3 py-2">
            <p className="text-[0.6875rem] uppercase tracking-wide text-subtle">{s.label}</p>
            <p
              className={cn(
                "tabular mt-0.5 font-mono text-sm",
                s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : "text-fg",
              )}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {outlook.bullets.map((b) => (
          <li key={b} className="text-sm leading-relaxed text-muted">
            {b}
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">
          Levels
        </p>
        <div className="space-y-1">
          {outlook.levels.map((lv) => (
            <div key={lv.label} className="flex items-center justify-between text-sm">
              <span className="text-muted">{lv.label}</span>
              <span className="tabular font-mono text-fg">{formatPrice(lv.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg">Desk note</p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setAiErr(null);
              const res = await generateAiOutlook({
                data: {
                  symbol: quote.symbol,
                  name: quote.longName || quote.shortName,
                  headline: outlook.headline,
                  summary: outlook.summary,
                  bullets: outlook.bullets,
                  snapshot: outlook.snapshot.map((s) => ({ label: s.label, value: s.value })),
                },
              });
              setBusy(false);
              if (res.ok) setAi(res.text);
              else setAiErr(res.error);
            }}
          >
            <PenLine className="size-3.5" />
            {busy ? "Writing…" : "Write with Grok"}
          </Button>
        </div>
        {ai ? <p className="mt-2 text-sm leading-relaxed text-muted">{ai}</p> : null}
        {aiErr ? <p className="mt-2 text-sm text-down">{aiErr}</p> : null}
        {!ai && !aiErr ? (
          <p className="mt-2 text-xs text-subtle">
            Optional narrative from the same readings. User-initiated, not a live feed.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DetailsPanel() {
  const { chart, quotes } = useMarketData();
  const symbol = useTerminalStore((s) => s.symbol);
  const toggleCompare = useTerminalStore((s) => s.toggleCompare);
  const compare = useTerminalStore((s) => s.compare);
  const q = quotes[symbol] ?? chart?.quote;
  if (!q) return <p className="p-4 text-sm text-muted">No quote yet.</p>;
  const rows: [string, string][] = [
    ["Symbol", q.symbol],
    ["Name", q.longName || q.shortName],
    ["Exchange", q.fullExchange || q.exchange],
    ["Type", q.type || "—"],
    ["Currency", q.currency || "—"],
    ["Last", formatPrice(q.price)],
    ["Change", `${formatPrice(q.change)} (${formatPct(q.changePercent)})`],
    ["Previous close", formatPrice(q.previousClose)],
    ["Day high", q.dayHigh != null ? formatPrice(q.dayHigh) : "—"],
    ["Day low", q.dayLow != null ? formatPrice(q.dayLow) : "—"],
    ["Volume", q.volume != null ? formatVolume(q.volume) : "—"],
    ["52-week high", q.fiftyTwoWeekHigh != null ? formatPrice(q.fiftyTwoWeekHigh) : "—"],
    ["52-week low", q.fiftyTwoWeekLow != null ? formatPrice(q.fiftyTwoWeekLow) : "—"],
    ["As of", q.marketTime ? formatTime(q.marketTime) : "—"],
  ];
  return (
    <div className="p-4">
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="max-w-[60%] text-right font-mono text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <Button
        className="mt-4 w-full"
        size="sm"
        variant={compare.includes(symbol) ? "secondary" : "outline"}
        onClick={() => toggleCompare(symbol)}
      >
        {compare.includes(symbol) ? "Remove from compare" : "Compare overlay"}
      </Button>
      {compare.length ? (
        <p className="mt-2 text-xs text-subtle">Comparing: {compare.join(", ")}</p>
      ) : null}
    </div>
  );
}

function IndicatorsPanel() {
  const indicators = useTerminalStore((s) => s.indicators);
  const addIndicator = useTerminalStore((s) => s.addIndicator);
  const removeIndicator = useTerminalStore((s) => s.removeIndicator);
  const updateIndicator = useTerminalStore((s) => s.updateIndicator);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("All");
  const groups = ["All", "Trend", "Momentum", "Volatility", "Volume", "Other"];
  const filtered = INDICATORS.filter((d) => {
    if (group !== "All" && d.group !== group) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.short.toLowerCase().includes(s);
  });

  return (
    <div className="p-3">
      <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">
        Active
      </p>
      <div className="mb-4 space-y-2">
        {indicators.length === 0 ? (
          <p className="text-sm text-muted">No overlays yet. Add from the catalog below.</p>
        ) : (
          indicators.map((inst) => {
            const def = INDICATOR_BY_ID[inst.type];
            if (!def) return null;
            return (
              <div key={inst.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: inst.color }} />
                  <span className="flex-1 text-sm font-medium text-fg">{def.short}</span>
                  <Switch
                    checked={inst.visible}
                    onCheckedChange={(v) => updateIndicator(inst.id, { visible: v })}
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    className="grid size-8 place-items-center rounded-md text-muted hover:text-down"
                    onClick={() => removeIndicator(inst.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {def.params.map((p) => (
                  <label key={p.key} className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">{p.label}</span>
                    <input
                      type="number"
                      className="h-8 w-20 rounded-md border border-border bg-bg px-2 font-mono text-fg"
                      value={inst.params[p.key] ?? p.def}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      onChange={(e) =>
                        updateIndicator(inst.id, {
                          params: { ...inst.params, [p.key]: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search indicators"
        className="mb-2 h-9"
      />
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs",
              group === g ? "bg-accent text-primary" : "text-muted hover:bg-elevated",
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => addIndicator(d.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-elevated"
          >
            <span>
              <span className="block text-sm text-fg">{d.name}</span>
              <span className="text-xs text-subtle">
                {d.group} · {d.pane === "main" ? "overlay" : "pane"}
              </span>
            </span>
            <Plus className="size-4 text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

function NewsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const { chart, quotes } = useMarketData();
  const q = quotes[symbol] ?? chart?.quote;
  const query = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => fetchNews({ data: { q: q?.shortName || symbol } }),
    staleTime: 120_000,
  });
  const items = query.data?.ok ? query.data.items : [];
  return (
    <div className="p-3">
      {query.isLoading ? <p className="text-sm text-muted">Loading headlines…</p> : null}
      {query.data && !query.data.ok ? (
        <p className="text-sm text-down">{query.data.error}</p>
      ) : null}
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.id}>
            <a
              href={n.link}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg p-2 hover:bg-elevated"
            >
              <p className="text-sm leading-snug text-fg">{n.title}</p>
              <p className="mt-1 text-xs text-subtle">
                {n.publisher}
                {n.published ? ` · ${formatDate(n.published)}` : ""}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScreenerPanel() {
  const [uni, setUni] = useState("us");
  const { quotes } = useMarketData();
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const universe = UNIVERSES[uni]!;
  const rows = universe.symbols
    .map((s) => quotes[s])
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.changePercent) - Math.abs(a!.changePercent));
  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap gap-1">
        {Object.entries(UNIVERSES).map(([id, u]) => (
          <button
            key={id}
            type="button"
            onClick={() => setUni(id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs",
              uni === id ? "bg-accent text-primary" : "text-muted hover:bg-elevated",
            )}
          >
            {u.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {rows.map((q) => {
          if (!q) return null;
          const up = q.changePercent >= 0;
          return (
            <button
              key={q.symbol}
              type="button"
              onClick={() => setSymbol(q.symbol)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated"
            >
              <span className="w-24 font-mono text-sm text-fg">{q.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{q.shortName}</span>
              <span className="tabular font-mono text-sm text-fg">{formatPrice(q.price)}</span>
              <span className={cn("tabular w-16 text-right text-xs", up ? "text-up" : "text-down")}>
                {formatPct(q.changePercent)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapPanel() {
  const { quotes } = useMarketData();
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const theme = useTerminalStore((s) => s.theme);
  return (
    <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
      {MARKET_HEATMAP.map((cell) => {
        const q = quotes[cell.symbol];
        const pct = q?.changePercent ?? 0;
        const up = pct >= 0;
        return (
          <button
            key={cell.symbol}
            type="button"
            onClick={() => setSymbol(cell.symbol)}
            className="heat-cell rounded-lg p-3 text-left"
            style={{ background: heatBackground(pct, theme === "light") }}
          >
            <p className="text-xs text-fg/80">{cell.label}</p>
            <p className="tabular mt-1 font-mono text-sm font-medium text-fg">
              {q ? formatPrice(q.price) : "—"}
            </p>
            <p className={cn("tabular text-xs", up ? "text-up" : "text-down")}>
              {q ? formatPct(pct) : "—"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function AlertsPanel() {
  const alerts = useTerminalStore((s) => s.alerts);
  const addAlert = useTerminalStore((s) => s.addAlert);
  const removeAlert = useTerminalStore((s) => s.removeAlert);
  const symbol = useTerminalStore((s) => s.symbol);
  const { quotes, chart } = useMarketData();
  const q = quotes[symbol] ?? chart?.quote;
  const [price, setPrice] = useState("");
  const [op, setOp] = useState<"above" | "below">("above");

  return (
    <div className="p-4">
      <p className="mb-3 text-sm text-muted">
        Local price alerts on {symbol}. They fire in this browser when live quotes cross the level.
      </p>
      <div className="mb-4 flex gap-2">
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as "above" | "below")}
          className="h-10 rounded-md border border-border bg-bg px-2 text-sm text-fg"
        >
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={q ? formatPrice(q.price) : "Price"}
          className="flex-1"
        />
        <Button
          size="default"
          onClick={() => {
            const n = Number(price);
            if (!Number.isFinite(n) || n <= 0) return;
            addAlert({ symbol, operator: op, price: n });
            setPrice("");
          }}
        >
          <Bell className="size-4" />
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {alerts.length === 0 ? <li className="text-sm text-muted">No alerts yet.</li> : null}
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
          >
            <div>
              <p className="font-mono text-sm text-fg">
                {a.symbol} {a.operator} {formatPrice(a.price)}
              </p>
              <p className="text-xs text-subtle">
                {a.triggeredAt ? `Triggered ${formatTime(a.triggeredAt / 1000)}` : "Armed"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove alert"
              className="grid size-9 place-items-center rounded-md text-muted hover:text-down"
              onClick={() => removeAlert(a.id)}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
