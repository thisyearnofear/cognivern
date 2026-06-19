"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Users, Activity } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface SuspicionInsights {
  totalScored: number;
  distribution: Record<string, number>;
  averageScore: number;
  escalationRate: number;
  topAgents: Array<{ agentId: string; avgScore: number; escalatedCount: number }>;
  recentEscalations: Array<{
    runId: string;
    agentId: string;
    composite: number;
    label: string;
    reasoning: string[];
    timestamp: string;
  }>;
  dimensionContribution: Record<string, number>;
}

const DIMENSION_LABELS: Record<string, string> = {
  ruleViolations: "Rule Violations",
  behavioralDeviation: "Behavioral Deviation",
  temporalAnomaly: "Temporal Anomaly",
  scopeCreep: "Scope Creep",
  statisticalAnomaly: "Statistical Anomaly",
};

const LABEL_COLORS: Record<string, string> = {
  normal: "bg-emerald-500",
  elevated: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const LABEL_TEXT_COLORS: Record<string, string> = {
  normal: "text-emerald-500",
  elevated: "text-amber-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

export function SuspicionOverview() {
  const [data, setData] = useState<SuspicionInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/audit/insights?dimension=suspicion")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) {
          setData(json.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-8 w-full bg-muted rounded mb-3" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!data || data.totalScored === 0) return null;

  const distributionEntries = Object.entries(data.distribution).filter(
    ([, count]) => count > 0,
  );
  const maxCount = Math.max(...Object.values(data.distribution), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h2
            className="font-semibold text-sm"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Suspicion Overview
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{data.totalScored} scored</span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            avg {data.averageScore.toFixed(2)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {data.escalationRate}% escalated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution chart */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-3">
            Score Distribution
          </div>
          <div className="space-y-2">
            {distributionEntries.map(([label, count]) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium w-16 ${LABEL_TEXT_COLORS[label] || "text-muted-foreground"} capitalize`}
                >
                  {label}
                </span>
                <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${LABEL_COLORS[label] || "bg-muted-foreground"}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>

          {/* Dimension contribution */}
          {Object.keys(data.dimensionContribution).length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Dimension Averages
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {Object.entries(data.dimensionContribution).map(([dim, val]) => (
                  <div key={dim} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {DIMENSION_LABELS[dim] || dim}
                    </span>
                    <span className="font-mono">{val.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top agents + recent escalations */}
        <div className="space-y-4">
          {data.topAgents.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Top Agents by Suspicion
              </div>
              <div className="space-y-1.5">
                {data.topAgents.slice(0, 5).map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-muted-foreground truncate max-w-[140px]">
                      {agent.agentId}
                    </span>
                    <div className="flex items-center gap-2">
                      {agent.escalatedCount > 0 && (
                        <span className="text-red-500 text-[10px]">
                          {agent.escalatedCount} esc
                        </span>
                      )}
                      <span
                        className={`font-mono font-medium ${
                          agent.avgScore >= 0.6
                            ? "text-red-500"
                            : agent.avgScore >= 0.3
                              ? "text-amber-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {agent.avgScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.recentEscalations.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Recent Escalations
              </div>
              <div className="space-y-2">
                {data.recentEscalations.slice(0, 5).map((esc) => (
                  <div
                    key={esc.runId}
                    className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                        {esc.agentId}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] capitalize text-red-500 font-medium">
                          {esc.label}
                        </span>
                        <span className="font-mono text-xs text-red-500">
                          {esc.composite.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {esc.reasoning.length > 0 && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {esc.reasoning.join("; ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
