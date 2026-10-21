import { describe, expect, it } from "vitest";
import type { CreRun } from "@backend/cre/types.js";
import { createSealedBidMandateLedger } from "@backend/services/blockchain/sealed-bid/SealedBidMandateLedger.js";
import { buildSpendAttributionReport } from "@backend/services/governance/SpendAttributionService.js";

class MemoryStore {
  runs = new Map<string, CreRun>();
  async add(run: CreRun) {
    this.runs.set(run.runId, run);
  }
  async get(runId: string) {
    return this.runs.get(runId);
  }
  async replace(run: CreRun) {
    this.runs.set(run.runId, run);
  }
  async list() {
    return [...this.runs.values()];
  }
}

const PARAMS = {
  roundId: "round-1",
  workspaceId: "ws-1",
  mandateId: "mandate-1",
  agentId: "agent-1",
  asset: "USDC",
  amountBase: "5000000",
  backend: "canton" as const,
};

describe("SealedBidMandateLedger", () => {
  it("records an allocation visible in the spend attribution report", async () => {
    const store = new MemoryStore();
    const ledger = createSealedBidMandateLedger(store);

    await ledger.recordAllocation(PARAMS);

    const report = buildSpendAttributionReport(await store.list(), "mandate-1");
    expect(report.totalsByAsset.USDC.allocatedAmount).toBe("5000000");
    expect(report.totalsByAsset.USDC.consumedAmount).toBe("0");
    const record = report.records[0];
    expect(record.status).toBe("allocated");
    expect(record.allocationId).toBe("sealed-bid:round-1");
    expect(record.provider).toBe("sealed-bid:canton");
    expect(record.transactionLink).toBe("/verify?round=round-1");
    expect(record.outcome).toBe("escrowed_for_round");
  });

  it("marks the allocation consumed on settlement", async () => {
    const store = new MemoryStore();
    const ledger = createSealedBidMandateLedger(store);
    await ledger.recordAllocation(PARAMS);
    await ledger.recordSettlement("round-1");

    const report = buildSpendAttributionReport(await store.list(), "mandate-1");
    expect(report.totalsByAsset.USDC.allocatedAmount).toBe("5000000");
    expect(report.totalsByAsset.USDC.consumedAmount).toBe("5000000");
    expect(report.records[0].status).toBe("consumed");
    expect(report.records[0].outcome).toBe("awarded_to_winner");
    expect(report.records[0].runStatus).toBe("completed");
  });

  it("voids the allocation on cancellation", async () => {
    const store = new MemoryStore();
    const ledger = createSealedBidMandateLedger(store);
    await ledger.recordAllocation(PARAMS);
    await ledger.recordCancellation("round-1");

    const report = buildSpendAttributionReport(await store.list(), "mandate-1");
    expect(report.totalsByAsset.USDC.allocatedAmount).toBe("0");
    expect(report.totalsByAsset.USDC.consumedAmount).toBe("0");
    expect(report.records[0].status).toBe("failed");
    expect(report.records[0].outcome).toBe("round_cancelled_escrow_returned");
  });

  it("rebuild restores links from persisted artifacts", async () => {
    const store = new MemoryStore();
    const first = createSealedBidMandateLedger(store);
    await first.recordAllocation(PARAMS);

    // A fresh ledger instance has an empty link map until rebuild repopulates
    // it from the store — mirroring a process restart.
    const second = createSealedBidMandateLedger(store);
    expect(second.getLink("round-1")).toBeUndefined();
    await second.rebuild();
    const link = second.getLink("round-1");
    expect(link?.mandateId).toBe("mandate-1");
    expect(link?.workspaceId).toBe("ws-1");

    await second.recordSettlement("round-1");
    const report = buildSpendAttributionReport(await store.list(), "mandate-1");
    expect(report.records[0].status).toBe("consumed");
  });

  it("no-ops on rounds without a link", async () => {
    const store = new MemoryStore();
    const ledger = createSealedBidMandateLedger(store);
    await ledger.recordSettlement("unknown-round");
    await ledger.recordCancellation("unknown-round");
    expect(await store.list()).toHaveLength(0);
  });
});
