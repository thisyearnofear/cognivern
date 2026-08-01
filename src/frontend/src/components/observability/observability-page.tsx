"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode, ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/error-state";
import {
  apiClient,
  type ObservabilityStatus,
  type ObservabilityMetrics,
  type AuditLog,
} from "@/lib/api-client";
import { buildSignozTraceLinkSync } from "@/lib/signoz";
import { useAuthStore } from "@/stores/auth-store";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Radar,
  Activity,
  DollarSign,
  Gauge,
  Shield,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  Search,
  Clock,
  ChevronDown,
  ArrowRight,
  Wallet,
} from "lucide-react";

/**
 * Observability page.
 *
 * Surfaces the OpenTelemetry + SigNoz integration status to the user.
 * Provenance is explicit: every span/metric/dashboard is labeled Live or
 * Upcoming so the user never confuses what is wired today with what is
 * planned. The status card hits /api/observability/status (public, no
 * workspace auth) so it renders the real backend env state.
 */
export function ObservabilityPage() {
  const [status, setStatus] = useState<ObservabilityStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsFetchFailed, setLogsFetchFailed] = useState(false);
  const [cloudUrl, setCloudUrl] = useState<string>("https://us.signoz.cloud");
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceSearch, setTraceSearch] = useState("");
  const [range, setRange] = useState<"1h" | "24h" | "7d">("24h");
  const workspaceId = useAuthStore((state) => state.workspace?.id);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setMetricsError(null);
      try {
        const [statusRes, logsRes, metricsRes] = await Promise.all([
          apiClient.getObservabilityStatus(),
          apiClient.getAuditLogs(),
          apiClient.getObservabilityMetrics(range, workspaceId),
        ]);
        if (cancelled) return;
        if (statusRes.success && statusRes.data) {
          setStatus(statusRes.data);
          if (statusRes.data.signozCloudUrl) {
            setCloudUrl(statusRes.data.signozCloudUrl);
          }
        } else {
          setError(statusRes.error || "Failed to load observability status");
        }
        if (logsRes.success && logsRes.data) {
          const data = logsRes.data as unknown;
          const logs = Array.isArray(data)
            ? data
            : (data as { logs?: AuditLog[] })?.logs ?? [];
          setAuditLogs(logs);
        } else {
          setLogsFetchFailed(true);
        }
        if (metricsRes.success && metricsRes.data) {
          setMetrics(metricsRes.data);
        } else {
          setMetricsError(metricsRes.error || "Failed to load metrics");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, workspaceId]);

  // Extract audit logs that have a traceId, most recent first
  const tracedLogs = auditLogs
    .map((log) => {
      const raw = log as unknown as Record<string, unknown>;
      const ev = raw.evidence as Record<string, unknown> | undefined;
      const traceId = ev?.traceId as string | undefined;
      return traceId ? { log, traceId } : null;
    })
    .filter((x): x is { log: AuditLog; traceId: string } => x !== null)
    .slice(0, 10);

  const handleTraceSearch = useCallback(() => {
    const trimmed = traceSearch.trim();
    if (!trimmed) return;
    window.open(buildSignozTraceLinkSync(trimmed, cloudUrl), "_blank");
  }, [traceSearch, cloudUrl]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radar className="h-6 w-6 text-primary" />
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Observability
              </h1>
              {status && <ProvenanceBadge enabled={status.enabled} />}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Every LLM call, governance decision, and agent cycle traced
              end-to-end in SigNoz via OpenTelemetry.
            </p>
          </div>
          <a
            href="https://signoz.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Powered by SigNoz
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Provenance legend */}
        <ProvenanceLegend />

        {/* Cross-link to KeeperHub-routed spends */}
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-sky-500" />
            <h2
              className="text-sm font-semibold text-sky-900 dark:text-sky-200"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Finding a KeeperHub-routed spend
            </h2>
          </div>
          <p className="text-xs text-sky-900/80 dark:text-sky-200/80 leading-relaxed">
            When a wallet is configured with <code>executionProvider: &quot;keeperhub&quot;</code> and a
            governance-approved spend is executed, the audit trail surfaces the
            same three spans you&apos;d see for a local-vault spend — just with
            different attributes. To find one:
          </p>
          <ul className="text-xs text-sky-900/80 dark:text-sky-200/80 space-y-1 list-disc list-inside">
            <li>Open <a className="underline" href="https://app.keeperhub.com" target="_blank" rel="noreferrer">app.keeperhub.com</a> for the keeper-side view (execution status, retries, gas sponsorship).</li>
            <li>In SigNoz, search for the <code>wallet_sign_and_broadcast</code> span and look for the <code>keeperhub.execution_id</code> attribute.</li>
            <li>The nested <code>audit.log_action</code> event records the on-chain <code>txHash</code> alongside the KeeperHub <code>executionId</code> so you can correlate the two views.</li>
          </ul>
          <p className="text-[10px] text-sky-900/70 dark:text-sky-200/70">
            Tip: configure a wallet in <a className="underline" href="/settings">Settings → Wallets</a> to enable the
            KeeperHub execution path.
          </p>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <PageState variant="error" title="Could not load observability" message={error} action={{ label: "Retry", onClick: () => window.location.reload() }} />
        ) : status ? (
          <div className="space-y-8">
            <StatusCard status={status} />
            <LiveMetricsSection metrics={metrics} error={metricsError} range={range} onRangeChange={setRange} />
            <TraceSearchSection
              traceSearch={traceSearch}
              setTraceSearch={setTraceSearch}
              onSearch={handleTraceSearch}
              cloudUrl={cloudUrl}
            />
            <RecentTracesSection traces={tracedLogs} cloudUrl={cloudUrl} logsFetchFailed={logsFetchFailed} />
            <div className="pt-2">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                {showDetails ? "Hide" : "Show"} technical details
                <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>
            </div>
            {showDetails && (
              <div className="space-y-8">
                <DashboardsSection dashboards={status.dashboards} />
                <SpansSection spans={status.instrumentedSpans} />
                <MetricsSection metrics={status.instrumentedMetrics} />
                <SetupSection enabled={status.enabled} cloudUrl={cloudUrl} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function asTooltipFormatter(
  fn: (value: number) => [string, string],
): NonNullable<ComponentProps<typeof Tooltip>["formatter"]> {
  return fn as unknown as NonNullable<ComponentProps<typeof Tooltip>["formatter"]>;
}

/* ─── Provenance helpers ─────────────────────────────────────── */

function ProvenanceBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Live
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      Disabled
    </Badge>
  );
}

function StatusChip({ status }: { status: "live" | "upcoming" }) {
  return status === "live" ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Live</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      Upcoming
    </Badge>
  );
}

