import { describe, it, expect } from "vitest";
import type { Run, ProofAnchorReceipt } from "@cognivern/shared";
import { deriveRunState } from "@/lib/run-state";

/**
 * A run's bounded adaptive state (docs/ADAPTIVE_UX.md). These tests pin the
 * derivation so every surface that adapts to a run (approval controls, run-list
 * attention flags) reads a single source of truth instead of re-branching on
 * the raw status.
 */

const proofAnchor = (network: string): ProofAnchorReceipt => ({
  proofId: "p",
  runIdHash: "h",
  evidenceHash: "e",
  policySetHash: "s",
  txHash: "0xabc",
  blockNumber: null,
  chainId: 1,
  network,
});

const baseRun: Run = {
  id: "run-1",
  workflow: "Spend approval",
  status: "running",
  mode: "live",
  steps: 3,
  duration: "12s",
  artifacts: 1,
  timestamp: "2026-09-08T00:00:00Z",
};

describe("deriveRunState", () => {
  it("is active while queued or running without an anchored proof", () => {
    expect(deriveRunState({ ...baseRun, status: "queued" })).toBe("active");
    expect(deriveRunState({ ...baseRun, status: "running" })).toBe("active");
  });

  it("is awaiting_receipt when a running run already has an anchored proof", () => {
    expect(
      deriveRunState({
        ...baseRun,
        status: "running",
        evidence: { zeroGProofV2: proofAnchor("0g-mainnet") },
      }),
    ).toBe("awaiting_receipt");
    expect(
      deriveRunState({
        ...baseRun,
        status: "running",
        evidence: { xlayerProofV2: proofAnchor("xlayer-mainnet") },
      }),
    ).toBe("awaiting_receipt");
  });

  it("is paused_for_approval when the run is held for operator review", () => {
    expect(deriveRunState({ ...baseRun, status: "paused_for_approval" })).toBe(
      "paused_for_approval",
    );
  });

  it("is done for every terminal status", () => {
    expect(deriveRunState({ ...baseRun, status: "completed" })).toBe("done");
    expect(deriveRunState({ ...baseRun, status: "failed" })).toBe("done");
    expect(deriveRunState({ ...baseRun, status: "cancelled" })).toBe("done");
  });

  it("defaults to active for null/undefined input", () => {
    expect(deriveRunState(null)).toBe("active");
    expect(deriveRunState(undefined)).toBe("active");
  });

  it("defaults to active for an unknown status string", () => {
    expect(
      deriveRunState({ ...baseRun, status: "phantom" } as unknown as Run),
    ).toBe("active");
  });

  it("boundary: a queued run with an anchored proof stays active, not awaiting_receipt", () => {
    // Only a running run upgrades to awaiting_receipt; queued work has not
    // actually executed, so a proof attached to it would be stale and ignored.
    expect(
      deriveRunState({
        ...baseRun,
        status: "queued",
        evidence: { zeroGProofV2: proofAnchor("0g-mainnet") },
      }),
    ).toBe("active");
  });
});
