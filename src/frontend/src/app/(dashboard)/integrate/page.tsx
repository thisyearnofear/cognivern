import { Suspense } from "react";
import { IntegratePage } from "@/components/integrate/integrate-page";

export default function IntegrateRoute() {
  return (
    <Suspense>
      <IntegratePage />
    </Suspense>
  );
}