function ProvenanceLegend() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Provenance legend:</span>{" "}
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] ml-1">
        Live
      </Badge>{" "}
      = wired and emitting today{" "}
      <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">
        Upcoming
      </Badge>{" "}
      = on the roadmap, not yet emitting. The status card below reflects the
      real backend env (
      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
        OTEL_EXPORTER_OTLP_ENDPOINT
      </code>
      ).
    </div>
  );
}

/* ─── Status card ────────────────────────────────────────────── */

function StatusCard({ status }: { status: ObservabilityStatus }) {
  const traceState = !status.enabled
    ? { label: "Disabled", tone: "neutral" as const }
    : status.reachable === null
      ? { label: "Checking...", tone: "neutral" as const }
      : status.reachable
        ? { label: "Endpoint reachable", tone: "positive" as const }
        : { label: "Configured, endpoint unreachable", tone: "warning" as const };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Backend status
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusField
          label="Tracing"
          value={traceState.label}
          tone={traceState.tone}
        />
        <StatusField
          label="OTLP endpoint"
          value={status.endpoint || "not configured"}
          tone={status.endpoint ? "positive" : "neutral"}
          mono
        />
        <StatusField
          label="Ingestion key"
          value={status.ingestionKeyConfigured ? "set" : "missing"}
          tone={status.ingestionKeyConfigured ? "positive" : "neutral"}
        />
        <StatusField
          label="Query API"
          value={status.queryConfigured ? "configured" : "not configured"}
          tone={status.queryConfigured ? "positive" : "neutral"}
        />
        <StatusField
          label="Service name"
          value={status.serviceName}
          tone="neutral"
          mono
        />
      </div>
      {!status.enabled && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
          OpenTelemetry is disabled on this backend. Spans and metrics are
          defined in code but not exported. Set{" "}
          <code className="bg-muted px-1 py-0.5 rounded">
            OTEL_EXPORTER_OTLP_ENDPOINT
          </code>{" "}
          and{" "}
          <code className="bg-muted px-1 py-0.5 rounded">
            SIGNOZ_INGESTION_KEY
          </code>{" "}
          in the backend env to activate.
        </div>
      )}
      {status.enabled && status.reachable === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-700 dark:text-red-400">
          OTLP endpoint is configured but unreachable. Check that SigNoz is
          running and the endpoint URL is correct.
        </div>
      )}
    </div>
  );
}

