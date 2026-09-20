import type { Bar, TimeframeId } from "./types";
import { PERIOD_WINDOWS } from "./types";

export function rangeMoveFromBars(
  bars: Bar[],
  timeframe: TimeframeId,
): { change: number; pct: number; label: string } | null {
  const windowSec = PERIOD_WINDOWS[timeframe];
  if (!windowSec || bars.length < 2) return null;
  const cur = bars[bars.length - 1]!;
  if (!cur?.close) return null;
  const cutoff = cur.time - windowSec;
  const after = bars.find((b) => b.time >= cutoff);
  const start = after ?? bars[0]!;
  if (!start.close) return null;
  const change = cur.close - start.close;
  const pct = (change / start.close) * 100;
  return { change, pct, label: timeframe };
}
