export const INDICATOR_PALETTE = [
  "#4db6a8",
  "#7eb8da",
  "#d4a574",
  "#c9cdd4",
  "#e07a5f",
  "#8fb996",
  "#a8b5c4",
  "#c4a8b5",
] as const;

export type ChartPalette = {
  bg: string;
  text: string;
  muted: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  volumeUp: string;
  volumeDown: string;
  crosshair: string;
  watermark: string;
};

export const DARK_CHART: ChartPalette = {
  bg: "#090b0e",
  text: "#e6e8eb",
  muted: "#8a9099",
  grid: "rgba(230, 232, 235, 0.06)",
  border: "rgba(230, 232, 235, 0.12)",
  up: "#26a69a",
  down: "#ef5350",
  volumeUp: "rgba(38, 166, 154, 0.45)",
  volumeDown: "rgba(239, 83, 80, 0.45)",
  crosshair: "rgba(230, 232, 235, 0.35)",
  watermark: "rgba(230, 232, 235, 0.045)",
};

export const LIGHT_CHART: ChartPalette = {
  bg: "#f3f4f6",
  text: "#14171c",
  muted: "#5c6370",
  grid: "rgba(20, 23, 28, 0.07)",
  border: "rgba(20, 23, 28, 0.12)",
  up: "#15803d",
  down: "#dc2626",
  volumeUp: "rgba(21, 128, 61, 0.4)",
  volumeDown: "rgba(220, 38, 38, 0.4)",
  crosshair: "rgba(20, 23, 28, 0.3)",
  watermark: "rgba(20, 23, 28, 0.05)",
};

export function heatBackground(pct: number, light: boolean): string {
  const mag = Math.min(Math.abs(pct) / 3, 1);
  const alpha = 0.12 + mag * 0.62;
  if (pct >= 0) {
    return light ? `rgba(21, 128, 61, ${alpha})` : `rgba(38, 166, 154, ${alpha})`;
  }
  return light ? `rgba(220, 38, 38, ${alpha})` : `rgba(239, 83, 80, ${alpha})`;
}
