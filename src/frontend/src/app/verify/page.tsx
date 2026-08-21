import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/verify/verify-client";

export const metadata: Metadata = {
  title: "Verify a credit commitment — Cognivern",
  description:
    "Public, login-free verification of anchored sponsored-inference ledger commitments.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <Suspense>
      <VerifyClient initialId={id ?? ""} />
    </Suspense>
  );
}
