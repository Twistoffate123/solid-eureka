import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return null;

  return (
    <div className="relative">
      <Tooltip content="Install as an app">
        <Button
          size="sm"
          variant="outline"
          aria-label="Install as an app"
          onClick={async () => {
            if (isIos()) {
              window.location.assign("/?install=1&platform=ios");
              return;
            }
            if (deferred) {
              await deferred.prompt();
              setDeferred(null);
              return;
            }
            setHint((v) => !v);
          }}
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Install</span>
        </Button>
      </Tooltip>
      {hint ? (
        <div className="absolute right-0 top-10 z-40 w-64 rounded-lg border border-border bg-elevated p-3 text-xs leading-relaxed text-muted shadow-[var(--elev-shadow)]">
          Use your browser menu: <span className="text-fg">Install app</span> or{" "}
          <span className="text-fg">Add to Home Screen</span>. After you publish, this
          opens as its own window on phone and desktop.
        </div>
      ) : null}
    </div>
  );
}
