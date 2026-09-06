import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-1 overflow-x-auto border-b border-border px-2", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative shrink-0 px-2.5 py-2 text-xs font-medium text-muted transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg data-[state=active]:text-fg",
        "after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-transparent data-[state=active]:after:bg-primary",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
