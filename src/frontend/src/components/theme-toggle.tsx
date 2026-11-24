"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * One-tap light/dark switch for public surfaces (landing, /verify). The
 * three-way light/dark/system picker lives in Settings → Appearance; on
 * public pages a binary flip to the other explicit theme is enough.
 * next-themes persists the choice, so it follows the visitor into the app.
 * Renders a same-size placeholder until mounted to avoid a hydration flip.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // false on SSR/hydration, true from the first client commit — same
  // mounted-gate pattern as os-shell.tsx, so both passes render one tree.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <span className={`inline-flex h-8 w-8 ${className}`} aria-hidden />;
  }
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
