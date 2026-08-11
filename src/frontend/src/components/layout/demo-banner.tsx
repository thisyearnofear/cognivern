"use client";

import { useCallback, useState } from "react";
import { Sparkles, ArrowRight, Zap, FlaskConical } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";

/**
 * Status bar above the dashboard content. It reports which mode you're in and
 * offers a switch; it is no longer the *only* switch — `ModeSwitch` in the
 * sidebar is always visible. All mode changes go through `useWorkspaceMode`
 * so the workspace tier, the `X-Workspace-Mode` header and the demo store
 * stay in sync (they didn't before, which is why "switched to production"
 * could still show sample data).
 *
 * Three states, in priority order:
 *   1. Unauthenticated demo tour (`useDemoStore.demoMode`) — gradient banner
 *      urging sign-in.
 *   2. Signed-in sandbox — amber bar. Full orientation copy on the first
 *      visit, slim bar once `hasExitedSandbox` is set.
 *   3. Signed-in production — emerald confirmation bar.
 */
export function DemoBanner() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isConnected = useAuthStore((s) => s.isConnected);
  const hasExitedSandbox = useAuthStore((s) => s.hasExitedSandbox);
  const setHasExitedSandbox = useAuthStore((s) => s.setHasExitedSandbox);
  const demoMode = useDemoStore((s) => s.demoMode);
  const { mode, switching, switchMode } = useWorkspaceMode();

  const switchingLabel = switching !== null;

  /** Dismiss without switching modes. The sidebar ModeSwitch remains, so
   *  this only hides the orientation copy — it no longer buries the switch. */
  const dismissOrientation = useCallback(() => {
    setHasExitedSandbox(true);
  }, [setHasExitedSandbox]);

  // 1. Unauthenticated landing-page demo tour.
  if (demoMode && !isConnected) {
    return (
      <>
        <div
          role="status"
          className="flex items-center justify-between gap-4 px-6 py-2.5 max-h-14 overflow-hidden bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm shadow-md flex-shrink-0 max-sm:flex-col max-sm:max-h-none max-sm:py-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} aria-hidden />
            <span className="font-semibold">Demo tour</span>
            <span className="opacity-90 truncate">
              — Explore agent governance with sample data
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="bg-white text-blue-700 hover:bg-neutral-100"
            >
              Sign In for Real Data
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // 2a. New-user sandbox orientation.
  if (isConnected && mode === "sandbox" && !hasExitedSandbox) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 px-6 py-3.5 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border-b-2 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex-shrink-0 max-sm:flex-col max-sm:items-start"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-700 dark:text-amber-300 shrink-0">
            <FlaskConical className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm">You&apos;re in Sandbox Mode</div>
            <div className="text-xs opacity-90 truncate">
              Safe sample workspace — nothing persists and no real funds can
              move. Switch any time from the sidebar.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="default"
            size="sm"
            disabled={switchingLabel}
            onClick={() => switchMode("production")}
            className="bg-amber-600 hover:bg-amber-700 text-white border-0 h-8"
          >
            {switching === "production" ? "Switching…" : "Switch to Production"}
            <ArrowRight size={14} />
          </Button>
          <button
            type="button"
            onClick={dismissOrientation}
            aria-label="Got it — keep exploring"
            className="text-amber-700/70 dark:text-amber-300/70 hover:text-amber-800 dark:hover:text-amber-200 text-xs underline-offset-2 hover:underline px-2"
          >
            Keep exploring demo
          </button>
        </div>
      </div>
    );
  }

  // 2b. Returning sandbox visit. Slim bar, but the switch stays a real
  //     button — it used to shrink to a 10px muted "Exit demo" link, which is
  //     what made production feel unreachable after one dismissal.
  if (isConnected && mode === "sandbox" && hasExitedSandbox) {
    return (
      <div className="flex items-center gap-2 px-6 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs flex-shrink-0">
        <FlaskConical className="h-3 w-3 text-amber-500" />
        <span className="font-medium text-amber-700 dark:text-amber-300">
          Sandbox
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          — sample data, no real funds
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => switchMode("production")}
          disabled={switchingLabel}
          className="ml-auto h-6 px-2 text-[11px] gap-1"
        >
          {switching === "production" ? "Switching…" : "Switch to Production"}
          <ArrowRight size={12} />
        </Button>
      </div>
    );
  }

  // 3. Signed-in production mode.
  if (isConnected && mode === "production") {
    return (
      <div className="flex items-center gap-2 px-6 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 text-xs flex-shrink-0">
        <Zap className="h-3 w-3 text-emerald-500" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          Production
        </span>
        <span className="text-muted-foreground">
          — real workspace; actions may move funds
        </span>
        <button
          type="button"
          onClick={() => switchMode("sandbox")}
          disabled={switchingLabel}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {switching === "sandbox" ? "Switching…" : "Back to Sandbox"}
        </button>
      </div>
    );
  }

  return null;
}
