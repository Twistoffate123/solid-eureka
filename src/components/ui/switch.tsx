import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-elevated transition-colors duration-[var(--motion-quick)] data-[state=checked]:bg-primary",
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-fg" />
    </SwitchPrimitive.Root>
  );
}
