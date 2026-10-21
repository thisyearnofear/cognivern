import type { Metadata } from "next";
import { ProcureLanding } from "@/components/landing/procure-landing";

export const metadata: Metadata = {
  title: "Confidential procurement for agents — Cognivern",
  description:
    "Fund a mandate, let agents run a sealed-bid round, and settle the winner atomically on a Canton ledger. Every outcome comes with a public proof link.",
};

export default function ProcurePage() {
  return <ProcureLanding />;
}
