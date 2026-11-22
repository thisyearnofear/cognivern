import { describe, expect, it } from "vitest";
import { buildTelegraphLedgerReport } from "../../src/backend/services/telegraph/TelegraphLedger.js";
import type { CreRun } from "../../src/backend/cre/types.js";

function signalRun(
  runId: string,
  opts: {
    status?: CreRun["status"];
    ok?: boolean;
    approvalState?: CreRun["approvalState"];
    requiresApproval?: boolean;
    confidenceMet?: boolean;
    confidence?: number | null;
    costUsd?: string;
    paid?: boolean;
    intent?: string;
    mandateId?: string;
    minerId?: string;
    minerName?: string;
    timestamp?: string;
  } = {},
): CreRun {
  const confidence = opts.confidence === undefined ? 0.9 : opts.confidence;
  return {
    runId,
    projectId: "ws-1",
    workflow: "governance",
    mode: "cre",
    startedAt: opts.timestamp ?? "2026-11-14T00:00:00.000Z",
    finishedAt: opts.status === "paused_for_approval" ? undefined : "2026-11-14T00:00:01.000Z",
    ok: opts.ok ?? opts.status !== "failed",
    status: opts.status ?? "completed",
    requiresApproval: opts.requiresApproval,
    approvalState: opts.approvalState,
    steps: [],
    artifacts: [
      {
        id: `${runId}-a`,
        type: "telegraph.signal",
        createdAt: "2026-11-14T00:00:00.500Z",
        data: {
          agentId: "agent-1",
          mandateId: opts.mandateId,
          miner: {
            id: opts.minerId ?? "miner-1",
            name: opts.minerName ?? "Miner One",
            intent: opts.intent ?? "QUESTION_ANSWERING",
          },
          signal: {
            confidence,
            confidenceMet: opts.confidenceMet ?? true,
          },
          cost: {
            usd: opts.costUsd ?? "0.0100",
            paymentMethod: "x402",
            paid: opts.paid ?? true,
            paymentNetwork: "eip155:84532",
          },
          latencyMs: 100,
          timestamp: opts.timestamp ?? "2026-11-14T00:00:00.500Z",
        },
      },
    ],
  };
}

describe("buildTelegraphLedgerReport", () => {
  it("returns an empty report for runs without telegraph.signal artifacts", () => {
    const report = buildTelegraphLedgerReport([{ ...signalRun("r1"), artifacts: [] }]);
    expect(report.totals.calls).toBe(0);
    expect(report.records).toHaveLength(0);
  });

  it("aggregates settlements, spend, and dispositions", () => {
    const report = buildTelegraphLedgerReport([
      signalRun("approved-1", { costUsd: "0.0100", intent: "QUESTION_ANSWERING" }),
      signalRun("held-1", {
        status: "paused_for_approval",
        ok: false,
        requiresApproval: true,
        approvalState: "pending",
        confidenceMet: false,
        confidence: 0.4,
        costUsd: "0.0200",
        intent: "SANCTIONS_SCREENING_MATCH",
        mandateId: "mandate-a",
      }),
      signalRun("released-1", {
        status: "completed",
        ok: true,
        approvalState: "approved",
        confidenceMet: false,
        confidence: 0.4,
        costUsd: "0.0200",
        intent: "SANCTIONS_SCREENING_MATCH",
        mandateId: "mandate-a",
      }),
      signalRun("failed-1", {
        status: "failed",
        ok: false,
        costUsd: "0",
        paid: false,
        intent: "GAS_PRICE",
      }),
    ]);

    expect(report.totals.calls).toBe(4);
    expect(report.totals.paidCalls).toBe(3);
    expect(report.totals.spendUsd).toBeCloseTo(0.05, 5);
    expect(report.totals.approved).toBe(1);
    expect(report.totals.heldPending).toBe(1);
    expect(report.totals.released).toBe(1);
    expect(report.totals.failed).toBe(1);

    const qa = report.byIntent.find((i) => i.intent === "QUESTION_ANSWERING");
    expect(qa?.calls).toBe(1);
    const sanctions = report.byIntent.find((i) => i.intent === "SANCTIONS_SCREENING_MATCH");
    expect(sanctions?.calls).toBe(2);
    expect(sanctions?.spendUsd).toBeCloseTo(0.04, 5);

    const mandate = report.byMandate.find((m) => m.mandateId === "mandate-a");
    expect(mandate?.calls).toBe(2);

    const miner = report.byMiner[0];
    expect(miner.minerId).toBe("miner-1");
    expect(miner.calls).toBe(4);
    expect(miner.avgConfidence).not.toBeNull();
  });

  it("marks gate-blocked purchases as blocked and surfaces compliance fields", () => {
    const blocked = signalRun("gate-1", {
      status: "failed",
      ok: false,
      costUsd: "0",
      paid: false,
      intent: "GAS_PRICE",
    });
    const artifact = blocked.artifacts[0];
    artifact.data = {
      agentId: "agent-1",
      gate: { name: "compliance", decision: "blocked", reason: "positive match" },
      compliance: {
        verdict: "hit",
        verdictSource: "counterproof-adapter",
        screeningRunId: "screen-1",
        screeningMinerId: "zk-sanctions",
      },
      evidenceBundle: {
        evidenceHash: "abc123",
        policyEvaluation: {
          passed: true,
          violations: [],
        },
      },
      intendedCall: { minerId: "txlens" },
      cost: { usd: "0", paymentMethod: "x402", paid: false },
      timestamp: "2026-11-14T00:00:00.500Z",
    };

    const screened = signalRun("paid-1", { costUsd: "0.0100" });
    const paidArtifact = screened.artifacts[0];
    paidArtifact.data = {
      ...(paidArtifact.data as Record<string, unknown>),
      compliance: { verdict: "clear", screeningRunId: "screen-0" },
    };

    const report = buildTelegraphLedgerReport([blocked, screened]);
    const gateRec = report.records.find((r) => r.runId === "gate-1");
    expect(gateRec?.disposition).toBe("blocked");
    expect(gateRec?.complianceVerdict).toBe("hit");
    expect(gateRec?.complianceVerdictSource).toBe("counterproof-adapter");
    expect(gateRec?.complianceRunId).toBe("screen-1");
    expect(gateRec?.evidenceHash).toBe("abc123");
    expect(gateRec?.evidencePath).toBe("/api/telegraph/evidence/gate-1");
    expect(gateRec?.policyViolations).toEqual([]);
    expect(report.totals.blocked).toBe(1);

    const paidRec = report.records.find((r) => r.runId === "paid-1");
    expect(paidRec?.complianceVerdict).toBe("clear");
    expect(paidRec?.disposition).toBe("approved");
  });

  it("marks rejected held signals as quarantined", () => {
    const report = buildTelegraphLedgerReport([
      signalRun("q-1", {
        status: "failed",
        ok: false,
        approvalState: "rejected",
        requiresApproval: false,
        confidenceMet: false,
        confidence: 0.2,
      }),
    ]);
    expect(report.records[0].disposition).toBe("quarantined");
    expect(report.totals.quarantined).toBe(1);
  });

  it("sorts records newest-first and caps at 100", () => {
    const runs = Array.from({ length: 105 }, (_, i) =>
      signalRun(`r-${i}`, {
        timestamp: `2026-11-14T00:${String(i % 60).padStart(2, "0")}:${String(i).padStart(2, "0")}.000Z`,
      }),
    );
    const report = buildTelegraphLedgerReport(runs);
    expect(report.records).toHaveLength(100);
    expect(report.records[0].timestamp >= report.records[99].timestamp).toBe(true);
  });
});
