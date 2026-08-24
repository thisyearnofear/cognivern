import { Suspense } from "react";
import { CapitalOverview } from "@/components/capital/capital-overview";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <CapitalOverview />
    </Suspense>
  );
}
