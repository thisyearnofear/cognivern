import { Suspense } from "react";
import { GovernanceCheck } from "@/components/governance/governance-check";

export default function GovernancePlaygroundPage() {
  return (
    <Suspense>
      <GovernanceCheck />
    </Suspense>
  );
}
