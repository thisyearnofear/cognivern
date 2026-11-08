import { Suspense } from "react";
import { InboxPage } from "@/components/inbox/inbox-page";

export default function Page() {
  return (
    <Suspense>
      <InboxPage />
    </Suspense>
  );
}
