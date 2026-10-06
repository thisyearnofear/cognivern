"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Shield } from "lucide-react";

/**
 * Sample sponsor report — the shape of what lands in an organiser's debrief.
 *
 * Every number below is HARDCODED fixture data, and every card carries a
 * Sample badge saying so. This page must never be mistaken for live data:
 * it answers "what would I get?" for strangers with zero signup. When a
 * real dogfood cohort exists, this route should render that program's
 * actual report behind the same layout instead of the fixture.
 */

const MODELS = [
  { model: "llama-3.3-70b", costUsd: 412.8, calls: 1184 },
  { model: "qwen-2.5-72b", costUsd: 238.4, calls: 862 },
  { model: "mistral-large", costUsd: 96.1, calls: 301 },
];

const TASK_CLASSES = [
  { taskClass: "code", costUsd: 301.5 },
  { taskClass: "debug", costUsd: 198.2 },
  { taskClass: "research", costUsd: 121.7 },
  { taskClass: "docs", costUsd: 74.3 },
  { taskClass: "other", costUsd: 51.6 },
];

function SampleBadge() {
  return (
    <span
      className="ml-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
      title="Illustrative numbers, not a real cohort. Connect your program for live data."
    >
      Sample data
    </span>
  );
}

export function SampleReport() {
  const maxModel = Math.max(...MODELS.map((m) => m.costUsd));
  const maxTask = Math.max(...TASK_CLASSES.map((t) => t.costUsd));
  const total = MODELS.reduce((s, m) => s + m.costUsd, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/sponsor" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to sponsor page
        </Link>
        <span className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-primary">Cognivern</span>
          <span className="text-muted-foreground">sample sponsor report</span>
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-center">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Sample data.</span>{" "}
            <span className="text-muted-foreground">
              Every number below is illustrative — the shape of what your sponsors would see.
              Your live report looks like this, with your cohort&apos;s real numbers.
            </span>
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Sample Hackathon Cohort
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              48 hackers · $20 each · $960 pool · <span className="font-medium text-foreground">${total.toFixed(2)}</span> spent
            </p>
          </div>
          <Link href="/sponsor" className="inline-flex h-9 items-center rounded-md bg-secondary px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
            Run this on my cohort
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-label="Sample spend by model" className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">Spend by model <SampleBadge /></p>
            <div className="mt-3 space-y-2">
              {MODELS.map((row) => (
                <div key={row.model}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{row.model}</span>
                    <span className="text-muted-foreground">${row.costUsd.toFixed(2)} · {row.calls} calls</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.costUsd / maxModel) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Sample spend by task class" className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">What the money did <SampleBadge /></p>
            <div className="mt-3 space-y-2">
              {TASK_CLASSES.map((row) => (
                <div key={row.taskClass}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{row.taskClass}</span>
                    <span className="text-muted-foreground">${row.costUsd.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.costUsd / maxTask) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Classified per call with model-reported confidence on live reports.
            </p>
          </section>
        </div>

        <section aria-label="Sample verifiable receipt" className="mt-6 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">The receipt you&apos;d share <SampleBadge /></p>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Shield size={16} className="text-primary" />
            <p className="font-mono text-[11px] text-muted-foreground">
              root 9f2c…e41a · anchored Oct 2026 · 48 balances committed
            </p>
            <Link href="/verify" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Try the live verifier <ArrowRight className="size-3" />
            </Link>
          </div>
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Your real receipt links to a checkable proof, not this placeholder — paste any
            participant receipt into the verifier to see the math.
          </p>
        </section>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">Like what the debrief could look like?</p>
          <div className="mt-3 flex justify-center">
            <Link
              href="/sponsor"
              className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open the sponsor console <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
