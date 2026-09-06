import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70 data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4 shadow-[var(--elev-shadow)] outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
      >
        {title ? (
          <DialogPrimitive.Title className="mb-3 text-sm font-medium text-fg">
            {title}
          </DialogPrimitive.Title>
        ) : (
          <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-elevated hover:text-fg">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
