"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageState } from "@/components/ui/error-state";
import {
  apiClient,
  type FundedMandate,
  type SpendAttributionReport,
} from "@/lib/api-client";
import {
  computeDetectionGap,
  detectProgramSignals,
  type AttributionRecord,
} from "@/lib/program-signals";
import { useAuthStore } from "@/stores/auth-store";

interface ProgramCard {
  mandate: FundedMandate;
  records: AttributionRecord[];
  worstUtilization: number; // 0..1 across assets
  criticalSignals: number;
  totalSignals: number;
  heldCount: number;
  detectionGap: boolean;
}

function toBigInt(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function utilization(mandate: FundedMandate): number {
  let worst = 0;
  for (const budget of Object.values(mandate.budget.byAsset)) {
    const authorized = toBigInt(budget.authorizedAmount);
    if (authorized === BigInt(0)) continue;
    const committed =
      toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount);
    const ratio = Number(committed) / Number(authorized);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

/**
 * Programs — the population layer above individual agents.
 *
 * Each funded mandate is a program: a shared treasury (authorized budget
 * per asset), a member agent population, and collective policy. Per-agent
 * dashboards cannot see the treasury breach; this view exists because the
 * invariant that matters is the program's, not any single agent's.
 */
export function ProgramsPage() {
  const router = useRouter();
  const workspaceId = useAuthStore((state) => state.workspace?.id);
  const [mandates, setMandates] = useState<FundedMandate[] | null>(null);
  const [attribution, setAttribution] = useState<SpendAttributionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mandatesRes, attributionRes] = await Promise.all([
          apiClient.getMandates(),
          apiClient.getSpendAttribution(),
        ]);
        if (cancelled) return;
        if (!mandatesRes.success || !mandatesRes.data) {
          throw new Error(mandatesRes.error || "Could not load mandates");
        }
        setMandates(mandatesRes.data);
        if (attributionRes.success && attributionRes.data) {
          setAttribution(attributionRes.data);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load programs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const cards = useMemo<ProgramCard[]>(() => {
    if (!mandates) return [];
    const recordsByMandate = new Map<string, AttributionRecord[]>();
    for (const rec of attribution?.records ?? []) {
      if (!rec.mandateId) continue;
      const list = recordsByMandate.get(rec.mandateId) ?? [];
      list.push(rec);
      recordsByMandate.set(rec.mandateId, list);
    }
    return mandates.map((mandate) => {
      const records = recordsByMandate.get(mandate.id) ?? [];
      const signals = detectProgramSignals(mandate, records);
      return {
        mandate,
        records,
        worstUtilization: utilization(mandate),
        criticalSignals: signals.filter((s) => s.severity === "critical").length,
        totalSignals: signals.length,
        heldCount: records.filter((r) => r.status === "held").length,
        detectionGap: computeDetectionGap(mandate, records).detected,
      };
    });
  }, [mandates, attribution]);

  const sorted = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const score = (c: ProgramCard) =>
          c.criticalSignals * 100 + c.totalSignals * 10 + c.worstUtilization;
        return score(b) - score(a);
      }),
    [cards],
  );

  if (loading) {
    return (
      <PageState
        variant="empty"
        title="Loading programs"
        message="Reading mandates and spend attribution."
      />
    );
  }
  if (error) {
    return (
      <PageState
        variant="error"
        title="Programs unavailable"
        message={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Population governance"
        title="Programs"
        description="Funded mandates are programs: a shared treasury, a member agent population, and collective policy. This is the layer per-agent views cannot see."
      />

      {sorted.length === 0 ? (
        <PageState
          variant="empty"
          title="No programs yet"
          message="Create a funded mandate to pool a treasury across agents."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((card) => (
            <button
              key={card.mandate.id}
              type="button"
              onClick={() => router.push(`/programs/${card.mandate.id}`)}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{card.mandate.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {card.mandate.objective}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={card.mandate.status === "active" ? "default" : "secondary"}>
                  {card.mandate.status}
                </Badge>
                <Badge variant="outline">
                  <Users className="mr-1 h-3 w-3" />
                  {card.mandate.agentIds.length} agents
                </Badge>
                {card.heldCount > 0 && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                    {card.heldCount} held
                  </Badge>
                )}
                {card.criticalSignals > 0 && (
                  <Badge variant="destructive">
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    {card.criticalSignals} critical
                  </Badge>
                )}
                {card.detectionGap && (
                  <Badge variant="outline" className="border-destructive/50 text-destructive">
                    detection gap
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                {Object.entries(card.mandate.budget.byAsset).map(([asset, budget]) => {
                  const authorized = toBigInt(budget.authorizedAmount);
                  const committed =
                    toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount);
                  const pct =
                    authorized === BigInt(0) ? 0 : Math.min(100, (Number(committed) / Number(authorized)) * 100);
                  return (
                    <div key={asset} className="flex items-center gap-2 text-xs">
                      <span className="w-14 shrink-0 font-mono text-muted-foreground">{asset}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-muted-foreground">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {card.totalSignals > 0 && (
                <p className="text-xs text-muted-foreground">
                  {card.totalSignals} population signal{card.totalSignals === 1 ? "" : "s"}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
