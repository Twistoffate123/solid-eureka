import { Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniSpark } from "@/components/terminal/mini-spark";
import { useMarketData } from "@/components/terminal/data-context";
import { formatPct, formatPrice } from "@/lib/format";
import { useTerminalStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function WatchlistPanel() {
  const watchlists = useTerminalStore((s) => s.watchlists);
  const activeId = useTerminalStore((s) => s.activeWatchlistId);
  const setActive = useTerminalStore((s) => s.setActiveWatchlist);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const symbol = useTerminalStore((s) => s.symbol);
  const remove = useTerminalStore((s) => s.removeFromWatchlist);
  const createWatchlist = useTerminalStore((s) => s.createWatchlist);
  const deleteWatchlist = useTerminalStore((s) => s.deleteWatchlist);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const { quotes } = useMarketData();

  const active = watchlists.find((w) => w.id === activeId) ?? watchlists[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">Watchlist</p>
          <p className="text-sm font-medium text-fg">{active?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="New watchlist"
            onClick={() => {
              const name = window.prompt("Watchlist name");
              if (name?.trim()) createWatchlist(name.trim());
            }}
          >
            <Plus className="size-4" />
          </Button>
          {watchlists.length > 1 ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete watchlist"
              onClick={() => active && deleteWatchlist(active.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {watchlists.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setActive(w.id)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs",
              w.id === activeId ? "bg-accent text-primary" : "text-muted hover:bg-elevated",
            )}
          >
            {w.name}
          </button>
        ))}
      </div>
      <div className="panel-scroll min-h-0 flex-1">
        {(active?.symbols ?? []).map((sym) => {
          const q = quotes[sym];
          const up = (q?.changePercent ?? 0) >= 0;
          const selected = sym === symbol;
          return (
            <div
              key={sym}
              className={cn(
                "group flex items-center gap-2 border-b border-border/70 px-2 py-2",
                selected && "bg-elevated",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setSymbol(sym)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-fg">{sym}</span>
                    {q?.fullExchange ? (
                      <Badge variant="outline" className="hidden lg:inline-flex">
                        {q.fullExchange}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">{q?.shortName ?? "—"}</p>
                </div>
                {q?.spark?.length ? <MiniSpark values={q.spark} up={up} /> : null}
                <div className="w-20 text-right">
                  <p className="tabular font-mono text-sm text-fg">
                    {q ? formatPrice(q.price) : "—"}
                  </p>
                  <p className={cn("tabular text-xs", up ? "text-up" : "text-down")}>
                    {q ? formatPct(q.changePercent) : "—"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Remove ${sym}`}
                className="grid size-9 place-items-center rounded-md text-subtle opacity-0 hover:bg-bg hover:text-down group-hover:opacity-100"
                onClick={() => remove(sym)}
              >
                <Star className="size-3.5 fill-current" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center justify-center gap-2 px-3 py-3 text-sm text-muted hover:bg-elevated hover:text-fg"
        >
          <Plus className="size-4" />
          Add symbol
        </button>
      </div>
    </div>
  );
}
