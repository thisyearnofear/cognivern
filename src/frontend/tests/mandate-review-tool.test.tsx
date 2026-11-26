import "./helpers/local-storage";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  buildMandateReview,
  MandateReviewTool,
  type MandateReviewSnapshot,
  type MandateReviewResult,
} from "@/components/capital/mandate-review-tool";
import type {
  AllocationRecommendation,
  FundedMandate,
  FundedMandateStatement,
  MandateContext,
  OutcomeObservation,
} from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const WS_A = "ws-a";
const WS_B = "ws-b";

function fakeJwt(exp: number): string {
  const segment = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${segment({ alg: "none" })}.${segment({ sub: "u-1", exp })}.sig`;
}

const VALID_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
const EXPIRED_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) - 60);
const MALFORMED_TOKEN = "opaque-demo-token";

function mandate(id: string, workspaceId = WS_A): FundedMandate {
  return {
    id,
    workspaceId,
    name: `Mandate ${id}`,
    objective: "Screen prospective suppliers.",
    agentIds: [],
    status: "active",
    budget: { byAsset: {} },
    policyIds: [],
    successMetrics: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  } as FundedMandate;
}

function context(mandateId: string, workspaceId = WS_A): MandateContext {
  return {
    enabled: true,
    mandateId,
    collection: "c",
    syncedAt: "2026-11-20T00:00:00Z",
    syncStatus: "synced",
    query: "q",
    ingested: { mandate: 1, outcomes: 1, statements: 1, recommendations: 1, runs: 1 },
    chunks: [{ chunk_content: "RAW CHUNK MUST NOT LEAK" }],
    sources: [
      { id: "src-1", title: "Spend record", type: "run" },
      { id: "src-2", title: "Outcome observation" },
    ],
    provenance: [
      {
        kind: "run",
        label: "Run evidence",
        recordId: "run-rec-1",
        workspaceId,
        mandateId,
        timestamp: "2026-11-19T00:00:00Z",
      },
      { kind: "run", label: "Foreign workspace", workspaceId: WS_B, mandateId },
      { kind: "run", label: "Foreign mandate", workspaceId, mandateId: "m-other" },
    ],
    metrics: { mode: "fast", latencyMs: 1, hydraDbCalls: 1, resultCount: 2, routingReason: "test", estimatedCostUsd: 0 },
  } as MandateContext;
}

function recommendation(mandateId: string, workspaceId = WS_A): AllocationRecommendation {
  return {
    version: 1,
    mandateId,
    workspaceId,
    generatedAt: "2026-11-20T01:00:00Z",
    statementId: "st-1",
    status: "insufficient_evidence",
    evidenceCompleteness: {
      score: 0.4,
      outcomeCount: 1,
      outcomesWithEvidence: 1,
      verifiedOutcomeCount: 0,
      spendRecordCount: 2,
      verifiedSpendRecordCount: 0,
      blockers: ["no verified outcomes"],
    },
    operationalMetrics: { costPerObservedOutcomeByAsset: {}, verifiedOutcomeCount: 0 },
    recommendation: { stance: "hold", reasoning: ["Evidence is thin"] },
    governanceNote: "note",
  } as AllocationRecommendation;
}

function statement(mandateId: string, workspaceId = WS_A): FundedMandateStatement {
  return {
    version: 1,
    statementId: "st-1",
    mandate: mandate(mandateId, workspaceId),
    capital: {
      byAsset: {},
      walletSpendByAsset: {},
      cleanverseVerifiedSpendByAsset: {},
      cleanverseVerifiedShareOfConsumed: null,
    },
    performance: {
      outcomes: [],
      knownUnknowns: ["Did spend cause the outcome?"],
      evidenceCompleteness: {
        outcomeCount: 1,
        outcomesWithEvidence: 1,
        spendRecordCount: 2,
        spendRecordsWithTransactionEvidence: 1,
        cleanverseVerifiedSpendRecordCount: 0,
      },
      attributionNote: "note",
    },
    evidence: { runIds: ["r1"], allocationIds: [], transactionHashes: [], externalReferences: [] },
    generatedAt: "2026-11-20T02:00:00Z",
    contentHash: "hash",
  } as FundedMandateStatement;
}

function observation(id: string, mandateId: string, workspaceId = WS_A): OutcomeObservation {
  return {
    id,
    mandateId,
    workspaceId,
    kind: "observed",
    value: "3",
    unit: "suppliers",
    observedAt: "2026-11-19T00:00:00Z",
    source: "operator",
    confidence: "self_reported",
    evidence: [{ type: "url", reference: "https://example.com" }],
    notes: "PRIVATE NOTES MUST NOT LEAK",
    createdAt: "2026-11-19T00:00:00Z",
  } as OutcomeObservation;
}

function snapshot(overrides: Partial<MandateReviewSnapshot> = {}): MandateReviewSnapshot {
  return {
    selectedMandateId: "m-a",
    mandates: [mandate("m-a"), mandate("m-b")],
    context: context("m-a"),
    recommendation: recommendation("m-a"),
    statement: statement("m-a"),
    observations: {
      status: "ready",
      items: [observation("o-1", "m-a"), observation("o-foreign", "m-a", WS_B), observation("o-other", "m-b")],
    },
    spendRecordCount: 2,
    published: { status: "ready", items: [] },
    ...overrides,
  };
}

describe("buildMandateReview", () => {
  it("returns no_selection when nothing is selected", () => {
    const result = buildMandateReview(
      snapshot({ selectedMandateId: "", observations: { status: "not_loaded" } }),
      WS_A,
    );
    expect(result.status).toBe("no_selection");
    expect(result.evidence).toBeUndefined();
  });

  it("fails closed when the workspace is missing or mismatched", () => {
    expect(buildMandateReview(snapshot(), null).status).toBe("selection_inaccessible");
    expect(buildMandateReview(snapshot(), WS_B).status).toBe("selection_inaccessible");
    expect(
      buildMandateReview(snapshot({ selectedMandateId: "m-ghost" }), WS_A).status,
    ).toBe("selection_inaccessible");
  });

  it("projects only citations scoped to the selection", () => {
    const result = buildMandateReview(snapshot(), WS_A);
    expect(result.status).toBe("ok");
    const ctx = result.evidence!.context;
    expect(typeof ctx).toBe("object");
    if (typeof ctx !== "object") return;
    // The untagged sources list is never exposed; scoped provenance is.
    expect("sources" in ctx).toBe(false);
    expect(ctx.provenance.map((p) => p.label)).toEqual(["Run evidence"]);
    expect(ctx.provenance[0].recordId).toBe("run-rec-1");
    expect(result.citations!.provenance).toEqual(["run-rec-1"]);
    expect(result.citations!.observations).toEqual(["o-1"]);
    expect(result.citations!.statement).toBe("st-1");
    // No raw chunks or scores.
    expect(JSON.stringify(result)).not.toContain("RAW CHUNK");
    expect(JSON.stringify(result)).not.toContain("relevancy");
    // Published snapshot summaries are never serialized.
    expect(JSON.stringify(result)).not.toContain("published");
  });

  it("rejects cross-scope loaded data instead of attributing it", () => {
    const result = buildMandateReview(
      snapshot({
        context: context("m-b"), // loaded for a different mandate
        recommendation: recommendation("m-a", WS_B), // different workspace
        statement: statement("m-b"), // different mandate
      }),
      WS_A,
    );
    expect(result.evidence!.context).toBe("unavailable");
    expect(result.evidence!.recommendation).toBe("unavailable");
    expect(result.evidence!.statement).toBe("unavailable");
    // Observations from another workspace/mandate are filtered, not reported.
    const obs = result.evidence!.observations;
    expect(Array.isArray(obs)).toBe(true);
    if (Array.isArray(obs)) expect(obs.map((o) => o.id)).toEqual(["o-1"]);
    expect(JSON.stringify(result)).not.toContain("o-foreign");
    expect(JSON.stringify(result)).not.toContain("PRIVATE NOTES");
  });

  it("does not advance the review phase on foreign recommendation or statement", () => {
    const result = buildMandateReview(
      snapshot({
        context: context("m-a"),
        recommendation: recommendation("m-b"),
        statement: statement("m-b"),
        published: { status: "ready", items: [{ statementId: "st-foreign" } as never] },
      }),
      WS_A,
    );
    // Context matched → step 2 (awaiting recommendation); the foreign
    // rec/stmt/published must not push the phase forward.
    expect(result.reviewPhase!.action).toBe("recommendation");
    expect(result.reviewPhase!.step).toBe(2);
    expect(result.evidence!.recommendation).toBe("unavailable");
    expect(result.evidence!.statement).toBe("unavailable");
  });

  it("distinguishes not_loaded, unavailable, and a loaded empty result", () => {
    const missing = buildMandateReview(
      snapshot({
        context: null,
        observations: { status: "not_loaded" },
        recommendation: null,
        statement: null,
      }),
      WS_A,
    );
    expect(missing.evidence!.context).toBe("not_loaded");
    expect(missing.evidence!.observations).toBe("not_loaded");
    expect(missing.evidence!.recommendation).toBe("not_loaded");
    expect(missing.evidence!.statement).toBe("not_loaded");
    expect(JSON.stringify(missing)).not.toContain("does not exist");

    const failed = buildMandateReview(
      snapshot({ observations: { status: "unavailable" } }),
      WS_A,
    );
    expect(failed.evidence!.observations).toBe("unavailable");
    expect(failed.evidence!.observations).not.toEqual([]);

    const loaded = buildMandateReview(
      snapshot({ observations: { status: "ready", items: [] } }),
      WS_A,
    );
    expect(loaded.evidence!.observations).toEqual([]);
  });

  it("caps list sizes and text lengths", () => {
    const manyProvenance = context("m-a");
    manyProvenance.provenance = Array.from({ length: 25 }, (_, i) => ({
      kind: "run",
      label: "x".repeat(500),
      recordId: `rec-${i}`,
      workspaceId: WS_A,
      mandateId: "m-a",
      timestamp: "2026-11-19T00:00:00Z",
    }));
    const result = buildMandateReview(snapshot({ context: manyProvenance }), WS_A);
    const ctx = result.evidence!.context;
    if (typeof ctx !== "object") throw new Error("expected context object");
    expect(ctx.provenance).toHaveLength(10);
    expect(ctx.provenance[0].label.length).toBeLessThanOrEqual(201);
    expect(result.citations!.provenance.length).toBeLessThanOrEqual(10);
  });
});

interface CapturedTool {
  name: string;
  execute: () => string;
}
interface ModelContextMock {
  registerTool: ReturnType<typeof vi.fn>;
}

function connectStore(workspaceId: string | null = WS_A, token: string = VALID_TOKEN) {
  if (workspaceId === null) {
    useAuthStore.getState().logout();
    return;
  }
  useAuthStore
    .getState()
    .login(
      token,
      { id: "u-1", walletAddress: null } as never,
      { id: workspaceId } as never,
    );
  useAuthStore.getState().setWorkspaceMode("sandbox");
}

describe("MandateReviewTool", () => {
  let modelContext: ModelContextMock;

  beforeEach(() => {
    modelContext = { registerTool: vi.fn() };
    (document as { modelContext?: unknown }).modelContext = modelContext;
    window.history.pushState({}, "", "/spend");
    connectStore();
  });

  afterEach(() => {
    cleanup();
    delete (document as { modelContext?: unknown }).modelContext;
    useAuthStore.getState().logout();
    window.history.pushState({}, "", "/");
  });

  function registeredTool(): { tool: CapturedTool; signal: AbortSignal } {
    expect(modelContext.registerTool).toHaveBeenCalledTimes(1);
    const [tool, options] = modelContext.registerTool.mock.calls[0] as unknown as [CapturedTool, { signal: AbortSignal }];
    return { tool, signal: options.signal };
  }

  it("registers a read-only no-input tool and returns the scoped review", () => {
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    expect(tool.name).toBe("get_mandate_review");
    const result = JSON.parse(tool.execute()) as MandateReviewResult;
    expect(result.status).toBe("ok");
    expect(result.mandate!.id).toBe("m-a");
  });

  it("fails closed when the operator left the /spend attribution view", () => {
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    window.history.pushState({}, "", "/governance");
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
    window.history.pushState({}, "", "/spend?view=mandates");
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
  });

  it("fails closed on a stale callback after the selection changed", () => {
    const { rerender } = render(<MandateReviewTool snapshot={snapshot({ selectedMandateId: "m-a" })} />);
    const { tool } = registeredTool();
    // Re-render with a different selection: effect deps re-register, but a
    // saved callback from the first registration must refuse to run.
    const foreign = snapshot({ selectedMandateId: "m-b" });
    rerender(<MandateReviewTool snapshot={foreign} />);
    expect(modelContext.registerTool).toHaveBeenCalledTimes(2);
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
    const [toolB] = modelContext.registerTool.mock.calls[1] as unknown as [CapturedTool];
    const result = JSON.parse(toolB.execute()) as MandateReviewResult;
    expect(result.status).toBe("ok");
    expect(result.mandate!.id).toBe("m-b");
  });

  it("fails closed with an expired token", () => {
    connectStore(WS_A, EXPIRED_TOKEN);
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
  });

  it("fails closed with a malformed token that carries no exp", () => {
    connectStore(WS_A, MALFORMED_TOKEN);
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
  });

  it("fails closed on sign-out even if a stale callback fires", () => {
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    connectStore(null);
    const result = JSON.parse(tool.execute());
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("m-a");
  });

  it("fails closed on workspace switch even if a stale callback fires", () => {
    render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool } = registeredTool();
    connectStore(WS_B);
    const result = JSON.parse(tool.execute());
    expect(result.status).toBe("unavailable");
  });

  it("fails closed after unmount aborts the registration", () => {
    const { unmount } = render(<MandateReviewTool snapshot={snapshot()} />);
    const { tool, signal } = registeredTool();
    unmount();
    expect(signal.aborted).toBe(true);
    expect(JSON.parse(tool.execute()).status).toBe("unavailable");
  });

  it("stays silent when the browser has no modelContext API", () => {
    delete (document as { modelContext?: unknown }).modelContext;
    expect(() => render(<MandateReviewTool snapshot={snapshot()} />)).not.toThrow();
  });

  it("ignores synchronous registration failure without breaking the page", () => {
    modelContext.registerTool.mockImplementation(() => {
      throw new Error("unsupported");
    });
    expect(() => render(<MandateReviewTool snapshot={snapshot()} />)).not.toThrow();
  });

  it("aborts when async registration rejects", async () => {
    let reject!: (reason: unknown) => void;
    modelContext.registerTool.mockImplementation(
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    );
    render(<MandateReviewTool snapshot={snapshot()} />);
    const [, options] = modelContext.registerTool.mock.calls[0] as unknown as [CapturedTool, { signal: AbortSignal }];
    reject(new Error("origin not allowed"));
    await Promise.resolve();
    expect(options.signal.aborted).toBe(true);
  });

  it("does not register when signed out", () => {
    connectStore(null);
    render(<MandateReviewTool snapshot={snapshot()} />);
    expect(modelContext.registerTool).not.toHaveBeenCalled();
  });
});
