"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
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
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuditLogs } from "@/hooks/use-api";
import {
  normalizeAuditLogs,
  computeComplianceRate,
  computeAverageLatency,
  type NormalizedAuditLog,
} from "@/lib/normalizers";

/* ─── Terminal typewriter hook ───────────────────────────────── */

function useTypewriter(lines: string[], speed = 40, startDelay = 600) {
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
  const isFhe = hasConfidentialFhe(rawLog);
  const isChainGpt = hasChainGptAudit(rawLog);
  const isLedger = hasLedgerSigning(rawLog);
  const hasChecks = log.policyChecks.length > 0;
  const txHash = getOnChainTxHash(rawLog);
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
                      href={`https://www.oklink.com/xlayer-testnet/tx/${txHash}`}
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

              {!hasChecks && !isFhe && !isChainGpt && !txHash && (
                <div className="text-xs text-muted-foreground py-1">
                  No additional decision details available.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
    "→ Register an agent or run a check to get started.",
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
            Activity will appear here as governed agents execute spends.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="default" size="sm" onClick={onRunCheck}>
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run a Check
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open("/agents/workshop", "_self")}>
            <Terminal className="h-3.5 w-3.5 mr-1.5" /> Register an Agent
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
            { icon: Shield, label: "Audit", value: "Immutable on Filecoin / 0G + X Layer" },
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
