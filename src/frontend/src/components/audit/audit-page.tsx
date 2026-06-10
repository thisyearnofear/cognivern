"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileSearch,
  PlayCircle,
  Users,
  Shield,
  Lock,
  Fingerprint,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuditLogs } from "@/hooks/use-api";
import {
  normalizeAuditLogs,
  computeComplianceRate,
  computeAverageLatency,
  type NormalizedAuditLog,
} from "@/lib/normalizers";

function CheckItem({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {passed ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

/**
 * Detect if a raw log carries "confidential" metadata in its policy checks.
 * The backend stores this in policyChecks[i].metadata.confidential or in the
 * evaluation-level `confidential` envelope. We check both paths at runtime.
 */
function hasConfidentialFhe(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== "object") return false;
  const r = rawLog as Record<string, unknown>;
  // Check envelope-level confidential field
  const conf = r.confidential as Record<string, unknown> | undefined;
  if (conf?.fheEvaluated === true) return true;
  // Check policy-level confidential metadata
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) =>
        (c.metadata as Record<string, unknown> | undefined)?.confidential ===
          true ||
        (c.metadata as Record<string, unknown> | undefined)?.fheEvaluated ===
          true,
    );
  }
  return false;
}

/**
 * Detect if a raw log carries ChainGPT audit metadata.
 */
function hasChainGptAudit(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== "object") return false;
  const r = rawLog as Record<string, unknown>;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) =>
        (c.metadata as Record<string, unknown> | undefined)?.chaingptAudit ===
          true,
    );
  }
  return false;
}

function AuditLogRow({
  log,
  rawLog,
}: {
  log: NormalizedAuditLog;
  rawLog: unknown;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFhe = hasConfidentialFhe(rawLog);
  const isChainGpt = hasChainGptAudit(rawLog);
  const hasChecks = log.policyChecks.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card transition-colors">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${
              log.decision === "approved"
                ? "bg-emerald-100 dark:bg-emerald-950"
                : log.decision === "denied"
                  ? "bg-red-100 dark:bg-red-950"
                  : "bg-amber-100 dark:bg-amber-950"
            }`}
          >
            {log.decision === "approved" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : log.decision === "denied" ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <Clock className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{log.agent}</span>
              <Badge variant="outline" className="text-xs">
                {log.action}
              </Badge>
              {isFhe && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700"
                  title="Policy evaluated privately via Fhenix FHE"
                >
                  <ShieldCheck className="h-2.5 w-2.5" />
                  FHE
                </span>
              )}
              {isChainGpt && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
                  title="Contract audited by ChainGPT"
                >
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Audit
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {log.chain}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {log.description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 sm:ml-auto pl-10 sm:pl-0">
          <Badge
            variant={
              log.decision === "approved"
                ? "secondary"
                : log.decision === "denied"
                  ? "destructive"
                  : "outline"
            }
          >
            {log.decision}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {log.latency}
          </span>
          <span className="text-xs text-muted-foreground">
            {log.time}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border">
          <div className="pl-12 sm:pl-16 pr-0 space-y-3 pt-3">
            {/* Decision ID & Timestamp */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Decision ID:{" "}
                <code className="font-mono text-foreground/70">
                  {log.id}
                </code>
              </span>
              <span>
                Timestamp:{" "}
                <span className="text-foreground/70">{log.timestamp}</span>
              </span>
              {log.latency !== "—" && (
                <span>
                  Latency:{" "}
                  <span className="font-mono text-foreground/70">
                    {log.latency}
                  </span>
                </span>
              )}
            </div>

            {/* FHE Badge Detail */}
            {isFhe && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Encrypted Policy Evaluation (Fhenix FHE)
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Spend limit evaluated via Fhenix FHE. Your policy thresholds
                  were never exposed — not to the network, not to the evaluator.
                </p>
                {/* Decision IDs if available */}
                {(() => {
                  const raw = rawLog as Record<string, unknown>;
                  const conf = raw.confidential as
                    | Record<string, unknown>
                    | undefined;
                  const ids = conf?.decisionIds as string[] | undefined;
                  if (ids && ids.length > 0) {
                    const explorerUrl = `https://explorer.fhenix.zone/tx/${ids[0]}`;
                    return (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        View Fhenix transaction →
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* ChainGPT Audit Badge */}
            {isChainGpt && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Contract Audited by ChainGPT
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The target contract was scanned at runtime. Vulnerabilities
                  would have triggered a deny or hold decision.
                </p>
              </div>
            )}

            {/* Per-Rule Breakdown */}
            {hasChecks && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  Policy Checks
                </div>
                <div className="space-y-1">
                  {log.policyChecks.map((check) => (
                    <CheckItem
                      key={check.policyId}
                      label={check.policyId}
                      passed={check.result}
                      detail={check.reason}
                    />
                  ))}
                </div>
              </div>
            )}

            {!hasChecks && !isFhe && !isChainGpt && (
              <div className="text-xs text-muted-foreground py-2">
                No additional decision details available for this log entry.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditPage() {
  const router = useRouter();
  const { data: rawLogs, isLoading, error } = useAuditLogs();

  const logs = normalizeAuditLogs(rawLogs);
  const total = logs.length;
  const compliance = computeComplianceRate(logs);
  const avgLatency = computeAverageLatency(logs);
  const critical = logs.filter((l) => l.decision === "denied").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete governance audit trail
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-24" />
              </CardContent>
            </Card>
          ))
        ) : error ? (
          <div className="col-span-4 p-8 text-center text-muted-foreground border rounded-xl">
            <p>Failed to load audit logs</p>
            <p className="text-xs mt-1">The backend may be unavailable</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">
                  Total Actions
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{compliance}%</div>
                <div className="text-xs text-muted-foreground">
                  Compliance Rate
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{avgLatency}ms</div>
                <div className="text-xs text-muted-foreground">
                  Avg Response
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{critical}</div>
                <div className="text-xs text-muted-foreground">
                  Critical Issues
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Security Architecture */}
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold text-sm">Security Architecture</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { icon: Fingerprint, label: "Auth", value: "SIWE + JWT with nonce replay" },
              { icon: Lock, label: "API Keys", value: "scrypt hashed, scoped permissions" },
              { icon: Shield, label: "Rate Limiting", value: "3 layers (global, workspace, per-key)" },
              { icon: Lock, label: "Encryption", value: "Fhenix FHE on-chain evaluation" },
              { icon: Shield, label: "Audit", value: "Immutable on Filecoin / 0G" },
              { icon: Shield, label: "Contract Audit", value: "ChainGPT scan on recipients" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Icon className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">{label}:</span>{" "}
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Timeline */}
      {!error && logs.length === 0 && !isLoading ? (
        <div className="p-12 text-center border rounded-xl">
          <FileSearch className="h-8 w-8 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="font-medium">No audit logs yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Activity will appear here as governed agents execute spends. Register an agent and run a governance check to see your first audit entry.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" onClick={() => router.push("/governance/check")}>
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run a Check
            </Button>
            <Button variant="outline" onClick={() => router.push("/agents/workshop")}>
              <Users className="h-3.5 w-3.5 mr-1.5" /> Register Agent
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, idx) => (
            <AuditLogRow
              key={log.id}
              log={log}
              rawLog={Array.isArray(rawLogs) ? rawLogs[idx] : log}
            />
          ))}
        </div>
      )}
    </div>
  );
}
