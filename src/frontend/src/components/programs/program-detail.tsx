"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  Info,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageState } from "@/components/ui/error-state";
import {
  apiClient,
  type Agent,
  type FundedMandate,
  type SpendAttributionReport,
} from "@/lib/api-client";
import {
  computeDetectionGap,
  computeProgramCoverage,
  delegatedSpendEdges,
  detectProgramSignals,
  rollupAgentSpend,
  treasuryTrajectory,
  type ProgramSignal,
} from "@/lib/program-signals";
import type { AssetUnitOverride } from "@cognivern/shared";
import { useAuthStore } from "@/stores/auth-store";

function toBigInt(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function fmt(value: bigint): string {
  return value.toLocaleString();
}

const SEVERITY_STYLE: Record<ProgramSignal["severity"], { icon: typeof Info; className: string }> = {
  critical: { icon: ShieldAlert, className: "border-destructive/50 text-destructive" },
  warning: { icon: TriangleAlert, className: "border-amber-500/50 text-amber-600" },
  info: { icon: Info, className: "border-border text-muted-foreground" },
};

/** Minimal cumulative-spend sparkline — no axes, shape only. */
function TrajectorySparkline({ points }: { points: number[] }) {
  const width = 560;
  const height = 72;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - (v / max) * (height - 8) - 4).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const lastX = (points.length - 1) * step;
  const lastY = height - (last / max) * (height - 8) - 4;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-16 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Cumulative spend trajectory"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      <circle cx={lastX} cy={lastY} r="3" className="fill-primary" />
    </svg>
  );
}

/**
 * Program detail — one funded mandate's population view: shared treasury,
 * member agents, delegated spend edges, and population-level signals.
 */
