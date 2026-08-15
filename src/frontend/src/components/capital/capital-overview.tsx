"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RunsPage } from "@/components/runs/runs-page";
import { CapitalPage } from "@/components/capital/capital-page";
import { VerifiedCapitalPage } from "@/components/capital/verified-capital-page";

type SpendView = "runs" | "attribution" | "verified";

const VIEWS: Array<{ value: SpendView; label: string }> = [
  { value: "runs", label: "Runs" },
  { value: "attribution", label: "Attribution" },
  { value: "verified", label: "Verified rail" },
];

function isSpendView(value: string | null): value is SpendView {
  return value === "runs" || value === "attribution" || value === "verified";
}

/**
 * Spend & Outcomes — the attributable-spend stage of the vision loop, as one
 * surface with three views: executions (Runs), attribution (Capital), and the
 * Cleanverse verified rail. Deep links use ?view=; /runs and /verified-capital
 * redirect into the matching tab.
 */
export function CapitalOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: SpendView = isSpendView(viewParam) ? viewParam : "attribution";

  const onViewChange = (value: string) => {
    if (value === "attribution") {
      router.replace("/capital", { scroll: false });
    } else {
      router.replace(`/capital?view=${value}`, { scroll: false });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spend & Outcomes"
        description="Runs, attribution, and verified spend — the money moving through governance, in one place."
      />

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
