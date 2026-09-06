const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatPrice(value: number, hint = 2): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  let digits = hint;
  if (abs === 0) digits = 2;
  else if (abs < 0.001) digits = 6;
  else if (abs < 0.1) digits = 5;
  else if (abs < 1) digits = 4;
  else if (abs < 10) digits = 3;
  else if (abs >= 1000) digits = Math.min(hint, 2);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return compact.format(value);
}

export function formatSigned(value: number, hint = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPrice(value, hint)}`;
}

export function formatTime(unixSec: number): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(unixSec: number): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
