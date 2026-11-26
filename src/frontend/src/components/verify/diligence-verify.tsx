"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileSearch,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isValidReportId,
  parsePublicDiligenceReport,
  settlementExplorerUrl,
  whyLabel,
  type DiligenceDecision,
  type PublicDiligenceReport,
} from "@/lib/diligence-report";
import { ProofSummary, ReceiptRow, Reveal } from "./proof-replay";
import { proofFromDiligenceReport } from "@/lib/proof";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { AnimatedValue } from "@/components/primitives/animated-value";
import { playStamp, primeTactileSound } from "@/lib/tactile-sound";

/**
 * Public, login-free replay of a published supplier-diligence report.
 *
 * The runner writes a redacted report JSON to
 * /evidence/diligence/<id>.json; this page lets anyone step through the
 * "model alone vs model + governance + specialist evidence" comparison —
 * same supplier, same model, two arms. Nothing is recomputed and no
 * fixture/sample data is ever shown as a result.
 */

const RUN_IT_YOURSELF_URL =
  "https://github.com/thisyearnofear/cognivern/blob/main/tooling/scripts/agents/telegraph-diligence.ts";

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid-id" }
  | { kind: "not-found" }
  | { kind: "parse-failure" }
  | { kind: "network-error" }
  | { kind: "loaded"; report: PublicDiligenceReport };

const DECISION_STYLE: Record<
  DiligenceDecision,
  { className: string; cellClassName: string; label: string }
> = {
  proceed: {
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    cellClassName:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    label: "proceed",
  },
  hold: {
    className: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    cellClassName:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    label: "hold",
  },
  reject: {
    className: "border-destructive/40 text-destructive",
    cellClassName:
      "bg-destructive/10 text-destructive border-destructive/30",
    label: "reject",
  },
};