export function ProgramDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mandateId = params.id;
  const workspaceId = useAuthStore((state) => state.workspace?.id);
  const [mandate, setMandate] = useState<FundedMandate | null>(null);
  const [attribution, setAttribution] = useState<SpendAttributionReport | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetOverrides, setAssetOverrides] = useState<Record<string, AssetUnitOverride>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mandateRes, attributionRes, agentsRes, cleanverseRes] = await Promise.all([
          apiClient.getMandate(mandateId),
          apiClient.getSpendAttribution(mandateId),
          apiClient.getAgents(),
          apiClient.getCleanverseStatus().catch(() => null),
        ]);
        if (cancelled) return;
        if (!mandateRes.success || !mandateRes.data) {
          throw new Error(mandateRes.error || "Mandate not found");
        }
        setMandate(mandateRes.data);
        if (attributionRes.success && attributionRes.data) {
          setAttribution(attributionRes.data);
        }
        if (agentsRes.success && agentsRes.data) {
          setAgents(agentsRes.data);
        }
        if (cleanverseRes?.success && cleanverseRes.data?.aTokenSymbol && cleanverseRes.data.aTokenDecimals) {
          setAssetOverrides({
            [cleanverseRes.data.aTokenSymbol]: {
              decimals: cleanverseRes.data.aTokenDecimals,
              kind: 'fiat',
              usdPegged: true,
            },
          });
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load program");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mandateId, workspaceId]);

  const records = useMemo(
    () => (attribution?.records ?? []).filter((r) => r.mandateId === mandateId || !r.mandateId),
    [attribution, mandateId],
  );
  const signals = useMemo(
    () => (mandate ? detectProgramSignals(mandate, records) : []),
    [mandate, records],
  );
  const agentRollups = useMemo(
    () => (mandate ? rollupAgentSpend(mandate, records) : []),
    [mandate, records],
  );
  const delegatedEdges = useMemo(
    () => (mandate ? delegatedSpendEdges(mandate, records) : []),
    [mandate, records],
  );
  const coverageAdvisories = useMemo(
    () => (mandate ? computeProgramCoverage(mandate, agents, assetOverrides) : []),
    [mandate, agents, assetOverrides],
  );
  const detectionGap = useMemo(
    () => (mandate ? computeDetectionGap(mandate, records) : null),
    [mandate, records],
  );
  const trajectory = useMemo(
    () => (mandate ? treasuryTrajectory(mandate, records) : null),
    [mandate, records],
  );

  if (loading) {
    return (
      <PageState variant="empty" title="Loading program" message="Reading mandate and spend attribution." />
    );
  }
  if (error || !mandate) {
    return (
      <PageState
        variant="error"
        title="Program unavailable"
        message={error ?? "Mandate not found."}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => router.push("/programs")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Programs
        </Button>
        <PageHeader
          eyebrow="Program"
          title={mandate.name}
          description={mandate.objective}
          action={
            <Badge variant={mandate.status === "active" ? "default" : "secondary"}>
              {mandate.status}
            </Badge>
          }
        />
      </div>

      {/* Detection gap — the product's core metric */}
      {detectionGap && detectionGap.signalCount > 0 && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            detectionGap.detected
              ? "border-destructive/50 bg-destructive/5"
              : "border-border bg-card"
          }`}
        >
          <ShieldAlert
            className={`mt-0.5 h-4 w-4 shrink-0 ${detectionGap.detected ? "text-destructive" : "text-muted-foreground"}`}
          />
          <div>
            <p className="text-sm font-medium">
              Detection gap: {detectionGap.detected ? "open" : "closed"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detectionGap.explanation}</p>
          </div>
        </div>
      )}

      {/* Mandate coverage — issuance-time lint (P1) */}
      {coverageAdvisories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Mandate coverage</h2>
          <div className="space-y-2">
            {coverageAdvisories.map((advisory) => (
              <div
                key={`${advisory.id}-${advisory.title}`}
                className={`flex items-start gap-3 rounded-xl border bg-card p-3 ${
                  advisory.severity === "warning"
                    ? "border-amber-500/50"
                    : "border-border"
                }`}
              >
                {advisory.severity === "warning" ? (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{advisory.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{advisory.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Population signals — the swarm-forensics layer */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Population signals</h2>
        {signals.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No population-level anomalies detected across {records.length} spend record
            {records.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <div className="space-y-2">
            {signals.map((signal, idx) => {
              const style = SEVERITY_STYLE[signal.severity];
              const Icon = style.icon;
              return (
                <div
                  key={`${signal.id}-${idx}`}
                  className={`rounded-xl border bg-card p-4 ${style.className}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{signal.title}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {signal.confidence} confidence
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
                      {signal.evidence.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {signal.evidence.map((ev) => (
                            <Badge key={ev.reference} variant="outline" className="font-mono text-[10px]">
                              {ev.label} · {ev.reference.slice(0, 10)}…
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shared treasury */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Shared treasury</h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Asset</th>
                <th className="px-4 py-2 text-right font-medium">Authorized</th>
                <th className="px-4 py-2 text-right font-medium">Allocated</th>
                <th className="px-4 py-2 text-right font-medium">Consumed</th>
                <th className="px-4 py-2 text-right font-medium">Pending</th>
                <th className="px-4 py-2 text-right font-medium">Committed</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mandate.budget.byAsset).map(([asset, budget]) => {
                const authorized = toBigInt(budget.authorizedAmount);
                const committed =
                  toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount);
                const pct =
                  authorized === BigInt(0) ? 0 : Math.min(100, (Number(committed) / Number(authorized)) * 100);
                return (
                  <tr key={asset} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono">{asset}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(authorized)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(toBigInt(budget.allocatedAmount))}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(toBigInt(budget.consumedAmount))}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(toBigInt(budget.pendingAmount))}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {trajectory && trajectory.points.length > 1 && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                Spend trajectory · {trajectory.asset}
              </p>
              <p className="text-xs text-muted-foreground">
                {trajectory.daysToCap != null
                  ? trajectory.daysToCap <= 0
                    ? "cap headroom exhausted"
                    : `≈${Math.ceil(trajectory.daysToCap)}d to cap at current rate`
                  : trajectory.ratePerDay != null
                    ? `committing ≈${Math.round(trajectory.ratePerDay).toLocaleString()}/day`
                    : "insufficient time span for a rate"}
              </p>
            </div>
            <TrajectorySparkline points={trajectory.points.map((p) => Number(p.committed))} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cumulative committed spend derived from attribution records; cap
              projection uses the mandate&apos;s authorized headroom for {trajectory.asset}.
            </p>
          </div>
        )}
      </section>

      {/* Member agents — funded-by edges */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Agent population</h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Budget</th>
                <th className="px-4 py-2 text-right font-medium">Records</th>
                <th className="px-4 py-2 text-right font-medium">Allocated</th>
                <th className="px-4 py-2 text-right font-medium">Consumed</th>
                <th className="px-4 py-2 text-right font-medium">Held</th>
                <th className="px-4 py-2 text-right font-medium">Denied</th>
              </tr>
            </thead>
            <tbody>
              {agentRollups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No spend records attributed to this program yet.
                  </td>
                </tr>
              ) : (
                agentRollups.map((rollup) => (
                  <tr key={rollup.agentId} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{rollup.agentId}</td>
                    <td className="px-4 py-2.5">
                      {rollup.inScope ? (
                        <Badge variant="secondary">member</Badge>
                      ) : (
                        <Badge variant="destructive">out of scope</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {agents.find((a) => a.id === rollup.agentId)?.budget ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{rollup.recordCount}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(rollup.allocated)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(rollup.consumed)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(rollup.held)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(rollup.denied)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleAlert className="h-3 w-3" />
          Mandate funds {mandate.agentIds.length} authorized agent
          {mandate.agentIds.length === 1 ? "" : "s"}. Records from agents outside that
          list are flagged as out-of-scope spend.
        </p>
      </section>

      {/* Delegated spend — buyer → beneficiary edges */}
      {delegatedEdges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Delegated spend</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Buyer</th>
                  <th className="px-4 py-2 font-medium">Spent on behalf of</th>
                  <th className="px-4 py-2 font-medium">Beneficiary scope</th>
                  <th className="px-4 py-2 text-right font-medium">Records</th>
                  <th className="px-4 py-2 text-right font-medium">Consumed</th>
                </tr>
              </thead>
              <tbody>
                {delegatedEdges.map((edge) => (
                  <tr key={`${edge.buyerAgentId}→${edge.beneficiaryAgentId}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{edge.buyerAgentId}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{edge.beneficiaryAgentId}</td>
                    <td className="px-4 py-2.5">
                      {edge.beneficiaryInScope ? (
                        <Badge variant="secondary">member</Badge>
                      ) : (
                        <Badge variant="destructive">out of scope</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{edge.recordCount}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(edge.totalConsumed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            The buyer&apos;s budget is charged; the beneficiary receives the value.
            Edges to agents outside the mandate population are flagged as population
            signals above.
          </p>
        </section>
      )}

      {/* Policy coverage */}
      {mandate.policyIds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Policy coverage</h2>
          <div className="flex flex-wrap gap-1.5">
            {mandate.policyIds.map((policyId) => (
              <Badge key={policyId} variant="outline" className="font-mono text-xs">
                {policyId}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
