import { Suspense } from "react";
import { ProgramsPage } from "@/components/programs/programs-page";

export default function Page() {
  return (
    <Suspense>
      <ProgramsPage />
    </Suspense>
  );
}
