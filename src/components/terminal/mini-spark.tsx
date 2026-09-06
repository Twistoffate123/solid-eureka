import { cn } from "@/lib/utils";

export function MiniSpark({
  values,
  up,
  className,
}: {
  values: number[];
  up: boolean;
  className?: string;
}) {
  if (values.length < 2) return <span className="inline-block h-6 w-16" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 64;
  const h = 22;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn("shrink-0", up ? "text-up" : "text-down", className)}
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