function StatusField({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "warning";
  mono?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-red-600 dark:text-red-400"
        : "";
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-medium ${toneClass} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/* ─── Live metrics dashboard (replaces iframe) ──────────────── */

function LiveMetricsSection({
  metrics,
  error,
  range,
  onRangeChange,
}: {
  metrics: ObservabilityMetrics | null;
  error: string | null;
  range: "1h" | "24h" | "7d";
  onRangeChange: (range: "1h" | "24h" | "7d") => void;
}) {
  const unavailable = error || !metrics || !metrics.live || metrics.buckets.length === 0;
  if (unavailable) {
    const backendMessage = metrics?.message;
    return (
      <Section
        title="Live telemetry"
        icon={<Gauge className="h-5 w-5 text-primary" />}
        subtitle={
          error
            ? "Live charts are unavailable right now."
            : "Set SIGNOZ_CLOUD_URL and SIGNOZ_API_KEY on the backend to query SigNoz metrics."
        }
      >
        <div className="rounded-lg border border-dashed p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {error ? "Metrics query failed" : "Live metrics not configured"}
          </div>
          <p className="text-xs text-muted-foreground">
            {error
              ? error
              : backendMessage ||
                "The backend needs a SigNoz Service Account API key to fetch live metrics. Add SIGNOZ_API_KEY and the recent traces table below will continue to work."}
          </p>
        </div>
      </Section>
    );
  }

  const { summary } = metrics;

  return (
    <Section
      title="Live telemetry"
      icon={<Gauge className="h-5 w-5 text-primary" />}
      subtitle="Queryable data from SigNoz, rendered natively in Cognivern."
    >
      <div className="flex justify-end">
        <select
          value={range}
          onChange={(event) => onRangeChange(event.target.value as "1h" | "24h" | "7d")}
          className="h-8 rounded-md border bg-background px-2 text-xs"
          aria-label="Telemetry time range"
        >
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>
      <OperationalSignals summary={summary} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Governance decisions"
          value={summary.totalDecisions.toLocaleString()}
          tone="positive"
        />
        <SummaryCard
          label="LLM cost"
          value={`$${summary.totalCostUsd.toFixed(4)}`}
          tone="neutral"
        />
        <SummaryCard
          label="LLM failures"
          value={summary.totalFailures.toLocaleString()}
          tone={summary.totalFailures > 0 ? "warning" : "positive"}
        />
        <SummaryCard
          label="LLM p95 latency"
          value={`${Math.round(summary.avgLatencyP95Ms)} ms`}
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Governance decisions" subtitle={`Decisions over the last ${range}`}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={metrics.buckets}>
              <defs>
                <linearGradient id="colorDecisions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={asTooltipFormatter((value: number) => {
                  const num = typeof value === "number" ? value : Number(value);
                  return [num.toLocaleString(), "Decisions"] as [string, string];
                })}
              />
              <Area
                type="monotone"
                dataKey="decisions"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorDecisions)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LLM cost (USD)" subtitle={`Cumulative LLM spend over the last ${range}`}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={metrics.buckets}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={asTooltipFormatter((value: number) => {
                  const num = typeof value === "number" ? value : Number(value);
                  return [`$${num.toFixed(4)}`, "Cost"] as [string, string];
                })}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorCost)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LLM failures" subtitle={`Failed LLM calls over the last ${range}`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics.buckets}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={asTooltipFormatter((value: number) => {
                  const num = typeof value === "number" ? value : Number(value);
                  return [num.toLocaleString(), "Failures"] as [string, string];
                })}
              />
              <Line
                type="monotone"
                dataKey="failures"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LLM p95 latency" subtitle={`p95 span duration over the last ${range}`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics.buckets}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={asTooltipFormatter((value: number) => {
                  const num = typeof value === "number" ? value : Number(value);
                  return [`${Math.round(num)} ms`, "p95 Latency"] as [string, string];
                })}
              />
              <Line
                type="monotone"
                dataKey="latencyP95"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </Section>
  );
}

