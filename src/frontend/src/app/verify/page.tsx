import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/verify/verify-client";

export const metadata: Metadata = {
  title: "Public verification — Cognivern",
  description:
    "Public, login-free verification of anchored credit commitments, sealed-bid auction rounds, and supplier-diligence reports.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; round?: string; report?: string }>;
}) {
  const { id, round, report } = await searchParams;
  return (
    <Suspense>
      <VerifyClient
        initialId={id ?? ""}
        initialRoundId={round ?? ""}
        initialReportId={report ?? ""}
        initialMode={report ? "diligence" : round ? "auction" : "credit"}
      />
    </Suspense>
  );
}
