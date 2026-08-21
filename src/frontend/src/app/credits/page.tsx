import type { Metadata } from "next";
import { CreditsClient } from "@/components/credits-self-serve/credits-client";

export const metadata: Metadata = {
  title: "Check your sponsored credits — Cognivern",
  description:
    "Participant self-service for sponsored inference credits: balance, disclosure, and verifiable receipts. No account needed.",
};

export default function CreditsPage() {
  return <CreditsClient />;
}
