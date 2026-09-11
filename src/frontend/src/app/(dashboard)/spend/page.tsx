import { Suspense } from "react";
import { CapitalOverview } from "@/components/capital/capital-overview";

// Client-rendered under <Suspense> (useSearchParams for ?view= deep links);
// prerender the shell to CDN, hydrate the view client-side.

export default function Page() {
  return (
    <Suspense>
      <CapitalOverview />
    </Suspense>
  );
}
