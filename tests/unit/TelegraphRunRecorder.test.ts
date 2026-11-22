import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runsPath = path.join(
  os.tmpdir(),
  `cognivern-telegraph-runs-${process.pid}-${Date.now()}.jsonl`,
);
process.env.CRE_RUNS_FILE = runsPath;
process.env.MONGODB_URI = "";
delete process.env.EVIDENCE_SIGNING_KEY;
delete process.env.FILECOIN_PRIVATE_KEY;

const { recordTelegraphGovernedCall, recordTelegraphGateDecision } = await import(
  "../../src/backend/services/telegraph/TelegraphRunRecorder.js"
);
const { creRunStore } = await import("../../src/backend/cre/storage/CreRunStore.js");

const PROJECT = "ws-telegraph-test";

function minerMetadata(overrides: Record<string, unknown> = {}) {
  return {
    minerId: "miner-1",
    minerName: "Test Miner",
    confidence: 0.9,
    latencyMs: 120,
    costUsd: "0.0100",
    intent: "QUESTION_ANSWERING",
    timestamp: new Date().toISOString(),
    paid: true,
    paymentNetwork: "eip155:84532",
    ...overrides,
  };
}

function governedResult(
  status: "approved" | "held" | "failed",
  overrides: Record<string, unknown> = {},
) {
  const success = status !== "failed";
  return {
    success,
    status,
    response: success
      ? {
          success: true,
          data: { answer: "42" },
          metadata: minerMetadata(overrides.metadata as Record<string, unknown>),
        }
      : undefined,
    decision: success
      ? {
          approved: status === "approved",
          reason: "test decision",
          confidenceMet: status === "approved",
          threshold: 0.7,
          actualConfidence: 0.9,
          confidenceKnown: true,
        }
      : undefined,
    artifact: success
      ? {
          id: "artifact-1",
          type: "telegraph.signal" as const,
          createdAt: new Date().toISOString(),
          data: {
            agentId: "agent-1",
            miner: { id: "miner-1", name: "Test Miner" },
            signal: { confidence: 0.9 },
            cost: { usd: "0.0100", paymentMethod: "x402" },
          },
        }
      : undefined,
    error: success ? undefined : "miner unreachable",
  } as Parameters<typeof recordTelegraphGovernedCall>[0]["result"];
}

describe("recordTelegraphGovernedCall", () => {
  beforeAll(async () => {
    await creRunStore.reset();
  });

  afterAll(() => {
    fs.rmSync(runsPath, { force: true });
    fs.rmSync(`${runsPath}.lock`, { force: true });
  });

  it("persists an approved call as a completed run with a telegraph.signal artifact", async () => {
    const run = await recordTelegraphGovernedCall({
      result: governedResult("approved"),
      projectId: PROJECT,
      agentId: "agent-1",
    });

    expect(run).not.toBeNull();
    expect(run!.projectId).toBe(PROJECT);
    expect(run!.workflow).toBe("governance");
    expect(run!.status).toBe("completed");
    expect(run!.approvalState).toBe("not_required");
    expect(run!.artifacts.some((a) => a.type === "telegraph.signal")).toBe(true);

    const stored = await creRunStore.get(run!.runId);
    expect(stored?.status).toBe("completed");
  });

  it("pauses a held call for operator approval instead of completing it", async () => {
    const run = await recordTelegraphGovernedCall({
      result: governedResult("held", {
        metadata: { confidence: 0.4 },
      }),
      projectId: PROJECT,
      agentId: "agent-1",
    });

    expect(run).not.toBeNull();
    expect(run!.status).toBe("paused_for_approval");
    expect(run!.requiresApproval).toBe(true);
    expect(run!.approvalState).toBe("pending");
    expect(run!.controls?.canApprove).toBe(true);

    const stored = await creRunStore.get(run!.runId);
    expect(stored?.status).toBe("paused_for_approval");
    expect(stored?.artifacts.some((a) => a.type === "telegraph.signal")).toBe(true);
  });

  it("records a failed call as a failed run", async () => {
    const run = await recordTelegraphGovernedCall({
      result: governedResult("failed"),
      projectId: PROJECT,
      agentId: "agent-1",
    });

    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");
    expect(run!.ok).toBe(false);
  });

  it("persists evidence extras under caller-supplied run and artifact ids", async () => {
    const run = await recordTelegraphGovernedCall({
      result: governedResult("approved"),
      projectId: PROJECT,
      agentId: "agent-1",
      runId: "run-evidence-1",
      artifactId: "artifact-evidence-1",
      artifactExtras: {
        compliance: { verdict: "clear" },
        evidenceBundle: { evidenceHash: "abc123" },
      },
    });

    const artifact = run?.artifacts.find((item) => item.type === "telegraph.signal");
    expect(run?.runId).toBe("run-evidence-1");
    expect(artifact?.id).toBe("artifact-evidence-1");
    expect(artifact?.data).toMatchObject({
      compliance: { verdict: "clear" },
      evidenceBundle: { evidenceHash: "abc123" },
    });
    expect(artifact?.evidence?.hash).toBeTruthy();
  });

  it("uses the caller's complete artifact payload when the result has none", async () => {
    const result = {
      ...governedResult("approved"),
      artifact: undefined,
    } as Parameters<typeof recordTelegraphGovernedCall>[0]["result"];
    const artifactData = {
      agentId: "agent-1",
      workspaceId: PROJECT,
      miner: { id: "miner-1", name: "Test Miner", intent: "QUESTION_ANSWERING" },
      compliance: { verdict: "clear" },
      evidenceBundle: { evidenceHash: "bundle-hash" },
      timestamp: "2026-11-22T00:00:00.000Z",
    };

    const run = await recordTelegraphGovernedCall({
      result,
      projectId: PROJECT,
      agentId: "agent-1",
      runId: "run-complete-payload",
      artifactId: "artifact-complete-payload",
      artifactExtras: artifactData,
    });

    const artifact = run?.artifacts.find((item) => item.type === "telegraph.signal");
    expect(artifact?.data).toMatchObject(artifactData);
  });

  it("embeds an evidence bundle in the blocked gate artifact", async () => {
    const run = await recordTelegraphGateDecision({
      projectId: PROJECT,
      agentId: "agent-1",
      runId: "gate-evidence-1",
      artifactId: "gate-artifact-1",
      timestamp: "2026-11-22T00:00:00.000Z",
      gate: "compliance",
      reason: "screen requires review",
      compliance: { verdict: "review" },
      intendedCall: { minerId: "txlens" },
      evidenceBundle: { evidenceHash: "gate-hash" },
    });

    const artifact = run?.artifacts.find((item) => item.type === "telegraph.signal");
    expect(run?.runId).toBe("gate-evidence-1");
    expect(run?.status).toBe("failed");
    expect(artifact?.data).toMatchObject({
      gate: { decision: "blocked" },
      compliance: { verdict: "review" },
      evidenceBundle: { evidenceHash: "gate-hash" },
    });
    expect(artifact?.evidence?.hash).toBeTruthy();
  });

  it("skips persistence entirely when no projectId is provided", async () => {
    const run = await recordTelegraphGovernedCall({
      result: governedResult("approved"),
      projectId: null,
      agentId: "agent-1",
    });
    expect(run).toBeNull();
  });
});
