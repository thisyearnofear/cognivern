"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTelegraphStatus,
  useTelegraphCategories,
  useTelegraphQuestions,
  useTelegraphStats,
} from "@/hooks/use-api";
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
          eyebrow="Telegraph Protocol"
          title="Telegraph signals"
          description="Verified intelligence from the Telegraph miner network — signal categories, interest scores, and the questions the daemon is collecting."
        />

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : error ? (
          <PageState
            variant="error"
            title="Could not load Telegraph status"
            message={error instanceof Error ? error.message : "Request failed"}
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        ) : status ? (
          <>
            <StatusCard status={status} />
            {status.enabled ? (
              <>
                <ConsumptionSection />
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
                    Telegraph integration is disabled
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {status.paymentError ||
                    "This backend has the Telegraph integration turned off, so no signals are being collected. Set TELEGRAPH_ENABLED=true (and an EVM private key for x402 payments) in the backend environment to activate the daemon feed."}
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
