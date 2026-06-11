"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Zap } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const workspace = useAuthStore((s) => s.workspace);
  const demoMode = useDemoStore((s) => s.demoMode);

  if (workspace?.tier === "live") {
    return (
      <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 flex-shrink-0">
        <Zap className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Live Workspace
        </span>
        <span className="text-xs text-muted-foreground">
          Connected to backend API
        </span>
      </div>
    );
  }

  if (!demoMode) {
    return null;
  }

  if (dismissed) {
    return (
      <div className="flex items-center gap-2 px-6 py-1 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/50 flex-shrink-0">
        <Zap className="h-3 w-3 text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Demo Workspace
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        role="status"
        className="flex items-center justify-between gap-4 px-6 py-2.5 max-h-14 overflow-hidden bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm shadow-md flex-shrink-0 max-sm:flex-col max-sm:max-h-none max-sm:py-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={16} aria-hidden />
          <span className="font-semibold">Demo workspace</span>
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
          <button
            type="button"
            aria-label="Dismiss demo banner"
            onClick={() => setDismissed(true)}
            className="bg-transparent border-none text-white cursor-pointer px-1 rounded-md flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity text-xs"
          >
            Continue exploring
          </button>
        </div>
      </div>
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
