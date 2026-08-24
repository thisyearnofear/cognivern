import type { Metadata } from "next";
import { SponsorLanding } from "@/components/landing/sponsor-landing";

export const metadata: Metadata = {
  title: "Sponsor a cohort at cost — Cognivern",
  description:
    "Hand out inference budgets for your hackathon or workshop at 0% throughput fees. Metered at provider cost, reconcilable any time, with receipts anyone can verify.",
};

export default function SponsorPage() {
  return <SponsorLanding />;
}
