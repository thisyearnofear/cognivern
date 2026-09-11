import { Suspense } from "react";
import { PoliciesPage } from "@/components/policies/policies-page";

export default function Page() {
  return (
    <Suspense>
      <PoliciesPage />
    </Suspense>
  );
}
