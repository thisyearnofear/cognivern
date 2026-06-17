"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileSearch,
  PlayCircle,
  Shield,
  Lock,
  Fingerprint,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  Terminal,
  KeyRound,
  Link,
  AlertTriangle,
} from "lucide-react";
import { PermitDialog } from "./permit-dialog";
import { EventTimeline, type TimelineEvent } from "@/components/shared/event-timeline";
import { useRouter } from "next/navigation";
import { useAuditLogs } from "@/hooks/use-api";
import {
  normalizeAuditLogs,
  computeComplianceRate,
  computeAverageLatency,
  type NormalizedAuditLog,
} from "@/lib/normalizers";

/* ─── Terminal typewriter hook ───────────────────────────────── */

function useTypewriter(lines: string[], speed = 40, _initialDelay?: number) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentLine >= lines.length) {
        setDone(true);
        return;
      }
      const line = lines[currentLine];
      if (currentChar < line.length) {
        setDisplayed((prev) => {
          const copy = [...prev];
          if (copy.length <= currentLine) copy.push("");
          copy[currentLine] = line.slice(0, currentChar + 1);
          return copy;
        });
        setCurrentChar((c) => c + 1);
      } else {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }
    }, currentChar === 0 && currentLine > 0 ? speed * 8 : speed);
    return () => clearTimeout(timer);
  }, [currentLine, currentChar, lines, speed]);

  return { displayed, done };
}

/* ─── Helper: CheckItem ──────────────────────────────────────── */

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
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" aria-label="Passed" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" aria-label="Failed" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

/* ─── Detection helpers ──────────────────────────────────────── */

function hasConfidentialFhe(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== "object") return false;
  const r = rawLog as Record<string, unknown>;
  const conf = r.confidential as Record<string, unknown> | undefined;
  if (conf?.fheEvaluated === true) return true;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) =>
        (c.metadata as Record<string, unknown> | undefined)?.confidential === true ||
        (c.metadata as Record<string, unknown> | undefined)?.fheEvaluated === true,
    );
  }
  return false;
}

function hasChainGptAudit(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== "object") return false;
  const r = rawLog as Record<string, unknown>;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) => (c.metadata as Record<string, unknown> | undefined)?.chaingptAudit === true,
    );
  }
  return false;
}

function hasLedgerSigning(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== "object") return false;
  return (rawLog as Record<string, unknown>).signingProvider === "ledger";
}

function getOnChainTxHash(rawLog: unknown): string | null {
  if (!rawLog || typeof rawLog !== "object") return null;
  const r = rawLog as Record<string, unknown>;

  // Check top-level txHash
  if (typeof r.txHash === "string" && r.txHash.length > 10) return r.txHash;

  // Check artifacts (from run ledger)
  const artifacts = r.artifacts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(artifacts)) {
    for (const art of artifacts) {
      const data = art.data as Record<string, unknown> | undefined;
      if (data && typeof data.txHash === "string" && data.txHash.length > 10) {
        return data.txHash;
      }
    }
  }

  return null;
}

function getPolicyId(rawLog: unknown): string | null {
  if (!rawLog || typeof rawLog !== "object") return null;
  const r = rawLog as Record<string, unknown>;
  if (typeof r.policyId === "string" && r.policyId.length > 0) return r.policyId;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks) && checks.length > 0 && typeof checks[0].policyId === "string") {
    return checks[0].policyId as string;
  }
  return null;
}

interface AnchoringData {
  fhenixStatus: "resolved" | "pending" | null;
  filecoinCid: string | null;
  filecoinTxHash: string | null;
  zeroGRootHash: string | null;
  evidenceHash: string | null;
}

function getAnchoringData(rawLog: unknown): AnchoringData | null {
  if (!rawLog || typeof rawLog !== "object") return null;
  const r = rawLog as Record<string, unknown>;
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const conf = r.confidential as Record<string, unknown> | undefined;

  const filecoinCid = (evidence?.filecoinCid as string) || null;
  const filecoinTxHash = (evidence?.filecoinTxHash as string) || null;
  const zeroGRootHash = (evidence?.zeroGRootHash as string) || null;
  const evidenceHash = (evidence?.hash as string) || null;

  let fhenixStatus: "resolved" | "pending" | null = null;
  if (conf) {
    const decisionIds = conf.decisionIds as string[] | undefined;
    if (decisionIds && decisionIds.length > 0) {
      fhenixStatus = conf.resolved === true ? "resolved" : "pending";
    }
  }

  if (!filecoinCid && !zeroGRootHash && !fhenixStatus && !evidenceHash) return null;
  return { fhenixStatus, filecoinCid, filecoinTxHash, zeroGRootHash, evidenceHash };
}

