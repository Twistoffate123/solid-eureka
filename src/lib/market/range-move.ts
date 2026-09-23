import type { Bar, TimeframeId } from "./types";
import { PERIOD_WINDOWS } from "./types";

export function rangeMoveFromBars(
  bars: Bar[],
  timeframe: TimeframeId,
): { change: number; pct: number; label: string } | null {
  const windowSec = PERIOD_WINDOWS[timeframe];
  if (!windowSec || bars.length < 2) return null;
  const cur = bars[bars.length - 1]!;
  if (!cur.close) return null;
  const cutoff = cur.time - windowSec;
  // Latest bar that already existed at the start of the window.
  // The first bar *after* the cutoff is often the current monthly/weekly
  // candle itself, which made 1M print +0.00%.
  let start: Bar | undefined;
  for (let i = bars.length - 1; i >= 0; i--) {
    const bar = bars[i]!;
    if (bar.time < cur.time && bar.time <= cutoff) {
      start = bar;
      break;
    }
  }
  if (!start) start = bars[bars.length - 2]!;
  if (!start.close) return null;
  const change = cur.close - start.close;
  const pct = (change / start.close) * 100;
  return { change, pct, label: timeframe };
}
