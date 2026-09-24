"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CreditCard, Gavel, RadioTower, Wallet } from "lucide-react";
import { MONEY_ACTIONS } from "@cognivern/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RunsPage } from "@/components/runs/runs-page";
import { CapitalPage } from "@/components/capital/capital-page";
import { VerifiedCapitalPage } from "@/components/capital/verified-capital-page";
import { trackUxEvent } from "@/lib/ux-events";

type SpendView = "runs" | "attribution" | "verified";

const VIEWS: Array<{ value: SpendView; label: string }> = [
  { value: "runs", label: "Runs" },
  { value: "attribution", label: "Attribution" },
  { value: "verified", label: "Verified settlement" },
];

function isSpendView(value: string | null): value is SpendView {
  return value === "runs" || value === "attribution" || value === "verified";
}

/**
 * Spend & Outcomes — the attributable-spend stage of the vision loop, as one
 * surface with three views: executions (Runs), attribution (Capital), and
 * verified settlement (identity-gated capital). Deep links use ?view=;
 * /runs and /verified-capital redirect into the matching tab.
 */
export function CapitalOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: SpendView = isSpendView(viewParam) ? viewParam : "attribution";

  const onViewChange = (value: string) => {
    if (value === "attribution") {
      router.replace("/spend", { scroll: false });
    } else {
      router.replace(`/spend?view=${value}`, { scroll: false });
    }
  };

  useEffect(() => {
    trackUxEvent("money_action_discover", "spend_money_map");
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attributable spend"
        title="Spend & Outcomes"
        description="Fund an action, review what a mandate spent, what it produced, and whether the evidence supports another allocation."
      />

      <section aria-label="What you can fund" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {MONEY_ACTIONS.map((action) => {
          const Icon =
            action.id === "transfer"
              ? Wallet
              : action.id === "procurement"
                ? Gavel
                : action.id === "intelligence"
                  ? RadioTower
                  : CreditCard;
          return (
            <button
              key={action.id}
              type="button"
              title={`Receipt: ${action.receipt}`}
              onClick={() => {
                trackUxEvent("money_action_discover", "spend_money_map", action.id);
                router.push(action.href);
              }}
              className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{action.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {action.cost} · {action.settlement}
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <Tabs value={view} onValueChange={onViewChange} className="space-y-4">
        <TabsList className="h-auto w-full justify-start">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="runs" className="space-y-6">
          <RunsPage hideHeader />
        </TabsContent>

        <TabsContent value="attribution" className="space-y-6">
          <CapitalPage hideHeader />
        </TabsContent>

        <TabsContent value="verified" className="space-y-6">
          <VerifiedCapitalPage hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}