interface SuspicionData {
  composite: number;
  label: string;
  dimensions: Record<string, number>;
  escalated: boolean;
  reasoning: string[];
}

function getSuspicionData(rawLog: unknown): SuspicionData | null {
  if (!rawLog || typeof rawLog !== "object") return null;
  const r = rawLog as Record<string, unknown>;
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const suspicion = evidence?.suspicion as Record<string, unknown> | undefined;
  if (!suspicion || typeof suspicion.composite !== "number") return null;
  return {
    composite: suspicion.composite,
    label: String(suspicion.label || "unknown"),
    dimensions: (suspicion.dimensions as Record<string, number>) || {},
    escalated: suspicion.escalated === true,
    reasoning: Array.isArray(suspicion.reasoning) ? suspicion.reasoning.map(String) : [],
  };
}

/* ─── Timeline Node ──────────────────────────────────────────── */

function TimelineNode({
  log,
  rawLog,
  index,
}: {
  log: NormalizedAuditLog;
  rawLog: unknown;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [permitOpen, setPermitOpen] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const isFhe = hasConfidentialFhe(rawLog);
  const isChainGpt = hasChainGptAudit(rawLog);
  const isLedger = hasLedgerSigning(rawLog);
  const hasChecks = log.policyChecks.length > 0;
  const txHash = getOnChainTxHash(rawLog);
  const policyId = getPolicyId(rawLog);
  const anchoring = getAnchoringData(rawLog);
  const suspicion = getSuspicionData(rawLog);

  useEffect(() => {
    if (!expanded || timelineEvents.length > 0 || timelineLoading) return;
    const id = window.setTimeout(() => setTimelineLoading(true), 0);
    fetch(`/api/audit/logs/${log.id}/timeline`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.events) {
          setTimelineEvents(json.data.events);
        }
      })
      .catch(() => {})
      .finally(() => setTimelineLoading(false));
    return () => window.clearTimeout(id);
  }, [expanded, log.id, timelineEvents.length, timelineLoading]);

  const statusColor =
    log.decision === "approved"
      ? "bg-emerald-500"
      : log.decision === "denied"
        ? "bg-red-500"
        : "bg-amber-500";

  const statusRingColor =
    log.decision === "approved"
      ? "ring-emerald-500/30"
      : log.decision === "denied"
        ? "ring-red-500/30"
        : "ring-amber-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      className="relative pl-10 sm:pl-12 pb-4"
    >
      {/* Vertical line */}
      <div className="absolute left-[15px] sm:left-[19px] top-3 bottom-0 w-px bg-border" />

      {/* Status dot */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`absolute left-[9px] sm:left-[13px] top-[5px] w-[13px] h-[13px] rounded-full ring-4 ${statusRingColor} ring-background z-10 cursor-pointer ${statusColor}`}
        aria-label={`${log.decision} decision`}
      />

      {/* Content */}
      <div
        className="rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Agent + badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium text-sm text-foreground">
                  {log.agent}
                </span>
                <Badge variant="outline" className="text-xs">
                  {log.action}
                </Badge>
                {isFhe && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    FHE
                  </span>
                )}
                {isChainGpt && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Audit
                  </span>
                )}
                {isLedger && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    <Fingerprint className="h-2.5 w-2.5" />
                    Hardware
                  </span>
                )}
                {txHash && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700">
                    <ExternalLink className="h-2.5 w-2.5" />
                    On-Chain
                  </span>
                )}
                {suspicion && suspicion.label !== "normal" && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                    suspicion.label === "critical"
                      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
                      : suspicion.label === "high"
                        ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700"
                        : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                  }`}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {suspicion.label === "critical" ? "Critical" : suspicion.label === "high" ? "Suspicious" : "Score"}: {suspicion.composite.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="text-xs text-muted-foreground mb-2">
                {log.description || log.action}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
                <span className="font-mono">{log.id.slice(0, 8)}</span>
                <span>{log.chain}</span>
                <span>{log.time}</span>
                {log.latency !== "—" && (
                  <span className="font-mono">{log.latency}</span>
                )}
              </div>
            </div>

            {/* Decision badge + expand */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant={
                  log.decision === "approved"
                    ? "secondary"
                    : log.decision === "denied"
                      ? "destructive"
                      : "outline"
                }
                className="text-xs capitalize"
              >
                {log.decision}
              </Badge>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-4 pt-3 border-t border-border space-y-3">
              {/* Decision metadata */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Decision ID: <code className="font-mono text-foreground/70">{log.id}</code>
                </span>
                <span>
                  Timestamp: <span className="text-foreground/70">{log.timestamp}</span>
                </span>
              </div>

              {/* On-chain tx link */}
              {txHash && (
                <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300">
                    <ExternalLink className="h-3.5 w-3.5" />
                    On-Chain Governance Record
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This decision was recorded on X Layer via{" "}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono">
                      GovernanceContract.evaluateAction()
                    </code>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-foreground/70 truncate">
                      {txHash.slice(0, 18)}...{txHash.slice(-6)}
                    </code>
                    <a
                      href={`https://www.oklink.com/xlayer-test/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                    >
                      View on X Layer <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* FHE detail */}
              {isFhe && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Encrypted Policy Evaluation (Fhenix FHE)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Spend limit evaluated via Fhenix FHE. Your policy thresholds were never
                    exposed — not to the network, not to the evaluator.
                  </p>
                  {(() => {
                    const raw = rawLog as Record<string, unknown>;
                    const conf = raw.confidential as Record<string, unknown> | undefined;
                    const ids = conf?.decisionIds as string[] | undefined;
                    if (ids && ids.length > 0) {
                      return (
                        <a
                          href={`https://explorer.fhenix.zone/tx/${ids[0]}`}
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
                  {policyId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPermitOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors border border-amber-200 dark:border-amber-700"
                    >
                      <KeyRound className="h-3 w-3" />
                      Request Auditor Permit
                    </button>
                  )}
                </div>
              )}

              {/* ChainGPT detail */}
              {isChainGpt && (
                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Contract Audited by ChainGPT
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The target contract was scanned at runtime. Vulnerabilities would have
                    triggered a deny or hold decision.
                  </p>
                </div>
              )}

              {/* Per-rule breakdown */}
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

              {/* Cross-Chain Anchoring */}
              {anchoring && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Cross-Chain Anchoring
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    {anchoring.fhenixStatus && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <ShieldCheck className={`h-3 w-3 flex-shrink-0 ${anchoring.fhenixStatus === "resolved" ? "text-emerald-500" : "text-amber-500"}`} />
                        <span className="text-muted-foreground">Fhenix CoFHE:</span>
                        <Badge
                          variant={anchoring.fhenixStatus === "resolved" ? "secondary" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {anchoring.fhenixStatus}
                        </Badge>
                      </div>
                    )}
                    {anchoring.filecoinCid && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Link className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground">Filecoin:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.filecoinCid.slice(0, 20)}...
                        </code>
                        {anchoring.filecoinTxHash && (
                          <a
                            href={`https://calibration.filfox.info/en/tx/${anchoring.filecoinTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                    {anchoring.zeroGRootHash && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Shield className="h-3 w-3 text-teal-500 flex-shrink-0" />
                        <span className="text-muted-foreground">0G Storage:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.zeroGRootHash.slice(0, 20)}...
                        </code>
                      </div>
                    )}
                    {anchoring.evidenceHash && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Fingerprint className="h-3 w-3 text-slate-400 flex-shrink-0" />
                        <span className="text-muted-foreground">Evidence Hash:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.evidenceHash.slice(0, 16)}...{anchoring.evidenceHash.slice(-6)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Suspicion Analysis */}
              {suspicion && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Suspicion Analysis
                  </div>
                  <div className={`rounded-lg border p-3 space-y-2 ${
                    suspicion.escalated
                      ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                      : "border-border bg-muted/20"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${
                          suspicion.label === "critical" ? "text-red-500" : suspicion.label === "high" ? "text-orange-500" : suspicion.label === "elevated" ? "text-amber-500" : "text-muted-foreground"
                        }`} />
                        <span className="font-medium capitalize">{suspicion.label}</span>
                        <span className="text-muted-foreground">({suspicion.composite.toFixed(3)})</span>
                      </div>
                      {suspicion.escalated && (
                        <Badge variant="destructive" className="text-[10px]">Escalated</Badge>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          suspicion.label === "critical" ? "bg-red-500" : suspicion.label === "high" ? "bg-orange-500" : suspicion.label === "elevated" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, suspicion.composite * 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {Object.entries(suspicion.dimensions).map(([dim, val]) => (
                        <div key={dim} className="flex items-center justify-between">
                          <span className="text-muted-foreground capitalize">
                            {dim.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="font-mono">
                            {typeof val === "number" ? val.toFixed(2) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {suspicion.reasoning.length > 0 && (
                      <ul className="space-y-0.5">
                        {suspicion.reasoning.map((r, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Decision Replay Timeline */}
              {timelineEvents.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Decision Replay
                  </div>
                  <EventTimeline
                    events={timelineEvents}
                    title="Decision steps"
                    compact
                  />
                </div>
              )}

              {!hasChecks && !isFhe && !isChainGpt && !txHash && !anchoring && !suspicion && timelineEvents.length === 0 && (
                <div className="text-xs text-muted-foreground py-1">
                  No additional decision details available.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {policyId && (
        <PermitDialog
          open={permitOpen}
          onOpenChange={setPermitOpen}
          decisionId={log.id}
          policyId={policyId}
        />
      )}
    </motion.div>
  );
}

/* ─── Empty state with terminal typewriter ───────────────────── */

function EmptyAuditState({ onRunCheck }: { onRunCheck: () => void }) {
  const terminalLines = [
    "$ curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \\",
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"agentId":"demo","action":{"type":"spend","metadata":{"amount":50}}}\'',
    "",
    "→ Waiting for first agent action...",
    "→ No audit logs yet.",
    "→ Create an API identity or run a check to get started.",
  ];

  const { displayed: terminalOutput, done: terminalDone } = useTypewriter(terminalLines, 30, 400);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-6 sm:p-8 text-center space-y-4">
        <div className="max-w-md mx-auto">
          {/* Terminal widget */}
          <div className="rounded-lg border border-border bg-[#0A0A0A] dark:bg-black overflow-hidden text-left mb-6 shadow-lg">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-[10px] text-white/40 font-medium">cognivern — audit</span>
            </div>
            <pre
              className="p-4 text-sm leading-relaxed text-white/80 min-h-[120px]"
              style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
            >
              {terminalOutput.map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line.startsWith("→") ? (
                    <span className="text-amber-400/90">{line}</span>
                  ) : line.startsWith("$") ? (
                    <span>
                      <span className="text-emerald-400">$</span>
                      {line.slice(1)}
                    </span>
                  ) : (
                    line
                  )}
                </div>
              ))}
              {!terminalDone && (
                <span className="inline-block w-2 h-4 bg-white/60 ml-0.5 animate-pulse" />
              )}
            </pre>
          </div>

          <FileSearch className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium text-foreground">No audit logs yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activity will appear here as governed systems execute spends.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="default" size="sm" onClick={onRunCheck}>
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run a Check
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open("/agents/workshop", "_self")}>
            <Terminal className="h-3.5 w-3.5 mr-1.5" /> Create API Identity
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main audit page ────────────────────────────────────────── */

export function AuditPage() {
  const router = useRouter();
  const { data: rawLogs, isLoading, error } = useAuditLogs();

  const logs = normalizeAuditLogs(rawLogs);
  const total = logs.length;
  const compliance = computeComplianceRate(logs);
  const avgLatency = computeAverageLatency(logs);
  const critical = logs.filter((l) => l.decision === "denied").length;
  const onChainCount = Array.isArray(rawLogs)
    ? rawLogs.filter((r) => getOnChainTxHash(r) !== null).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete governance audit trail — every decision recorded on-chain
        </p>
      </div>

      {/* Metrics — seamless gap-px grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded-xl border border-border animate-pulse bg-card" />
          ))}
        </div>
      ) : error ? (
        <div className="col-span-4 p-8 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load audit logs</p>
          <p className="text-xs mt-1">The backend may be unavailable</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
          <div className="bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 flex-shrink-0">
              <FileSearch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {total}
              </div>
              <div className="text-xs text-muted-foreground">Total Actions</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {compliance}%
              </div>
              <div className="text-xs text-muted-foreground">Compliance Rate</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 flex-shrink-0">
              <Clock className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {avgLatency}ms
              </div>
              <div className="text-xs text-muted-foreground">Avg Response</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950 flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {critical}
              </div>
              <div className="text-xs text-muted-foreground">Critical Issues</div>
            </div>
          </div>
        </div>
      )}

      {/* Security Architecture — inline banner */}
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold text-sm" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Security Architecture
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
          {[
            { icon: Fingerprint, label: "Auth", value: "SIWE + JWT with nonce replay" },
            { icon: Lock, label: "API Keys", value: "scrypt hashed, scoped permissions" },
            { icon: Shield, label: "Rate Limiting", value: "3 layers (global, workspace, per-key)" },
            { icon: Lock, label: "Encryption", value: "Fhenix FHE on-chain evaluation" },
            { icon: Shield, label: "Audit", value: "Immutable on 0G + X Layer" },
            { icon: Shield, label: "Contract Audit", value: "ChainGPT scan on recipients" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>
                <span className="font-medium text-foreground">{label}:</span> {value}
              </span>
            </div>
          ))}
        </div>
        {onChainCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            {onChainCount} of {total} decisions have on-chain proof on X Layer
          </div>
        )}
      </div>

      {/* Decision Timeline */}
      {!error && logs.length === 0 && !isLoading ? (
        <EmptyAuditState onRunCheck={() => router.push("/governance/check")} />
      ) : (
        <div className="pt-2">
          {logs.map((log, idx) => (
            <TimelineNode
              key={log.id}
              log={log}
              rawLog={Array.isArray(rawLogs) ? rawLogs[idx] : log}
              index={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}
