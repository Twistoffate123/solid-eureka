import { Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallButton } from "@/components/terminal/install-button";
import { useTerminalStore } from "@/lib/store";

export function HeaderBar() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const theme = useTerminalStore((s) => s.theme);
  const setTheme = useTerminalStore((s) => s.setTheme);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-3">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" className="size-7 rounded-md" />
          <div className="leading-tight">
            <p className="text-sm font-medium tracking-tight text-fg">Meridian</p>
            <p className="hidden text-[0.6875rem] text-subtle sm:block">Global market terminal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-left text-sm text-muted hover:border-border-strong"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Search any exchange</span>
          <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-[0.6875rem] text-subtle sm:inline">
            /
          </kbd>
        </button>
        <InstallButton />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
