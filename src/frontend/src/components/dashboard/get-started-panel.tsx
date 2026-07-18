"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { Users, ShieldCheck, ArrowRight, PlayCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { QuickCheck } from "@/components/dashboard/quick-check";

/**
 * "Pick up where you left off" panel for the dashboard. Shown when a
 * signed-in user in production mode has no audit logs yet — i.e. they
 * haven't run any governance checks. With backend seeding, every new
 * workspace starts with 1 agent + 1 policy, so this panel gives them
 * an immediate "aha moment" via the QuickCheck card.
 *
 * The two CTAs below let them customize or add to the seeded defaults.
 * Once they run a governance check, audit logs appear and this panel
 * disappears — the dashboard's metric cards take over.
 */
export function GetStartedPanel() {
  const router = useRouter();
  const setWorkspaceMode = useAuthStore((s) => s.setWorkspaceMode);
  const setHasExitedSandbox = useAuthStore((s) => s.setHasExitedSandbox);

  const peekSandbox = useCallback(async () => {
    setWorkspaceMode("sandbox");
    setHasExitedSandbox(true);
    await mutate(() => true, undefined, { revalidate: true });
  }, [setWorkspaceMode, setHasExitedSandbox]);

  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <div>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Your workspace is ready — try it now
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            We&apos;ve set you up with a default agent and a moderate spend policy.
            Fire a governance check below to see how it works, then customize
            your setup.
          </p>
        </div>

        {/* Quick win: try a governance check right now */}
        <div className="text-left">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">
              Try it now — no setup needed
            </span>
          </div>
          <QuickCheck />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <button
            type="button"
            onClick={() => router.push("/agents/workshop")}
            className="rounded-xl border bg-background hover:border-primary/50 hover:bg-primary/5 p-4 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950 shrink-0">
                <Users className="h-5 w-5 text-sky-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-1">
                  Add another agent
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a governed identity for a trading bot, yield script, or
                  any system that spends money on your behalf.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/policies")}
            className="rounded-xl border bg-background hover:border-primary/50 hover:bg-primary/5 p-4 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 shrink-0">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-1">
                  Customize your policy
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adjust spend limits, add vendor allowlists, set approval
                  thresholds. Your default policy is a starting point.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="pt-2 border-t flex items-center justify-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>Want to see what a busy dashboard looks like first?</span>
          <Button
            variant="outline"
            size="sm"
            onClick={peekSandbox}
            className="h-7 gap-1.5"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Peek at sandbox demo
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Slim banner for partial empty states. Shown above the metric cards when
 * the workspace has one of agents/policies but not the other. Less alarming
 * than the full GetStartedPanel because the dashboard is still legible.
 */
export function PartialGetStartedBanner({
  missing,
  presentName,
}: {
  missing: "agent" | "policy";
  presentName: string;
}) {
  const router = useRouter();
  const target =
    missing === "agent" ? "/agents/workshop" : "/policies";
  const label =
    missing === "agent"
      ? `You have ${presentName} but no agent yet — create one to start governing spends.`
      : `You have ${presentName} but no policy yet — pick a template so spends get evaluated.`;
  const cta = missing === "agent" ? "Create an agent" : "Create a policy";

  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-3 flex items-center gap-3 flex-wrap">
      <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0" />
      <span className="text-xs text-muted-foreground flex-1 min-w-0">
        {label}
      </span>
      <Button size="sm" onClick={() => router.push(target)} className="h-7">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
