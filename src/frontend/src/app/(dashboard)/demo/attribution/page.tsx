"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDemoStore } from "@/stores/demo-store";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

/**
 * Guest-visible version of Spend & Outcomes: a seeded mandate walks the
 * vision loop (fund → act → spend → outcome → next allocation) without
 * requiring a wallet. Static sample data, out-lined as such — the same
 * honesty rule as the spend-flow demo. The real thing lives behind
 * /spend (auth-gated attribution ledger).
 */

const DEMO_MANDATE = {
  name: "Acquire qualified customers",
  objective:
    "Generate qualified B2B meetings for the enterprise sales team via governed agent outreach, enrichment, and content spend.",
  status: "active" as const,
  allocated: 10000,
  spent: 6850,
  currency: "USDC",
  updatedAt: "2026-08-20T14:30:00Z",
  agents: ["outbound-prospector", "content-engine", "lead-scorer"],
};

const DEMO_SPENDS = [
  {
    id: "spend-001",
    agent: "outbound-prospector",
    purpose: "B2B contact enrichment — Q3 batch",
    amount: 1200,
    date: "2026-08-02",
    status: "consumed" as const,
  },
  {
    id: "spend-002",
    agent: "content-engine",
    purpose: "SEO research + briefs (12 topics)",
    amount: 1800,
    date: "2026-08-05",
    status: "consumed" as const,
  },
  {
    id: "spend-003",
    agent: "outbound-prospector",
    purpose: "LinkedIn outreach campaign — wave 1",
    amount: 950,
    date: "2026-08-09",
    status: "held" as const,
  },
  {
    id: "spend-004",
    agent: "lead-scorer",
    purpose: "AI lead scoring inference",
    amount: 300,
    date: "2026-08-12",
    status: "consumed" as const,
  },
  {
    id: "spend-005",
    agent: "content-engine",
    purpose: "Case-study production (2 pieces)",
    amount: 2400,
    date: "2026-08-15",
    status: "consumed" as const,
  },
];

const DEMO_OUTCOMES = [
  {
    id: "outcome-001",
    label: "Qualified meetings booked",
    value: 14,
    unit: "meetings",
    source: "CRM import (verified)",
    confidence: "independently_verified" as const,
  },
  {
    id: "outcome-002",
    label: "SQLs from outreach wave 1",
    value: 11,
    unit: "SQLs",
    source: "CRM import (verified)",
    confidence: "independently_verified" as const,
  },
  {
    id: "outcome-003",
    label: "Pipeline influence from content",
    value: 62000,
    unit: "USD",
    source: "Attribution model (observed)",
    confidence: "observed" as const,
  },
];

const DEMO_RECOMMENDATION = {
  stance: "consider_next_allocation" as const,
  evidenceCompleteness: 82,
  costPerOutcome: 489, // USDC per verified meeting
  budgetPull: 1500,
  reasons: [
    "14 verified meetings from $6,850 of governed spend is within the target cost-per-outcome band.",
    "71% of spend is receipt-backed and attributed; 3 spends are still unverified.",
    "Outcome #3 (pipeline influence) is observed, not independently verified — treat as directional.",
    "Hold $1,500 in reserve until 100% of spend is receipt-backed, then release for the next tranche.",
  ],
};

const DEMO_EVIDENCE_STAGES = ["Mandate", "Action", "Spend", "Outcome", "Next allocation"];

