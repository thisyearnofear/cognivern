"use client";

import { useCallback, useState } from "react";
import { Sparkles, ArrowRight, Zap, FlaskConical } from "lucide-react";
import { mutate } from "swr";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";

/**
 * Three modes the banner needs to communicate, in order of priority:
 *
 *   1. Unauthenticated landing-page demo tour (`useDemoStore.demoMode`):
 *      gradient banner urging sign-in. Shown until dismissed.
 *
 *   2. Signed-in but sandbox workspace mode (`workspaceMode === "sandbox"`):
 *      this is the case the user flagged ("first login, populated dashboard,
 *      what is this?"). Without this banner the user couldn't tell that the
 *      demoInterceptor was swapping every API response for seed data. Amber
 *      bar with a one-click "Switch to Production" that flips workspaceMode
 *      AND nukes the SWR cache so the dashboard immediately refetches with
 *      the user's real (empty) workspace data.
 *
 *   3. Signed-in production mode: emerald confirmation bar so the user
 *      knows the dashboard is showing their actual workspace.
 */
export function DemoBanner() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const isConnected = useAuthStore((s) => s.isConnected);
  const workspaceMode = useAuthStore((s) => s.workspaceMode);
  const setWorkspaceMode = useAuthStore((s) => s.setWorkspaceMode);
  const demoMode = useDemoStore((s) => s.demoMode);

  // Flip mode + nuke the SWR cache so every fetch re-runs against the new
  // X-Workspace-Mode header. Without the revalidate the dashboard would keep
  // showing the old sandbox data until you hard-refreshed.
  const switchToProduction = useCallback(async () => {
    setSwitching(true);
    setWorkspaceMode("production");
    await mutate(() => true, undefined, { revalidate: true });
    toast.success("Switched to Production mode", {
      description:
        "Your real workspace is empty until you create an agent and policy. Want to start now?",
      action: {
        label: "Create an agent",
        onClick: () => {
          if (typeof window !== "undefined") {
            window.location.href = "/agents/workshop";
          }
        },
      },
    });
    setSwitching(false);
  }, [setWorkspaceMode]);

  const switchToSandbox = useCallback(async () => {
    setSwitching(true);
    setWorkspaceMode("sandbox");
    await mutate(() => true, undefined, { revalidate: true });
    setSwitching(false);
  }, [setWorkspaceMode]);

  // 1. Unauthenticated landing-page demo tour. Keep the existing gradient.
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

  // 2. Signed-in sandbox mode. The case the user flagged: populated
  //    dashboard with no signal that the data is fake.
  if (isConnected && workspaceMode === "sandbox") {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs flex-shrink-0 max-sm:flex-col max-sm:items-start"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-semibold">Sandbox mode</span>
          <span className="opacity-90 truncate">
            — Everything below is demo data. Nothing you do here persists or
            moves real funds.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={switching}
          onClick={switchToProduction}
          className="border-amber-300 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 h-7"
        >
          {switching ? "Switching…" : "Switch to Production"}
          <ArrowRight size={12} />
        </Button>
      </div>
    );
  }

  // 3. Signed-in production mode. Confirmation bar so the user knows the
  //    dashboard is showing their real workspace (and can flip back if they
  //    want to compare with sandbox).
  if (isConnected && workspaceMode === "production") {
    return (
      <div className="flex items-center gap-2 px-6 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 text-xs flex-shrink-0">
        <Zap className="h-3 w-3 text-emerald-500" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          Production
        </span>
        <span className="text-muted-foreground">— your real workspace</span>
        <button
          type="button"
          onClick={switchToSandbox}
          disabled={switching}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {switching ? "Switching…" : "Back to Sandbox"}
        </button>
      </div>
    );
  }

  return null;
}
