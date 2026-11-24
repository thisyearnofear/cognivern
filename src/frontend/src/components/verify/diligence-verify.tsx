"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  whyLabel,
  type DiligenceDecision,
  type PublicDiligenceReport,
} from "@/lib/diligence-report";
import { ChipGroup, ProofSummary, ReceiptRow, ReplayStatus } from "./proof-replay";
import { proofFromDiligenceReport } from "@/lib/proof";

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
  { className: string; label: string }
> = {
  proceed: {
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    label: "proceed",
  },
  hold: {
    className: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    label: "hold",
  },
  reject: { className: "border-destructive/40 text-destructive", label: "reject" },
};

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
          <ProofSummary proof={proofFromDiligenceReport(report)} />
          {/* ── Provenance ── */}
          <p className="order-1 text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toUTCString()} · {report.network} ·{" "}
            {report.cases.length} fixed cases · specialist spend cap{" "}
            {money(report.spendCapUsd)}
          </p>

          {/* ── Replay status: the alone → governed diff, as badges ── */}
          <div className="order-2 sm:order-3">
            <ReplayStatus>
              {(() => {
                const aloneDecision = perModel?.alone.errored
                  ? null
                  : (perModel?.alone.decision ?? null);
                const governedDecision = perModel?.governed.finalDecision ?? null;
                const same = aloneDecision === governedDecision;
                return (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {same ? (
                      <>
                        <span className="text-muted-foreground">Both decided</span>
                        <DecisionBadge decision={governedDecision} />
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Alone</span>
                        <DecisionBadge decision={aloneDecision} />
                        <ArrowRight
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="text-muted-foreground">Governed</span>
                        <DecisionBadge decision={governedDecision} />
                      </>
                    )}
                    <span className="text-muted-foreground">
                      · Specialist cost: {money(caseResult.evidence.specialistSpendUsd)}
                    </span>
                  </span>
                );
              })()}
            </ReplayStatus>
          </div>

          {/* ── Controls ── */}
          <div className="order-4 space-y-4 rounded-xl border border-border bg-card p-5 sm:order-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
              <ChipGroup
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
                <ChipGroup
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
              <ChipGroup
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
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (replaying) {
                      setReplaying(false);
                    } else {
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

          {/* ── Decision card ── */}
          <div
            key={view}
            className="order-3 rounded-xl border border-border bg-card p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-150"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground">
                {view === "alone"
                  ? `What ${activeModel?.label ?? "the model"} decided alone`
                  : "What the governed arm decided"}
              </div>
              <DecisionBadge
                decision={
                  view === "alone"
                    ? perModel?.alone.decision
                    : perModel?.governed.finalDecision
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Fixture policy: {caseResult.expectedDecision}
              </span>
              {(() => {
                const correct =
                  view === "alone" ? perModel?.alone.correct : perModel?.governed.correct;
                const decision =
                  view === "alone" ? perModel?.alone.decision : perModel?.governed.finalDecision;
                return (
                  <>
                    {correct === true ? (
                      <Check className="h-4 w-4 text-emerald-500" aria-label="matches fixture policy" />
                    ) : correct === false ? (
                      <X className="h-4 w-4 text-destructive" aria-label="differs from fixture policy" />
                    ) : null}
                    {correct === false &&
                      decision === "hold" &&
                      caseResult.expectedDecision === "proceed" && (
                        <span className="text-xs text-muted-foreground">
                          · more conservative than the fixture policy
                        </span>
                      )}
                  </>
                );
              })()}
            </div>

            {(() => {
              const rationale =
                view === "alone" ? perModel?.alone.rationale : perModel?.governed.rationale;
              return rationale ? (
                <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                  “{rationale}”
                </blockquote>
              ) : null;
            })()}

            {view === "governed" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Decided by {perModel ? decidedByLabel(perModel.governed.decidedBy) : "—"} ·{" "}
                {whyLabel(caseResult.gate)}
              </p>
            )}
            {perModel && (
              <TokenCost
                inputTokens={
                  view === "alone" ? perModel.alone.inputTokens : perModel.governed.inputTokens
                }
                outputTokens={
                  view === "alone" ? perModel.alone.outputTokens : perModel.governed.outputTokens
                }
                costUsd={view === "alone" ? perModel.alone.costUsd : perModel.governed.costUsd}
              />
            )}
          </div>

          {/* ── Purchased evidence (governed arm only) ── */}
          {view === "governed" && (
            <div className="order-5 rounded-xl border border-border bg-card p-5">
              <div className="font-semibold text-foreground">Purchased evidence</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Each step screens the supplier first; the parent specialist is
                only bought when the screen allows it.
              </p>
              <ol className="mt-3 space-y-4">
                {caseResult.evidence.steps.map((step) => {
                  const parent =
                    step.step === 1
                      ? report.specialists.registry
                      : report.specialists.vendorVerify;
                  return (
                    <li key={step.step} className="text-sm">
                      <div>
                        Screen (miner {step.screenMinerId ?? "?"}):{" "}
                        <span className="font-medium">{step.verdict ?? "no verdict"}</span>
                        {" → "}Bought: {parentLabel(parent?.intent)}:{" "}
                        <span className="font-medium">
                          {step.parentPurchased
                            ? "purchased"
                            : step.settlementStatus === "held" || step.status === "held"
                              ? "held for review"
                              : "not purchased"}
                        </span>
                        {typeof step.costUsd === "number" && (
                          <span className="text-muted-foreground"> · {money(step.costUsd)}</span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-1 pl-4">
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
                    </li>
                  );
                })}
              </ol>
              {caseResult.evidence.escalations.length > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Sent to a human: {caseResult.evidence.escalations.length} item(s) in
                  the approval inbox.
                </div>
              )}
            </div>
          )}

          {/* ── Ground truth ── */}
          <div className="order-6 rounded-xl border border-border bg-muted/30 p-5 text-sm">
            <div className="font-semibold text-foreground">Ground truth</div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              {caseResult.groundTruth.assertion}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Source: {caseResult.groundTruth.source} · checked{" "}
              {caseResult.groundTruth.checkedAt}
            </p>
          </div>

          {/* ── Summary across models ── */}
          <div className="order-7 rounded-xl border border-border bg-card p-5">
            <div className="font-semibold text-foreground">Summary</div>
            {/* Decision matrix: alone → governed per supplier per model; amber = changed */}
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
                        return (
                          <td key={m.label} className="py-2 pr-4">
                            <span
                              title={
                                pm.decisionChanged
                                  ? "Governance changed this decision"
                                  : undefined
                              }
                              className={
                                pm.decisionChanged
                                  ? "rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300"
                                  : "text-muted-foreground"
                              }
                            >
                              {alone} → {pm.governed.finalDecision}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 overflow-x-auto">
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
          <div className="order-8 rounded-xl border border-border bg-muted/30 p-5 text-sm">
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
