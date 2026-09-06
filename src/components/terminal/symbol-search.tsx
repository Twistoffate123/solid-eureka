import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchSymbols } from "@/lib/market/api";
import { EXCHANGES, REGIONS } from "@/lib/market/exchanges";
import { useTerminalStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SymbolSearch() {
  const open = useTerminalStore((s) => s.searchOpen);
  const setOpen = useTerminalStore((s) => s.setSearchOpen);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const addToWatchlist = useTerminalStore((s) => s.addToWatchlist);
  const watchlists = useTerminalStore((s) => s.watchlists);
  const activeId = useTerminalStore((s) => s.activeWatchlistId);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("All");

  const query = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchSymbols({ data: { q } }),
    enabled: open && q.trim().length >= 1,
    staleTime: 30_000,
  });

  const active = watchlists.find((w) => w.id === activeId);
  const starred = new Set(active?.symbols ?? []);

  const hits = useMemo(() => {
    const list = query.data?.ok ? query.data.hits : [];
    if (region === "All") return list;
    const suffixes = EXCHANGES.filter((e) => e.region === region).map((e) => e.suffix);
    return list.filter((h) => {
      if (region === "Americas" && !h.symbol.includes(".")) return true;
      return suffixes.some((s) => s && h.symbol.endsWith(s));
    });
  }, [query.data, region]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !e.metaKey && !e.ctrlKey)) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (e.key === "/" && (tag === "INPUT" || tag === "TEXTAREA")) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0" title="Search markets">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 text-muted" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Symbol, company, index, FX, crypto…"
            className="h-10 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {["All", ...REGIONS].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs",
                region === r ? "bg-accent text-primary" : "text-muted hover:bg-elevated",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="max-h-80 overflow-auto px-1 pb-2">
          {!q.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Search any venue — NYSE, LSE, TSE, HKEX, NSE, ASX, Xetra, and 50+ more.
            </p>
          ) : query.isFetching ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>
          ) : (
            hits.map((hit) => (
              <div
                key={hit.symbol}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-elevated"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    setSymbol(hit.symbol);
                    setOpen(false);
                  }}
                >
                  <span className="w-24 shrink-0 font-mono text-sm font-medium text-fg">
                    {hit.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{hit.name}</span>
                  <Badge variant="outline">{hit.exchDisp || hit.exchange}</Badge>
                  <span className="hidden w-16 shrink-0 text-right text-xs text-subtle sm:block">
                    {hit.typeDisp}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Add to watchlist"
                  className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-primary"
                  onClick={() => addToWatchlist(hit.symbol)}
                >
                  <Star className={cn("size-4", starred.has(hit.symbol) && "fill-primary text-primary")} />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
