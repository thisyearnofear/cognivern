import { LandingPage } from "@/components/landing/landing-page";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cognivern — AI Agent Governance",
  description:
    "Govern every agent transaction without slowing builders down. Policy checks in under 100ms, cryptographic audit evidence, multi-chain architecture.",
  openGraph: {
    title: "Cognivern — Agent Governance Platform",
    description:
      "Checks every spend against your policy, holds risky moves for review, and gives you cryptographic audit evidence.",
    siteName: "Cognivern",
  },
};

export default function Home() {
  return <LandingPage />;
}