/** Fill chip used inside the decision matrix — color carries the verdict. */
function DecisionCellChip({ decision }: { decision: string }) {
  const style = DECISION_STYLE[decision as DiligenceDecision];
  const label = style?.label ?? decision;
  return (
    <span
      className={`inline-block rounded border px-1.5 py-px text-[10px] font-semibold leading-4 ${
        style?.cellClassName ?? "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function decidedByLabel(decidedBy: string): string {
  switch (decidedBy) {
    case "compliance_gate":
      return "compliance gate";
    case "review_hold":
      return "human-review hold";
    case "model":
      return "model";
    case "model_unparseable":
      return "model (unparseable output → hold)";
    default:
      return decidedBy;
  }
}

function parentLabel(intent: string | undefined): string {
  return intent === "CORPORATE_REGISTRY_LOOKUP"
    ? "registry lookup"
    : intent === "VENDOR_VERIFY"
      ? "vendor verification"
      : (intent ?? "specialist call").toLowerCase();
}

function money(value: number | null | undefined): string {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "not priced";
}

function shorten(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function TokenCost({
  inputTokens,
  outputTokens,
  costUsd,
}: {
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number | null;
}) {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Tokens: {inputTokens ?? 0} in / {outputTokens ?? 0} out · Cost:{" "}
      {money(costUsd)}
    </p>
  );
}

/**
 * First (model, case) pair where governance changed the decision — scanned
 * model-major so the lead model's flip wins when several exist. Used to land
 * the reader on an interesting cell instead of the first row.
 */
function firstChangedCell(report: PublicDiligenceReport): {
  caseIndex: number;
  modelLabel: string;
} | null {
  for (const m of report.models) {
    if (m.skipped) continue;
    for (let i = 0; i < report.cases.length; i++) {
      if (report.cases[i].perModel.find((r) => r.label === m.label)?.decisionChanged) {
        return { caseIndex: i, modelLabel: m.label };
      }
    }
  }
  return null;
}

/**
 * One arm of the alone|governed compare — title, decision badge, fixture
 * check, rationale quote, then arm-specific footnotes (tokens, gate path).
 */
function ArmCard({
  title,
  decision,
  expectedDecision,
  correct,
  rationale,
  footer,
}: {
  title: string;
  decision: string | null;
  expectedDecision: string;
  correct?: boolean | null;
  rationale?: string | null;
  footer?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <DecisionBadge decision={decision} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Fixture policy: {expectedDecision}
        </span>
        {correct === true ? (
          <Check className="h-4 w-4 text-emerald-500" aria-label="matches fixture policy" />
        ) : correct === false ? (
          <X className="h-4 w-4 text-destructive" aria-label="differs from fixture policy" />
        ) : null}
        {correct === false && decision === "hold" && expectedDecision === "proceed" && (
          <span className="text-xs text-muted-foreground">
            · more conservative than the fixture policy
          </span>
        )}
      </div>
      {rationale && (
        <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
          “{rationale}”
        </blockquote>
      )}
      {footer}
    </div>
  );
}

/** Decision pill used by the diff banner and the decision card. */
function DecisionBadge({ decision }: { decision?: string | null }) {
  const style = decision && DECISION_STYLE[decision as DiligenceDecision];
  if (style) {
    return (
      <Badge variant="outline" className={`text-xs px-2 py-0.5 ${style.className}`}>
        {style.label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs px-2 py-0.5">
      {decision === "unparseable" ? "no usable answer" : "no result"}
    </Badge>
  );
}

export function DiligenceVerify({ initialReportId }: { initialReportId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idInput, setIdInput] = useState(initialReportId || "supplier-diligence");
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [caseIndex, setCaseIndex] = useState(() => {
    const raw = Number(searchParams.get("case"));
    return Number.isInteger(raw) && raw >= 0 ? raw : 0;
  });
  const [modelLabel, setModelLabel] = useState<string | null>(
    () => searchParams.get("model"),
  );
  const [view, setView] = useState<"alone" | "governed">(() =>
    searchParams.get("view") === "governed" ? "governed" : "alone",
  );
  const [replaying, setReplaying] = useState(false);
  const replayStampKey = useRef<string | null>(null);
  // Captured once: whether the URL carried a cell selection. Not a dep of
  // `load` — a live searchParams dep makes load() refire on every
  // router.replace, and each refire unmounts the report tree mid-animation.
  const hadCellParams = useRef(
    Boolean(searchParams.get("case") || searchParams.get("model")),
  );

  const load = useCallback(async (rawId: string) => {
    const id = rawId.trim();
    if (!isValidReportId(id)) {
      setState({ kind: "invalid-id" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/evidence/diligence/${encodeURIComponent(id)}.json`);
      if (res.status === 404) {
        setState({ kind: "not-found" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "network-error" });
        return;
      }
      const parsed = parsePublicDiligenceReport(await res.json().catch(() => null));
      setState(parsed ? { kind: "loaded", report: parsed } : { kind: "parse-failure" });
      // Clamp the case index when a different report loads; unknown model
      // labels already fall back to the first runnable model via `activeModel`.
      setCaseIndex((i) => (parsed && i >= parsed.cases.length ? 0 : i));
      // With no deep-link params, land on a cell where governance changed the
      // decision rather than the first row.
      if (parsed && !hadCellParams.current) {
        const cell = firstChangedCell(parsed);
        if (cell) {
          setCaseIndex(cell.caseIndex);
          setModelLabel(cell.modelLabel);
        }
      }
    } catch {
      setState({ kind: "network-error" });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load(initialReportId || "supplier-diligence"));
  }, [initialReportId, load]);

  const report = state.kind === "loaded" ? state.report : null;
  const runnableModels = useMemo(
    () => (report ? report.models.filter((m) => !m.skipped) : []),
    [report],
  );
  const activeModel = useMemo(() => {
    if (!report || runnableModels.length === 0) return null;
    return runnableModels.find((m) => m.label === modelLabel) ?? runnableModels[0];
  }, [report, runnableModels, modelLabel]);

  const caseResult = report?.cases[caseIndex] ?? null;
  const perModel = useMemo(() => {
    if (!caseResult || !activeModel) return null;
    return caseResult.perModel.find((r) => r.label === activeModel.label) ?? null;
  }, [caseResult, activeModel]);

  const aloneDecision = perModel?.alone.errored
    ? null
    : (perModel?.alone.decision ?? null);
  const governedDecision = perModel?.governed.finalDecision ?? null;

  // Stat hero: the whole report in one line.
  const heroStats = useMemo(() => {
    if (!report) return null;
    const totalChanged = report.summary.perModel.reduce(
      (n, m) => n + m.decisionsChanged,
      0,
    );
    return {
      totalChanged,
      models: runnableModels.length,
      suppliers: report.cases.length,
      escalations: report.summary.run.escalations,
    };
  }, [report, runnableModels.length]);

  const reduceMotion = useReducedMotion();
  const compareRef = useRef<HTMLDivElement | null>(null);

  // Shareable deep link: /verify?report=<id>&case=<n>&model=<label>&view=<arm>
  useEffect(() => {
    if (!report) return;
    const params = new URLSearchParams();
    params.set("report", report.id);
    params.set("case", String(caseIndex));
    params.set("view", view);
    if (modelLabel) params.set("model", modelLabel);
    router.replace(`/verify?${params.toString()}`, { scroll: false });
  }, [report, caseIndex, view, modelLabel, router]);

  // "Watch the story" — step alone → governed → next supplier until the end.
  useEffect(() => {
    if (!replaying || !report) return;
    const t = setTimeout(() => {
      if (view === "alone") {
        setView("governed");
      } else if (caseIndex < report.cases.length - 1) {
        setCaseIndex((i) => i + 1);
        setView("alone");
      } else {
        setReplaying(false);
      }
    }, 2800);
    return () => clearTimeout(t);
  }, [replaying, view, caseIndex, report]);

  // Sound follows only the auto-replay's alone → governed verdict transition.
  // The key makes it once per supplier/model/replay pass, so scrubbing and
  // re-renders cannot turn the cue into a loop.
  useEffect(() => {
    if (!replaying || view !== "governed" || !governedDecision) return;
    const key = `${caseIndex}:${activeModel?.label ?? "none"}:${governedDecision}`;
    if (replayStampKey.current === key) return;
    replayStampKey.current = key;
    playStamp(
      governedDecision === "proceed"
        ? "approved"
        : governedDecision === "reject"
          ? "stopped"
          : "held",
    );
  }, [replaying, view, governedDecision, caseIndex, activeModel?.label]);

  const cta = (() => {
    if (!report || !caseResult) return null;
    if (view === "alone") {
      return {
        label: "Now governed",
        onClick: () => setView("governed"),
      };
    }
    if (caseIndex < report.cases.length - 1) {
      return {
        label: "Next supplier",
        onClick: () => {
          setCaseIndex((i) => i + 1);
          setView("alone");
        },
      };
    }
    return {
      label: "Start over",
      onClick: () => {
        setCaseIndex(0);
        setView("alone");
      },
    };
  })();

  return (
    <div>
      {/* ── Report id lookup ── */}
      <div className="mt-8 flex gap-2">
        <Input
          value={idInput}
          onChange={(e) => setIdInput(e.target.value)}
          placeholder="Report id (default: supplier-diligence)"
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push(`/verify?report=${encodeURIComponent(idInput.trim())}`);
              void load(idInput);
            }
          }}
        />
        <Button
          onClick={() => {
            router.push(`/verify?report=${encodeURIComponent(idInput.trim())}`);
            void load(idInput);
          }}
          disabled={state.kind === "loading" || !idInput.trim()}
        >
          <FileSearch className="mr-1.5 h-4 w-4" /> Look up
        </Button>
      </div>

      {state.kind === "loading" && (
        <p className="mt-6 text-sm text-muted-foreground">Loading report…</p>
      )}
      {state.kind === "invalid-id" && (
        <p className="mt-6 text-sm text-destructive">
          That is not a valid report id.
        </p>
      )}
      {state.kind === "not-found" && (
        <p className="mt-6 text-sm text-destructive">
          No published report with that id yet.
        </p>
      )}
      {state.kind === "parse-failure" && (
        <p className="mt-6 text-sm text-destructive">
          That file is not a diligence report.
        </p>
      )}
      {state.kind === "network-error" && (
        <p className="mt-6 text-sm text-destructive">
          Could not load the report file.
        </p>
      )}

      {report && caseResult && (
        <div className="mt-8 flex flex-col gap-6">
          {/* ── Proof envelope (shared contract: asked/mandate/spent/decided) ── */}
          <Reveal>
            <ProofSummary proof={proofFromDiligenceReport(report)} />
          </Reveal>

          {/* ── Stat hero: the whole report in one line ── */}
          {heroStats && (
            <Reveal delay={0.05}>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    <AnimatedValue value={heroStats.totalChanged} minChars={1} />
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    decision{heroStats.totalChanged === 1 ? "" : "s"} changed by governance
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedValue value={heroStats.models} minChars={1} />
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    model vendors, same evidence
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedValue value={heroStats.escalations} minChars={1} />
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    item{heroStats.escalations === 1 ? "" : "s"} sent to a human
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toUTCString()} · {report.network} ·{" "}
            {report.cases.length} fixed cases · specialist spend cap{" "}
            {money(report.spendCapUsd)}
          </p>

          {/* ── Decision matrix: the story at a glance; cells select the comparator ── */}
          <Reveal delay={0.05}>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-foreground">
                  Decisions: alone → governed
                </div>
                <div className="text-xs text-muted-foreground">
                  pick a cell to inspect it below
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Supplier</th>
                      {runnableModels.map((m) => (
                        <th key={m.label} className="pb-2 pr-4 font-medium">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.cases.map((c, i) => (
                      <tr
                        key={c.id}
                        className={`border-t border-border ${i === caseIndex ? "bg-muted/40" : ""}`}
                      >
                        <td className="py-2 pr-4 font-medium">{c.supplier.name}</td>
                        {runnableModels.map((m) => {
                          const pm = c.perModel.find((r) => r.label === m.label);
                          if (!pm) {
                            return (
                              <td key={m.label} className="py-2 pr-4 text-muted-foreground">
                                —
                              </td>
                            );
                          }
                          const alone = pm.alone.errored
                            ? "error"
                            : pm.alone.decision === "unparseable"
                              ? "no answer"
                              : pm.alone.decision;
                          const selected =
                            i === caseIndex && m.label === activeModel?.label;
                          return (
                            <td key={m.label} className="py-2 pr-4">
                              <button
                                type="button"
                                title={
                                  pm.decisionChanged
                                    ? "Governance changed this decision"
                                    : `Inspect ${c.supplier.name} · ${m.label}`
                                }
                                aria-pressed={selected}
                                onClick={() => {
                                  setReplaying(false);
                                  setCaseIndex(i);
                                  setModelLabel(m.label);
                                  compareRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                }}
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  pm.decisionChanged
                                    ? "ring-1 ring-amber-500/60 bg-amber-500/5"
                                    : ""
                                } ${selected ? "bg-primary/10" : "hover:bg-muted/60"}`}
                              >
                                <DecisionCellChip decision={alone} />
                                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                                <DecisionCellChip
                                  decision={pm.governed.finalDecision ?? "—"}
                                />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>

          {/* ── Sticky context: what you're looking at right now ── */}
          <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-background/85 px-6 py-2 backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-medium text-foreground">
                {caseResult.supplier.name}
              </span>
              <span className="text-muted-foreground">
                {activeModel ? `${activeModel.provider} · ${activeModel.model ?? "?"}` : "no model"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DecisionBadge decision={aloneDecision} />
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                <DecisionBadge decision={governedDecision} />
              </span>
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
              <SegmentedControl
                id="diligence-supplier"
                label="Supplier"
                options={report.cases.map((c, i) => ({
                  value: String(i),
                  label: c.supplier.name,
                  changed: Boolean(
                    activeModel &&
                      c.perModel.find((r) => r.label === activeModel.label)
                        ?.decisionChanged,
                  ),
                }))}
                value={String(caseIndex)}
                onChange={(v) => {
                  setReplaying(false);
                  setCaseIndex(Number(v));
                  setView("alone");
                }}
              />
              {runnableModels.length > 0 ? (
                <SegmentedControl
                  id="diligence-model"
                  label="Model"
                  options={runnableModels.map((m) => ({
                    value: m.label,
                    label: `${m.provider} · ${m.model ?? "?"}`,
                    changed: Boolean(
                      caseResult.perModel.find((r) => r.label === m.label)
                        ?.decisionChanged,
                    ),
                  }))}
                  value={activeModel?.label ?? runnableModels[0].label}
                  onChange={(v) => {
                    setReplaying(false);
                    setModelLabel(v);
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No model has been run against this evidence yet — the governed
                  gate results below stand on their own.
                </p>
              )}
              {/* The alone/governed toggle only matters on narrow screens,
                  where the two arms stack; on sm+ both render side by side. */}
              <div className="sm:hidden">
                <SegmentedControl<"alone" | "governed">
                  id="diligence-view"
                  label="View"
                  options={[
                    { value: "alone", label: "Model alone" },
                    { value: "governed", label: "Governed" },
                  ]}
                  value={view}
                  onChange={(v) => {
                    setReplaying(false);
                    setView(v);
                  }}
                />
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (replaying) {
                      setReplaying(false);
                    } else {
                      replayStampKey.current = null;
                      primeTactileSound();
                      setCaseIndex(0);
                      setView("alone");
                      setReplaying(true);
                    }
                  }}
                >
                  {replaying ? (
                    <>
                      <Pause className="mr-1.5 h-4 w-4" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" /> Watch the story
                    </>
                  )}
                </Button>
                {cta && (
                  <Button
                    onClick={() => {
                      setReplaying(false);
                      cta.onClick();
                    }}
                  >
                    {cta.label}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Side-by-side compare: the model alone vs the same model governed ── */}
          <div ref={compareRef} className="relative scroll-mt-16">
            {perModel?.decisionChanged && (
              <motion.div
                key={`stamp-${caseIndex}-${activeModel?.label}`}
                initial={reduceMotion ? false : { opacity: 0, scale: 2.2, rotate: -16 }}
                animate={{ opacity: 1, scale: 1, rotate: -7 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 22, mass: 0.8 }
                }
                aria-hidden
                className="pointer-events-none absolute -top-2 right-2 z-10 inline-flex items-center rounded-md border-2 border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 shadow-sm"
              >
                Changed by governance
              </motion.div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Alone arm — hidden on mobile unless the serial view selects it */}
              <div
                className={`rounded-xl border border-border bg-card p-5 ${
                  view === "alone" ? "" : "hidden sm:block"
                }`}
              >
                <ArmCard
                  title={`What ${activeModel?.label ?? "the model"} decided alone`}
                  decision={aloneDecision}
                  expectedDecision={caseResult.expectedDecision}
                  correct={perModel?.alone.correct}
                  rationale={perModel?.alone.rationale}
                  footer={
                    perModel && (
                      <TokenCost
                        inputTokens={perModel.alone.inputTokens}
                        outputTokens={perModel.alone.outputTokens}
                        costUsd={perModel.alone.costUsd}
                      />
                    )
                  }
                />
              </div>
              {/* Governed arm — amber-tinted when governance changed the call */}
              <div
                className={`relative rounded-xl border p-5 ${
                  perModel?.decisionChanged
                    ? "border-amber-500/40 bg-amber-500/[0.04]"
                    : "border-border bg-card"
                } ${view === "governed" ? "" : "hidden sm:block"}`}
              >
                <ArmCard
                  title="What the governed arm decided"
                  decision={governedDecision}
                  expectedDecision={caseResult.expectedDecision}
                  correct={perModel?.governed.correct}
                  rationale={perModel?.governed.rationale}
                  footer={
                    <>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Decided by{" "}
                        {perModel ? decidedByLabel(perModel.governed.decidedBy) : "—"} ·{" "}
                        {whyLabel(caseResult.gate)}
                      </p>
                      {perModel && (
                        <TokenCost
                          inputTokens={perModel.governed.inputTokens}
                          outputTokens={perModel.governed.outputTokens}
                          costUsd={perModel.governed.costUsd}
                        />
                      )}
                    </>
                  }
                />
              </div>
            </div>
          </div>

          {/* ── Purchased evidence: each call a link in the chain ── */}
          <div
            className={`rounded-xl border border-border bg-card p-5 ${
              view === "governed" ? "" : "hidden sm:block"
            }`}
          >
              <div className="font-semibold text-foreground">Purchased evidence</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Each step screens the supplier first; the parent specialist is
                only bought when the screen allows it.
              </p>
              <ol className="mt-4 space-y-0">
                {caseResult.evidence.steps.map((step, stepIdx) => {
                  const parent =
                    step.step === 1
                      ? report.specialists.registry
                      : report.specialists.vendorVerify;
                  const last = stepIdx === caseResult.evidence.steps.length - 1;
                  const outcome = step.parentPurchased
                    ? "purchased"
                    : step.settlementStatus === "held" || step.status === "held"
                      ? "held for review"
                      : "not purchased";
                  return (
                    <li key={step.step} className="relative flex gap-3 pb-5 text-sm last:pb-0">
                      {/* Chain link: node + connector to the next call */}
                      <span className="flex flex-col items-center" aria-hidden>
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                            step.parentPurchased
                              ? "border-primary bg-primary/20"
                              : "border-amber-500 bg-amber-500/20"
                          }`}
                        />
                        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div>
                          Screen (miner {step.screenMinerId ?? "?"}):{" "}
                          <span className="font-medium">{step.verdict ?? "no verdict"}</span>
                          {" → "}Bought: {parentLabel(parent?.intent)}:{" "}
                          <span className="font-medium">{outcome}</span>
                          {typeof step.costUsd === "number" && (
                            <span className="text-muted-foreground"> · {money(step.costUsd)}</span>
                          )}
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {step.screeningRunId && (
                            <ReceiptRow label="Screen run" value={step.screeningRunId} />
                          )}
                          {step.gateRunId && (
                            <ReceiptRow label="Gate run" value={step.gateRunId} />
                          )}
                          {step.parentRunId && (
                            <ReceiptRow label="Parent run" value={step.parentRunId} />
                          )}
                          {step.evidenceHash && (
                            <ReceiptRow label="Evidence hash" value={step.evidenceHash} />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {(() => {
                  const settle = caseResult.evidence.settlement;
                  if (!settle) return null;
                  const txUrl = settlementExplorerUrl(settle);
                  const settled = settle.status === "settled";
                  const tone = settled
                    ? "border-emerald-500 bg-emerald-500/20"
                    : settle.status === "failed"
                      ? "border-red-500 bg-red-500/20"
                      : "border-amber-500 bg-amber-500/20";
                  return (
                    <li className="relative flex gap-3 pb-0 text-sm">
                      <span className="flex flex-col items-center" aria-hidden>
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${tone}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div>
                          Solana settlement:{" "}
                          <span className="font-medium">{settle.status}</span>
                          {typeof settle.amountUsd === "number" && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {money(settle.amountUsd)} USDC
                            </span>
                          )}
                          {settle.payee && (
                            <span className="text-muted-foreground">
                              {" "}
                              → {shorten(settle.payee)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {settle.signature && txUrl && (
                            <a
                              href={txUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                            >
                              tx {shorten(settle.signature)}{" "}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {settle.reason && (
                            <div className="text-xs text-muted-foreground">{settle.reason}</div>
                          )}
                          {settle.idempotentReplay && (
                            <div className="text-xs text-muted-foreground">
                              replayed recorded outcome (intentId {settle.intentId})
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })()}
              </ol>
              {caseResult.evidence.escalations.length > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Sent to a human: {caseResult.evidence.escalations.length} item(s) in
                  the approval inbox.
                </div>
              )}
            </div>

          {/* ── Ground truth ── */}
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
            <div className="font-semibold text-foreground">Ground truth</div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              {caseResult.groundTruth.assertion}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Source: {caseResult.groundTruth.source} · checked{" "}
              {caseResult.groundTruth.checkedAt}
            </p>
          </div>

          {/* ── Per-model results ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="font-semibold text-foreground">Per-model results</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">Cases</th>
                    <th className="pb-2 pr-4 font-medium">Alone correct</th>
                    <th className="pb-2 pr-4 font-medium">Governed correct</th>
                    <th className="pb-2 pr-4 font-medium">Decisions changed</th>
                    <th className="pb-2 font-medium">Model cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.perModel.map((m) => (
                    <tr key={m.label} className="border-t border-border">
                      <td className="py-2 pr-4 font-medium">{m.label}</td>
                      <td className="py-2 pr-4">{m.casesRun}</td>
                      <td className="py-2 pr-4">{m.aloneCorrect}</td>
                      <td className="py-2 pr-4">{m.governedCorrect}</td>
                      <td className="py-2 pr-4">{m.decisionsChanged}</td>
                      <td className="py-2">
                        {money(m.modelCostUsd.alone)} + {money(m.modelCostUsd.governed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Specialist spend: {money(report.summary.run.specialistSpendUsd)}
            </p>
          </div>

          {/* ── Honesty bounds + links ── */}
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
            <div className="font-semibold text-foreground">Honesty bounds</div>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              {report.honestyBounds.map((bound, i) => (
                <li key={i} className="flex gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  {bound}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <a
                href={`/evidence/diligence/${encodeURIComponent(report.id)}.json`}
                download
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="h-3 w-3" /> Download this report (JSON)
              </a>
              <a
                href={RUN_IT_YOURSELF_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Run it yourself <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
