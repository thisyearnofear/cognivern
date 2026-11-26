"use client";

import { useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { AuthModal } from "@/components/auth/auth-modal";

/**
 * AmbientModeChrome — the single chrome surface that frames which mode the
 * workspace is in (docs/VISUAL_MOTION_UX_PLAN.md, Primitive 7).
 *
 *   - Demo / Sandbox: a 2px amber top hairline across the viewport plus one
 *     slim 36px amber-tinted bar (icon + label + 3-word cue + one action).
 *   - Production: only a quiet 2px emerald hairline — mode switching lives in
 *     the sidebar `ModeSwitch`.
 *
 * All mode changes still go through `useWorkspaceMode` so the workspace tier,
 * the `X-Workspace-Mode` header and the demo store stay in sync. This is a
 * visual consolidation only — detection logic is unchanged.
 */
export function DemoBanner() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isConnected = useAuthStore((s) => s.isConnected);
  const demoMode = useDemoStore((s) => s.demoMode);
  const { mode, switching, switchMode } = useWorkspaceMode();

  const switchingLabel = switching !== null;

  const openTour = () => {
    document.dispatchEvent(new CustomEvent("cognivern-open-tour"));
  };

  const tourButton = (
    <button
      type="button"
      onClick={openTour}
      className="text-[11px] text-amber-700/80 dark:text-amber-300/80 hover:text-amber-800 dark:hover:text-amber-200 underline-offset-2 hover:underline px-1"
    >
      Interactive tour
    </button>
  );

  // 1. Unauthenticated landing-page demo tour.
  if (demoMode && !isConnected) {
    return (
      <>
        <div role="status" className="flex-shrink-0">
          <div className="h-0.5 w-full bg-amber-500/80" aria-hidden />
          <div className="flex h-9 items-center gap-2 px-4 sm:px-6 bg-amber-50 dark:bg-amber-950/30 text-xs">
            <FlaskConical className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Demo tour
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              Sample data only
            </span>
            <span className="ml-auto flex items-center gap-2">
              {tourButton}
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Sign in for real data
                <ArrowRight size={11} aria-hidden />
              </button>
            </span>
          </div>
        </div>
        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // 2. Signed-in sandbox.
  if (isConnected && mode === "sandbox") {
    return (
      <div role="status" className="flex-shrink-0">
        <div className="h-0.5 w-full bg-amber-500/80" aria-hidden />
        <div className="flex h-9 items-center gap-2 px-4 sm:px-6 bg-amber-50 dark:bg-amber-950/30 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-amber-500" aria-hidden />
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            Sandbox
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            Sample data only
          </span>
          <span className="ml-auto flex items-center gap-2">
            {tourButton}
            <button
              type="button"
              onClick={() => switchMode("production")}
              disabled={switchingLabel}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-800 px-2 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
            >
              {switching === "production" ? "Switching…" : "Switch to Production"}
              <ArrowRight size={11} aria-hidden />
            </button>
          </span>
        </div>
      </div>
    );
  }

  // 3. Signed-in production — quiet hairline only; the sidebar ModeSwitch
  //    owns switching back.
  if (isConnected && mode === "production") {
    return (
      <div
        className="h-0.5 w-full flex-shrink-0 bg-gradient-to-r from-emerald-500/70 to-sky-500/70"
        aria-hidden
      />
    );
  }

  // Unauthenticated, no demo tour — no mode chrome at all.
  return null;
}
