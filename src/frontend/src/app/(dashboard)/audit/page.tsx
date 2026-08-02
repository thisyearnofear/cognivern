import { Suspense } from "react";
import { AuditPage } from "@/components/audit/audit-page";

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
