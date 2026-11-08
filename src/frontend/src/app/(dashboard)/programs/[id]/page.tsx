import { Suspense } from "react";
import { ProgramDetail } from "@/components/programs/program-detail";

export default function Page() {
  return (
    <Suspense>
      <ProgramDetail />
    </Suspense>
  );
}