export default function DemoAttributionPage() {
  const router = useRouter();
  const { demoMode } = useDemoStore();
  const [showRecommendation, setShowRecommendation] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Funded mandate demo
            </h1>
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5">
              <Sparkles className="h-3 w-3 mr-1" /> Sample data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The full loop behind autonomous-agent capital — no wallet required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!demoMode && (
            <Button variant="outline" size="sm" onClick={() => router.push("/signup")}>
              Set up your own workspace
            </Button>
          )}
          <Button size="sm" onClick={() => router.push("/spend")}>
            Open live ledger <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Loop strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs">
        {DEMO_EVIDENCE_STAGES.map((stage, i) => (
          <span key={stage} className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground uppercase tracking-widest">{stage}</span>
            {i < DEMO_EVIDENCE_STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-primary/50" />}
          </span>
        ))}
      </div>

      {/* Mandate card */}
      <section className="rounded-xl border border-border bg-card p-5" aria-label="Demo mandate">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-lg">{DEMO_MANDATE.name}</h2>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{DEMO_MANDATE.objective}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Updated {new Date(DEMO_MANDATE.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-4">
          {[
            ["Allocated", `$${DEMO_MANDATE.allocated.toLocaleString()}`],
            ["Spent", `$${DEMO_MANDATE.spent.toLocaleString()}`],
            ["Remaining", `$${(DEMO_MANDATE.allocated - DEMO_MANDATE.spent).toLocaleString()}`],
            ["Identities", String(DEMO_MANDATE.agents.length)],
          ].map(([label, value]) => (
            <div key={label} className="bg-muted/40 p-3">
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Budget position</span>
            <span>{Math.round((DEMO_MANDATE.spent / DEMO_MANDATE.allocated) * 100)}% consumed</span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${(DEMO_MANDATE.spent / DEMO_MANDATE.allocated) * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* Gov spend list */}
      <section className="rounded-xl border border-border bg-card p-5" aria-label="Demo governed spend">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Governed spend</h2>
          <Badge variant="outline">{DEMO_SPENDS.length} records</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Every record has an approval decision, an attribution link to this mandate, and evidence where available.
        </p>
        <div className="mt-4 divide-y">
          {DEMO_SPENDS.map((spend) => (
            <div key={spend.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{spend.purpose}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {spend.agent} · {new Date(spend.date).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={spend.status === "consumed" ? "secondary" : "outline"}>{spend.status}</Badge>
                <span className="font-mono text-sm">${spend.amount.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Outcomes */}
      <section className="rounded-xl border border-border bg-card p-5" aria-label="Demo outcomes">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold">Recorded outcomes</h2>
          <Badge variant="outline">{DEMO_OUTCOMES.length}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Results linked to this mandate. Independently verified rows are bankable evidence; observed rows are directional.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DEMO_OUTCOMES.map((outcome) => (
            <div key={outcome.id} className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {outcome.source}
              </div>
              <div className="mt-2 text-2xl font-bold">
                {outcome.value.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{outcome.unit}</span>
              </div>
              <div className="mt-1 text-sm font-medium">{outcome.label}</div>
              <div className="mt-2">
                <Badge variant={outcome.confidence === "independently_verified" ? "secondary" : "outline"}>
                  {outcome.confidence === "independently_verified" ? "Verified external state" : "Observed"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Synthesis line — the vision made visible */}
      <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5" aria-label="Demo synthesis">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">What this means</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This mandate spent <strong className="text-foreground">$6,850</strong> across{" "}
                <strong className="text-foreground">{DEMO_SPENDS.length} governed records</strong> to produce{" "}
                <strong className="text-foreground">14 verified meetings</strong> and{" "}
                <strong className="text-foreground">$62,000 observed pipeline</strong>. Cost per verified
                meeting ≈ <strong className="text-foreground">$489</strong>.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowRecommendation((v) => !v)}>
            {showRecommendation ? "Hide recommendation" : "Show next-allocation recommendation"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showRecommendation && (
          <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Next allocation review</span>
              <Badge className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                Consider next allocation
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Evidence completeness", `${DEMO_RECOMMENDATION.evidenceCompleteness}%`],
                ["Cost per verified outcome", `$${DEMO_RECOMMENDATION.costPerOutcome}`],
                ["Budget pull (next tranche)", `$${DEMO_RECOMMENDATION.budgetPull.toLocaleString()}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/40 p-3">
                  <div className="text-lg font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {DEMO_RECOMMENDATION.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Advisory only — nothing executes automatically. New spend still goes through the governance boundary.
            </p>
          </div>
        )}
      </section>

      {/* Bridge to the real product */}
      <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">This is what the live ledger powers</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Sign in to create mandates, watch governed spend, and publish review snapshots your team can verify.
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => router.push("/signup")}>
            Create your first mandate <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </section>
    </div>
  );
}