"use client";

import { FlaskConical, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceMode, type WorkspaceMode } from "@/hooks/use-workspace-mode";

const OPTIONS: Array<{
  value: WorkspaceMode;
  label: string;
  icon: typeof FlaskConical;
}> = [
  { value: "sandbox", label: "Sandbox", icon: FlaskConical },
  { value: "production", label: "Production", icon: Zap },
];

/**
 * Persistent Sandbox ⇄ Production control for the sidebar.
 *
 * Previously the only prominent way out of sandbox was the amber dashboard
 * banner, and dismissing it ("Keep exploring demo") set the sticky
 * `hasExitedSandbox` flag — which permanently replaced the banner with a slim
 * bar whose only exit was a 10px muted "Exit demo" link. Users who dismissed
 * once had no discoverable way to reach production. This control is always
 * visible, cannot be dismissed, and routes through `useWorkspaceMode` so the
 * tier, the request header and the demo store always move together.
 */
export function ModeSwitch({ className }: { className?: string }) {
  const { mode, switching, switchMode, isConnected } = useWorkspaceMode();

  if (!isConnected) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="group"
        aria-label="Workspace mode"
        className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/60 border border-border/60"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mode === value;
          const busy = switching === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              disabled={switching !== null}
              onClick={() => switchMode(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                active
                  ? value === "production"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "bg-background text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Icon className="h-3.5 w-3.5" aria-hidden />
              )}
              {label}
            </button>
          );
        })}
      </div>
      <p
        className="text-[10px] leading-tight text-muted-foreground px-1"
        aria-live="polite"
      >
        {mode === "production"
          ? "Your real workspace — governed actions can move real funds."
          : "Sample data — nothing persists and no funds can move."}
      </p>
    </div>
  );
}
