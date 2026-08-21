import { describe, expect, it, vi } from "vitest";
import {
  fanOutEvidenceAnchors,
  FilecoinEvidenceSink,
  ZeroGStorageEvidenceSink,
  type EvidenceAnchorResult,
  type EvidenceSink,
} from "@backend/services/governance/evidence/index.js";
import { executionRails, blockchainConfig } from "@backend/shared/config/index.js";

describe("executionRails config", () => {
  it("aliases blockchainConfig to executionRails.default", () => {
    expect(blockchainConfig).toBe(executionRails.default);
    expect(executionRails.default.railId).toMatch(/^xlayer-/);
    expect(typeof executionRails.default.chainId).toBe("number");
  });

  it("exposes Mantle Sepolia as a second resolvable EVM rail", () => {
    expect(executionRails.secondary.railId).toBe("mantle-sepolia");
    expect(executionRails.secondary.chainId).toBe(5003);
    expect(executionRails.resolve(5003).railId).toBe("mantle-sepolia");
    expect(executionRails.resolve("mantle-sepolia").rpcUrl).toContain("mantle");
    expect(executionRails.list().some((r) => r.railId === "mantle-sepolia")).toBe(
      true,
    );
  });
});

describe("EvidenceSink adapters", () => {
  it("ZeroGStorageEvidenceSink maps rootHash into evidencePatch", async () => {
    const sink = new ZeroGStorageEvidenceSink({
      anchorAuditRecord: async () => ({
        rootHash: "0xroot",
        localHash: "0xlocal",
        txHash: "0xtx",
      }),
    });
    const result = await sink.anchor({
      runId: "run-1",
      kind: "governance_decision",
      payloadHash: "0xhash",
      payload: { outcome: "allowed" },
    });
    expect(result?.sink).toBe("zerog-storage");
    expect(result?.ref).toBe("0xroot");
    expect(result?.evidencePatch).toMatchObject({
      zeroGRootHash: "0xroot",
      zeroGLocalHash: "0xlocal",
      zeroGTxHash: "0xtx",
    });
  });

  it("FilecoinEvidenceSink maps cid into evidencePatch", async () => {
    const sink = new FilecoinEvidenceSink({
      anchorAuditRecord: async () => ({
        cid: "sha256:abc",
        txHash: "0xfil",
        actionId: "0xact",
      }),
    });
    const result = await sink.anchor({
      runId: "run-2",
      kind: "audit_event",
      payloadHash: "0xhash",
      payload: {},
    });
    expect(result?.sink).toBe("filecoin");
    expect(result?.ref).toBe("sha256:abc");
    expect(result?.evidencePatch).toMatchObject({
      filecoinCid: "sha256:abc",
      filecoinTxHash: "0xfil",
      filecoinActionId: "0xact",
    });
  });

  it("fanOutEvidenceAnchors invokes onResult for each successful sink", async () => {
    const results: EvidenceAnchorResult[] = [];
    const ok: EvidenceSink = {
      name: "ok",
      anchor: async () => ({
        sink: "ok",
        ref: "r1",
        evidencePatch: { a: 1 },
      }),
    };
    const skip: EvidenceSink = {
      name: "skip",
      anchor: async () => null,
    };
    const fail: EvidenceSink = {
      name: "fail",
      anchor: async () => {
        throw new Error("boom");
      },
    };

    fanOutEvidenceAnchors([ok, skip, fail], {
      runId: "run-3",
      kind: "audit_event",
      payloadHash: "h",
      payload: {},
    }, (r) => {
      results.push(r);
    });

    await vi.waitFor(() => {
      expect(results).toHaveLength(1);
    });
    expect(results[0].sink).toBe("ok");
  });
});