function OperationalSignals({
  summary,
}: {
  summary: ObservabilityMetrics["summary"];
}) {
  const signals = [
    summary.totalFailures > 0
      ? { label: `${summary.totalFailures} LLM failure${summary.totalFailures === 1 ? "" : "s"} detected`, tone: "warning" }
      : { label: "No LLM failures detected", tone: "positive" },
    summary.avgLatencyP95Ms > 2000
      ? { label: `LLM p95 latency is high (${Math.round(summary.avgLatencyP95Ms)} ms)`, tone: "warning" }
      : { label: "LLM latency is within the 2s watch threshold", tone: "positive" },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-label="Operational signals">
      {signals.map((signal) => (
        <span
          key={signal.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${signal.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}
        >
          {signal.tone === "warning" ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="h-[240px]">{children}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

/* ─── Trace search ───────────────────────────────────────────── */

function TraceSearchSection({
  traceSearch,
  setTraceSearch,
  onSearch,
  cloudUrl,
}: {
  traceSearch: string;
  setTraceSearch: (v: string) => void;
  onSearch: () => void;
  cloudUrl: string;
}) {
  return (
    <Section
      title="Search a trace"
      icon={<Search className="h-5 w-5 text-primary" />}
      subtitle={`Paste a trace ID to open it directly in SigNoz (${cloudUrl.replace(/^https?:\/\//, "")}).`}
    >
      <div className="flex gap-2">
        <Input
          placeholder="e.g. a1b2c3d4e5f6789012345678abcdef01"
          value={traceSearch}
          onChange={(e) => setTraceSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="font-mono text-sm"
        />
        <Button onClick={onSearch} disabled={!traceSearch.trim()}>
          Open in SigNoz
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    </Section>
  );
}

/* ─── Recent governance traces ───────────────────────────────── */

interface TracedLog {
  log: AuditLog;
  traceId: string;
}

function RecentTracesSection({
  traces,
  cloudUrl,
  logsFetchFailed,
}: {
  traces: TracedLog[];
  cloudUrl: string;
  logsFetchFailed: boolean;
}) {
  if (traces.length === 0) {
    return (
      <Section
        title="Recent governance traces"
        icon={<Clock className="h-5 w-5 text-primary" />}
        subtitle={
          logsFetchFailed
            ? "Could not load audit logs. Check that the backend is running and try refreshing."
            : "Governance decisions with trace IDs appear here once you run checks with OTel enabled."
        }
      >
        <div className={`rounded-lg border border-dashed p-6 text-center ${logsFetchFailed ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
          <p className="text-sm text-muted-foreground">
            {logsFetchFailed ? (
              "Failed to fetch audit logs. The trace search above still works if you have a trace ID."
            ) : (
              "No traced governance decisions yet. Run pnpm signoz:seed to generate sample traces, or run a governance check."
            )}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Recent governance traces"
      icon={<Clock className="h-5 w-5 text-primary" />}
      subtitle="Latest governance decisions with distributed traces. Click to open in SigNoz."
    >
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Trace ID
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Action
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Decision
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Time
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {traces.map(({ log, traceId }) => (
              <tr
                key={traceId}
                className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() =>
                  window.open(
                    buildSignozTraceLinkSync(traceId, cloudUrl),
                    "_blank",
                  )
                }
              >
                <td className="px-4 py-2.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                  {traceId.slice(0, 16)}...
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {log.actionType || log.action || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <DecisionBadge decision={log.decision || log.outcome} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function DecisionBadge({
  decision,
}: {
  decision?: string;
}) {
  const normalized = (decision || "").toLowerCase();
  if (["approved", "allowed", "compliant"].includes(normalized)) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
        Approved
      </Badge>
    );
  }
  if (["denied", "non-compliant"].includes(normalized)) {
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-[10px]">Denied</Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      Held
    </Badge>
  );
}

/* ─── Dashboards ─────────────────────────────────────────────── */

function DashboardsSection({
  dashboards,
}: {
  dashboards: ObservabilityStatus["dashboards"];
}) {
  return (
    <Section
      title="SigNoz dashboards"
      icon={<Gauge className="h-5 w-5 text-primary" />}
      subtitle="Pre-built dashboard definitions. Import docs/signoz-dashboards.json into SigNoz Cloud."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {dashboards.map((d) => (
          <div
            key={d.title}
            className="rounded-lg border bg-card p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium leading-tight">{d.title}</h3>
              <StatusChip status={d.status} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {d.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─── Spans ──────────────────────────────────────────────────── */

function SpansSection({
  spans,
}: {
  spans: ObservabilityStatus["instrumentedSpans"];
}) {
  return (
    <Section
      title="Instrumented spans"
      icon={<Activity className="h-5 w-5 text-primary" />}
      subtitle="Manual OTel spans emitted from the backend. Each span appears in SigNoz Traces."
    >
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Span name
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Source
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {spans.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="px-4 py-2.5 font-mono text-xs">{s.name}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {s.source}
                </td>
                <td className="px-4 py-2.5">
                  <StatusChip status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ─── Metrics ────────────────────────────────────────────────── */

function MetricsSection({
  metrics,
}: {
  metrics: ObservabilityStatus["instrumentedMetrics"];
}) {
  return (
    <Section
      title="Instrumented metrics"
      icon={<DollarSign className="h-5 w-5 text-primary" />}
      subtitle="OTel counters and histograms emitted from the backend. Each metric appears in SigNoz Metrics."
    >
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Metric name
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">
                Source
              </th>
              <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.name} className="border-t">
                <td className="px-4 py-2.5 font-mono text-xs">{m.name}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {m.source}
                </td>
                <td className="px-4 py-2.5">
                  <StatusChip status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ─── Setup ──────────────────────────────────────────────────── */

function SetupSection({
  enabled,
  cloudUrl,
}: {
  enabled: boolean;
  cloudUrl: string;
}) {
  return (
    <Section
      title="Setup"
      icon={<Shield className="h-5 w-5 text-primary" />}
      subtitle={
        enabled
          ? "Tracing is active. See docs/DEVELOPER.md for the full setup guide."
          : "Enable tracing by setting env vars on the backend. Zero-overhead when unset."
      }
    >
      {!enabled && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Tracing is not configured
          </div>
          <p className="text-xs text-muted-foreground">
            Observability requires a backend environment change. If you are not
            the admin of this Cognivern deployment, ask your administrator to
            set the environment variables below and redeploy. The OTel SDK has
            zero overhead when disabled, so enabling it is safe for production.
          </p>
        </div>
      )}
      <div className="rounded-lg border bg-zinc-950 text-zinc-100 p-4 font-mono text-xs leading-relaxed overflow-x-auto">
        <div className="text-zinc-500"># SigNoz Cloud OTLP endpoint</div>
        <div>
          <span className="text-emerald-400">OTEL_EXPORTER_OTLP_ENDPOINT</span>
          =https://us.ingest.signoz.cloud
        </div>
        <div className="text-zinc-500 mt-2">
          # SigNoz ingestion key (Settings -&gt; Ingestion)
        </div>
        <div>
          <span className="text-emerald-400">SIGNOZ_INGESTION_KEY</span>
          =your-key-here
        </div>
        <div className="text-zinc-500 mt-2"># Service name in SigNoz</div>
        <div>
          <span className="text-emerald-400">OTEL_SERVICE_NAME</span>
          =cognivern-backend
        </div>
        <div className="text-zinc-500 mt-2">
          # SigNoz Cloud URL for trace deep-links
        </div>
        <div>
          <span className="text-emerald-400">SIGNOZ_CLOUD_URL</span>
          ={cloudUrl}
        </div>
        <div className="text-zinc-500 mt-2">
          # SigNoz Cloud API key (Settings -&gt; Service Accounts)
        </div>
        <div>
          <span className="text-emerald-400">SIGNOZ_API_KEY</span>
          =your-api-key
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2 flex-wrap">
        <a
          href="https://signoz.io/docs/install/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          SigNoz install docs
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://github.com/thisyearnofear/cognivern/blob/main/docs/DEVELOPER.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Developer guide
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://github.com/thisyearnofear/cognivern/blob/main/HACKATHON_SUBMISSION_SIGNOZ.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Full submission doc
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Section>
  );
}

/* ─── Shared section shell ───────────────────────────────────── */

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon}
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
