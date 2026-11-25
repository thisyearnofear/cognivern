"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTelegraphStatus,
  useTelegraphCategories,
  useTelegraphQuestions,
  useTelegraphStats,
  useTelegraphLedger,
} from "@/hooks/use-api";
import type { TelegraphLedgerReport } from "@/lib/api-client";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Database,
  Gauge,
  Network,
  ArrowUpRight,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  DollarSign,
  Layers,
} from "lucide-react";

/**
 * Telegraph signals page.
 *
 * Surfaces the Telegraph Protocol integration status plus the daemon signal
 * feed (categories and questions). Everything is honest about provenance:
 * the status card reflects the real backend env, and when the integration is
 * disabled the page says so instead of pretending data is flowing. The
 * categories/questions sections only render when the integration is enabled
 * (their endpoints 503 otherwise).
 */
export function TelegraphPage() {
  const { data: status, isLoading, error } = useTelegraphStatus();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <PageHeader
          eyebrow="Governed action"
          title="Verified signals"
          description="Confirm external intelligence before it drives a spend or policy decision. Categories, interest scores, and questions collected for this workspace."
        />
        <p className="text-[11px] text-muted-foreground -mt-4">
          Miner calls pay ~$0.01 x402 USDC; confidence ≥ threshold approves, below holds — each call receipts a <span className="font-mono">telegraph.signal</span> artifact.
        </p>
        <aside
          aria-label="Worked example"
          className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
        >
          <h2 className="text-sm font-semibold">
            Why was this supplier held for review?
          </h2>
          <p className="mt-1 text-muted-foreground">
            For Northwind, a fictional supplier, the model recommended
            proceeding. Low-confidence evidence sent the request to review.
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href="/verify?report=supplier-diligence&case=2&model=groq&view=governed"
              className="text-primary hover:underline"
            >
              Inspect the decision
            </Link>
            <span className="text-xs text-muted-foreground">
              Recorded testnet example · No new charge
            </span>
          </p>
        </aside>

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : error ? (
          <PageState
            variant="error"
            title="Could not load signal status"
            message={error instanceof Error ? error.message : "Request failed"}
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        ) : status ? (
          <>
            <StatusCard status={status} />
            {status.enabled ? (
              <>
                <ConsumptionSection />
                <LedgerSection />
                <CategoriesSection />
                <QuestionsSection />
              </>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2
                    className="text-lg font-semibold"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    Verified signals are disabled
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {status.paymentError ||
                    "This backend is not collecting verified intelligence. Enable the signals integration (TELEGRAPH_ENABLED and a payment signer) to activate the feed."}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Status card ───────────────────────────────────────────── */

function StatusField({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`flex items-center gap-1.5 text-sm font-medium ${
          tone === "positive"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : ""
        } ${mono ? "font-mono text-xs" : ""}`}
      >
        {tone === "positive" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : tone === "warning" ? (
          <XCircle className="h-3.5 w-3.5" />
        ) : null}
        {value}
      </p>
    </div>
  );
}

function StatusCard({ status }: { status: NonNullable<ReturnType<typeof useTelegraphStatus>["data"]> }) {
  const daemonState = status.daemon
    ? status.daemon.healthy
      ? { label: "Healthy", tone: "positive" as const }
      : { label: "Unhealthy", tone: "warning" as const }
    : { label: "Unknown", tone: "neutral" as const };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Integration status
        </h2>
        {status.enabled ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Disabled
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusField
          label="Node"
          value={status.healthy ? "Healthy" : "Unhealthy"}
          tone={status.healthy ? "positive" : "warning"}
        />
        <StatusField
          label="Miners available"
          value={String(status.minersAvailable)}
          tone="neutral"
        />
        <StatusField
          label="Payment"
          value={status.paymentReady ? "Ready" : "Not ready"}
          tone={status.paymentReady ? "positive" : "warning"}
        />
        <StatusField
          label="Confidence threshold"
          value={`${(status.confidenceThreshold * 100).toFixed(0)}%`}
          tone="neutral"
        />
        <StatusField
          label="Daemon"
          value={daemonState.label}
          tone={daemonState.tone}
        />
        <StatusField
          label="Network"
          value={status.network}
          tone="neutral"
          mono
        />
        <StatusField
          label="Engine"
          value={status.engineUrl}
          tone={status.enabled ? "positive" : "neutral"}
          mono
        />
        <StatusField
          label="Node URL"
          value={status.nodeUrl}
          tone="neutral"
          mono
        />
      </div>
      {!status.enabled && status.paymentError && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
          {status.paymentError}
        </div>
      )}
    </div>
  );
}

/* ─── Governed consumption ──────────────────────────────────── */

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "recently";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
        <ShieldCheck className="h-3 w-3" />
        Approved
      </Badge>
    );
  }
  if (status === "held") {
    return (
      <Badge variant="secondary" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        Held
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function ConsumptionSection() {
  const { data, isLoading, error } = useTelegraphStats();

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Governed consumption
        </h2>
        {data?.available && data.totalCalls > 0 ? (
          <Badge variant="outline">{data.totalCalls} paid calls</Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load consumption stats"
          message={error instanceof Error ? error.message : "Request failed"}
        />
      ) : !data?.available ? (
        <p className="text-sm text-muted-foreground">
          {data?.reason ||
            "No governed calls recorded yet — stats accumulate when the signal digest consumes real daemon signals."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" /> Calls
              </p>
              <p className="text-2xl font-semibold mt-1">{data.totalCalls}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approved
              </p>
              <p className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
                {data.approved}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Held
              </p>
              <p className="text-2xl font-semibold mt-1">{data.held}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Spend
              </p>
              <p className="text-2xl font-semibold mt-1">
                ${data.totalSpendUsd.toFixed(2)}
              </p>
            </div>
          </div>

          {data.calls?.length ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {data.calls.slice(-8).reverse().map((c, i) => {
                const call = c as Record<string, unknown>;
                const signal = (call.signal as Record<string, unknown>) ?? {};
                return (
                  <div
                    key={i}
                    className="p-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-snug">
                        {typeof signal.text === "string"
                          ? signal.text
                          : "Untitled signal"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {typeof signal.category === "string" ? (
                          <Badge variant="outline">{signal.category}</Badge>
                        ) : null}
                        {typeof call.minerName === "string" ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {call.minerName as string}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(call.timestamp as string)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="flex justify-end">
                        <StatusBadge status={String(call.status)} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {typeof call.confidence === "number"
                          ? `confidence ${call.confidence.toFixed(2)}`
                          : "no confidence"}
                        {typeof call.costUsd === "string"
                          ? ` · $${call.costUsd}`
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No individual calls recorded yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Expense ledger ────────────────────────────────────────── */

const DISPOSITION_LABEL: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-emerald-600 hover:bg-emerald-600 text-white" },
  held_pending: { label: "Held — awaiting review", className: "" },
  released: { label: "Released", className: "bg-sky-600 hover:bg-sky-600 text-white" },
  quarantined: { label: "Quarantined", className: "bg-rose-600 hover:bg-rose-600 text-white" },
  blocked: { label: "Blocked — compliance", className: "bg-orange-600 hover:bg-orange-600 text-white" },
  failed: { label: "Failed", className: "" },
};

function LedgerBadge({ disposition }: { disposition: string }) {
  const d = DISPOSITION_LABEL[disposition] ?? { label: disposition, className: "" };
  if (disposition === "held_pending") {
    return (
      <Badge variant="secondary" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        {d.label}
      </Badge>
    );
  }
  if (disposition === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {d.label}
      </Badge>
    );
  }
  return <Badge className={d.className}>{d.label}</Badge>;
}

function LedgerSection() {
  const { data, isLoading, error } = useTelegraphLedger();

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Intelligence ledger
        </h2>
        {data && data.totals.calls > 0 ? (
          <Badge variant="outline">{data.totals.paidCalls} paid settlements</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Every paid miner call is a CRE run with a signed{" "}
        <span className="font-mono">telegraph.signal</span> artifact. Held signals
        wait in the escalation inbox; released and quarantined dispositions are
        recorded here.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load the intelligence ledger"
          message={error instanceof Error ? error.message : "Request failed"}
        />
      ) : !data || data.totals.calls === 0 ? (
        <p className="text-sm text-muted-foreground">
          No governed calls recorded for this workspace yet. Paid miner calls via{" "}
          <span className="font-mono">/api/telegraph/call</span>, the engine-ask
          endpoint, or the signal digest appear here with their receipts.
        </p>
      ) : (
        <LedgerBody data={data} />
      )}
    </div>
  );
}

const TRAJECTORY_COLORS: Record<string, string> = {
  approved: "#10b981",
  released: "#0ea5e9",
  held_pending: "#f59e0b",
  quarantined: "#f43f5e",
  blocked: "#f97316",
  failed: "#64748b",
};

/** Cumulative x402 spend over the ledger window — the treasury trajectory. */
function SpendTrajectory({
  records,
}: {
  records: TelegraphLedgerReport["records"];
}) {
  const paid = records
    .filter((r) => r.paid)
    .map((r) => ({
      t: Date.parse(r.timestamp),
      cost: r.costUsd,
      disposition: r.disposition,
    }))
    .sort((a, b) => a.t - b.t);
  if (paid.length < 2) return null;

  const W = 600;
  const H = 120;
  const P = 10;
  const t0 = paid[0].t;
  const span = Math.max(1, paid[paid.length - 1].t - t0);
  const total = paid.reduce((s, p) => s + p.cost, 0);
  if (total <= 0) return null;

  const prefix = paid.reduce<number[]>((acc, p) => [...acc, (acc.at(-1) ?? 0) + p.cost], []);
  const pts = paid.map((p, i) => {
    const cum = prefix[i];
    return {
      x: P + ((p.t - t0) / span) * (W - 2 * P),
      y: H - P - (cum / total) * (H - 2 * P),
      cum,
      cost: p.cost,
      disposition: p.disposition,
    };
  });

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - P} L${pts[0].x.toFixed(1)},${H - P} Z`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Spend trajectory
        </p>
        <p className="text-xs text-muted-foreground">
          ${total.toFixed(2)} cumulative · {paid.length} settlements
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-28 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Cumulative spend over time"
        >
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#spend-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={TRAJECTORY_COLORS[p.disposition] ?? "#64748b"}
              stroke="var(--card)"
              strokeWidth="1.5"
            >
              <title>{`$${p.cost.toFixed(4)} · ${p.disposition}`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(TRAJECTORY_COLORS)
            .filter(([d]) => paid.some((p) => p.disposition === d))
            .map(([d, color]) => (
              <span key={d} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {DISPOSITION_LABEL[d]?.label ?? d}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function LedgerBody({ data }: { data: TelegraphLedgerReport }) {
  const { totals } = data;
  return (
    <>
      <SpendTrajectory records={data.records} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Layers className="h-3 w-3" /> Settlements
          </p>
          <p className="text-2xl font-semibold mt-1">{totals.paidCalls}</p>
          <p className="text-[10px] text-muted-foreground">{totals.calls} calls</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Spend
          </p>
          <p className="text-2xl font-semibold mt-1">${totals.spendUsd.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">x402 USDC</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600" /> Cleared
          </p>
          <p className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
            {totals.approved + totals.released}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {totals.released} released from hold
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Held / rejected
          </p>
          <p className="text-2xl font-semibold mt-1">
            {totals.heldPending + totals.quarantined + totals.blocked}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {totals.heldPending} awaiting review · {totals.quarantined} quarantined
            {totals.blocked > 0 ? ` · ${totals.blocked} compliance-blocked` : ""}
          </p>
        </div>
      </div>

      {data.byIntent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Burn by intent
          </p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {data.byIntent.slice(0, 6).map((row) => (
              <div key={row.intent} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {row.intent}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {row.calls} call{row.calls === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <span className="text-muted-foreground">
                    {row.approved} cleared · {row.held} held · {row.failed} failed
                  </span>
                  <span className="font-medium">${row.spendUsd.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.records.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent settlements
          </p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {data.records.slice(0, 8).map((r) => (
              <div key={r.runId} className="p-3 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {r.minerName ?? r.minerId ?? "unknown miner"}
                    {r.intent && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {r.intent}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {r.mandateId && r.mandateId !== "unscoped" && (
                      <span>mandate {r.mandateId}</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(r.timestamp)}
                    </span>
                    {r.paymentNetwork && (
                      <span className="font-mono text-[10px]">{r.paymentNetwork}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <LedgerBadge disposition={r.disposition} />
                  <p className="text-[10px] text-muted-foreground">
                    ${r.costUsd.toFixed(4)}
                    {r.confidence !== null ? ` · conf ${r.confidence.toFixed(2)}` : ""}
                    {r.complianceVerdict ? ` · screen ${r.complianceVerdict}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Categories ─────────────────────────────────────────────── */

function CategoriesSection() {
  const { data, isLoading, error } = useTelegraphCategories();

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Signal categories
        </h2>
        {data?.count ? (
          <Badge variant="outline">{data.count} categories</Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load categories"
          message={error instanceof Error ? error.message : "Request failed"}
        />
      ) : data?.stats?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.stats.map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wide">
                  {c.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.count !== undefined
                    ? `${c.count} signal${c.count === 1 ? "" : "s"}`
                    : "no signals yet"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">
                  avg{" "}
                  {c.avgInterest !== undefined
                    ? c.avgInterest.toFixed(1)
                    : "—"}
                  /10
                </p>
                <p className="text-xs text-muted-foreground">
                  peak{" "}
                  {c.maxInterest !== undefined
                    ? c.maxInterest.toFixed(1)
                    : "—"}
                  /10
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No signal categories collected yet.
        </p>
      )}
    </div>
  );
}

/* ─── Questions ──────────────────────────────────────────────── */

function QuestionsSection() {
  const [category, setCategory] = useState<string>("");
  const { data: categoriesData } = useTelegraphCategories();
  const { data, isLoading, error } = useTelegraphQuestions(
    category ? { category } : {},
  );

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Collected questions
          </h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Filter
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-md border border-border bg-muted/30 px-2 text-sm"
          >
            <option value="">All categories</option>
            {categoriesData?.stats?.length
              ? categoriesData.stats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))
              : null}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load questions"
          message={error instanceof Error ? error.message : "Request failed"}
        />
      ) : data?.questions?.length ? (
        <div className="divide-y divide-border rounded-lg border border-border">
          {data.questions.map((q, i) => {
            const question = (q as Record<string, unknown>).question as
              | Record<string, unknown>
              | undefined;
            const routing = (q as Record<string, unknown>).routing as
              | Record<string, unknown>
              | undefined;
            const score =
              typeof question?.interest_score === "number"
                ? question.interest_score.toFixed(1)
                : null;
            return (
              <div key={i} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {typeof question?.text === "string"
                      ? question.text
                      : "Untitled signal"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {typeof question?.category === "string" ? (
                      <Badge variant="outline">{question.category}</Badge>
                    ) : null}
                    {typeof (q as Record<string, unknown>).source === "string" ? (
                      <span className="inline-flex items-center gap-1">
                        <Network className="h-3 w-3" />
                        {(q as Record<string, unknown>).source as string}
                      </span>
                    ) : null}
                    {typeof routing?.miner_slug === "string" ? (
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" />
                        {routing.miner_slug as string}
                      </span>
                    ) : null}
                  </div>
                </div>
                {score !== null && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{score}/10</p>
                    <p className="text-[10px] text-muted-foreground">interest</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No questions collected yet{category ? ` in "${category}"` : ""}.
        </p>
      )}
    </div>
  );
}
