import type { Metadata } from "next";
import { SampleReport } from "@/components/landing/sample-report";

export const metadata: Metadata = {
  title: "Sample sponsor report — Cognivern",
  description:
    "What a cohort spend report looks like: spend by model, task split, and a verifiable receipt. Clearly labeled sample data — no signup.",
};

export default function SponsorSamplePage() {
  return <SampleReport />;
}
