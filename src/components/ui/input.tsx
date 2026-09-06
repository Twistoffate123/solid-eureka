import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle outline-none transition-[box-shadow,border-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
      {...props}
    />
  );
}
