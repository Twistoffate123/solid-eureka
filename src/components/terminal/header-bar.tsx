import { Download, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallButton } from "@/components/terminal/install-button";
import { useTerminalStore } from "@/lib/store";

export function HeaderBar() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const theme = useTerminalStore((s) => s.theme);
  const setTheme = useTerminalStore((s) => s.setTheme);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
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
      <a
        href="/meridian-app.zip"
        download="meridian-app.zip"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-fg hover:opacity-90"
      >
        <Download className="size-4" />
        <span className="hidden sm:inline">Download zip</span>
      </a>
      <InstallButton />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  );
}
