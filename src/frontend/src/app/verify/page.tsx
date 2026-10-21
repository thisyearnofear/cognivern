import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/verify/verify-client";

export const metadata: Metadata = {
  title: "Public verification — Cognivern",
  description:
    "Public, login-free verification of anchored credit commitments and sealed-bid auction rounds.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; round?: string }>;
}) {
  const { id, round } = await searchParams;
  return (
    <Suspense>
      <VerifyClient
        initialId={id ?? ""}
        initialRoundId={round ?? ""}
        initialMode={round ? "auction" : "credit"}
      />
    </Suspense>
  );
}
