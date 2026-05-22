"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";

export function DemoBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const preferences = useAppStore((s) => s.preferences);

  if (!preferences.demoExplored || preferences.onboardingCompleted || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 px-6 py-2.5 max-h-14 overflow-hidden bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm shadow-md flex-shrink-0 max-sm:flex-col max-sm:max-h-none max-sm:py-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles size={16} aria-hidden />
        <span className="font-semibold">Demo mode</span>
        <span className="opacity-90 truncate">
          — Connect your treasury to protect your own agents.
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push("/onboarding")}
          className="bg-white text-blue-700 hover:bg-neutral-100"
        >
          Protect my agents
          <ArrowRight size={14} />
        </Button>
        <button
          type="button"
          aria-label="Dismiss demo banner"
          onClick={() => setDismissed(true)}
          className="bg-transparent border-none text-white cursor-pointer px-1 rounded-md flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity text-xs"
        >
          Keep exploring
        </button>
      </div>
    </div>
  );
}
