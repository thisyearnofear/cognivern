import { describe, expect, it } from "vitest";
import fixture from "./fixtures/diligence-report.sample.json";
import { parsePublicDiligenceReport } from "@/lib/diligence-report";
import {
  proofFromCommitment,
  proofFromDiligenceReport,
  proofFromRound,
} from "@/lib/proof";
import type { PublicCommitment, RoundVerification } from "@/lib/verify-records";

const baseCommitment: PublicCommitment = {
  id: "cmt_abc123",
  programId: "prog-1",
  status: "anchored",
  commitmentRoot: "root-hash",
  participantCount: 7,
  highWaterMark: "hwm-1",
  highWaterMarkUsd: 1234.5,
  createdAt: "2026-11-23T00:00:00.000Z",
  anchors: {
    zerogRootHash: "zg-root",
    zerogTxHash: "zg-tx",
    filecoinCid: "bafycid",
    filecoinTxHash: null,
    filecoinActionId: null,
  },
  program: { name: "Hackathon credits", sponsorName: "Acme", status: "active" },
};

const baseRound: RoundVerification = {
  roundId: "round-1",
  status: "revealed",
  backend: "canton",
  description: "Pick a security vendor",
  serviceCategory: "security audit",
  deadline: "2026-12-01T00:00:00.000Z",
  bidCount: 3,
  winner: "Alice::1220abcd",
  winningBid: 500,
  winningProposalHash: "prop-hash",
  ledgerRefs: { auction: "contract-a", result: "contract-r" },
  settledAssetCid: "asset-cid",
  governanceTimeline: {
    runId: "run-9",
    agentId: "agent-1",
    events: [
      { eventType: "created", timestamp: "t", eventHash: "h1", payload: {} },
      { eventType: "closed", timestamp: "t", eventHash: "h2", payload: {} },
    ],
  },
};

const report = parsePublicDiligenceReport(fixture);
if (!report) throw new Error("fixture must parse");

describe("proofFromCommitment", () => {
  it("builds the envelope with anchors as receipts", () => {
    const proof = proofFromCommitment(baseCommitment);
    expect(proof.schema).toBe("cognivern.proof.v1");
    expect(proof.kind).toBe("credit-commitment");
    expect(proof.title).toBe("Hackathon credits");
    expect(proof.asked).toContain("7 participant(s)");
    expect(proof.asked).toContain("funded by Acme");
    expect(proof.mandate).toEqual({ id: "prog-1", label: "Hackathon credits" });
    expect(proof.spent.usd).toBe(1234.5);
    expect(proof.decided.outcome).toBe("anchored");
    expect(proof.receipts.map((r) => r.label)).toEqual([
      "Commitment root",
      "0G root hash",
      "0G transaction",
      "Filecoin CID",
    ]);
    const zg = proof.receipts.find((r) => r.label === "0G transaction");
    expect(zg?.href).toContain("zg-tx");
    expect(proof.generatedAt).toBe(baseCommitment.createdAt);
  });

  it("keeps a pending commitment honest and tolerates missing program", () => {
    const proof = proofFromCommitment({
      ...baseCommitment,
      status: "pending",
      program: null,
      highWaterMarkUsd: null,
    });
    expect(proof.title).toBe("Credit commitment");
    expect(proof.decided.outcome).toBe("pending");
    expect(proof.decided.detail).toContain("pending");
    expect(proof.spent.usd).toBeNull();
    expect(proof.mandate.label).toBeNull();
  });
});

describe("proofFromRound", () => {
  it("builds the envelope with contracts, hash and governance receipts", () => {
    const proof = proofFromRound(baseRound);
    expect(proof.schema).toBe("cognivern.proof.v1");
    expect(proof.kind).toBe("sealed-bid-round");
    expect(proof.title).toBe("Pick a security vendor");
    expect(proof.asked).toBe("Select a vendor for security audit by sealed bid.");
    expect(proof.mandate).toEqual({ id: null, label: null });
    expect(proof.spent).toEqual({ usd: 500, note: "winning bid" });
    expect(proof.decided.detail).toBe("Winner: Alice");
    expect(proof.receipts.map((r) => r.label)).toEqual([
      "Auction contract",
      "Result contract",
      "Winning proposal hash",
      "Settled asset",
      "Governance run",
      "Governance events",
    ]);
    expect(proof.receipts[5].value).toBe("2 hashed event(s)");
    expect(proof.limits.length).toBeGreaterThan(0);
  });

  it("never invents a figure when winner/bid are null", () => {
    const proof = proofFromRound({
      ...baseRound,
      winner: null,
      winningBid: null,
      serviceCategory: "",
      governanceTimeline: null,
      ledgerRefs: null,
      settledAssetCid: null,
      winningProposalHash: null,
    });
    expect(proof.asked).toBe("Select a vendor by sealed bid.");
    expect(proof.spent.usd).toBeNull();
    expect(proof.decided.detail).toBeNull();
    expect(proof.receipts).toEqual([]);
  });
});

describe("proofFromDiligenceReport", () => {
  it("summarises decisions, spend and receipts", () => {
    const proof = proofFromDiligenceReport(report);
    expect(proof.schema).toBe("cognivern.proof.v1");
    expect(proof.kind).toBe("diligence-report");
    expect(proof.asked).toBe(
      "Should each of 4 supplier(s) be onboarded and paid?",
    );
    expect(proof.mandate.id).toBe("telegraph-supplier-diligence");
    // First non-skipped model (model-a) governed finals: reject, proceed, hold, hold
    expect(proof.decided.outcome).toBe("1 rejected, 2 held, 1 proceeded");
    expect(proof.decided.detail).toBe("2 item(s) sent to human review");
    expect(proof.receipts).toHaveLength(4);
    expect(proof.receipts[0].label).toBe("listed-entity evidence");
    expect(proof.limits).toEqual(report.honestyBounds);
    expect(proof.generatedAt).toBe(report.generatedAt);
  });

  it("marks unpriced model usage in the spend note", () => {
    const proof = proofFromDiligenceReport(report);
    // model-a has costUsd null everywhere while it ran → unpriced
    expect(proof.spent.note).toBe(
      "specialist calls only; model usage not priced",
    );
    // usd is still just specialist spend + priced model costs
    expect(proof.spent.usd).toBeCloseTo(0.05 + 0.003 + 0.0012);
  });

  it("handles no models at all: gate decides, spend is specialists only", () => {
    const noModels = structuredClone(fixture) as unknown;
    const parsed = noModels as { models: unknown[]; cases: { perModel: unknown[] }[] };
    parsed.models = [];
    for (const c of parsed.cases) c.perModel = [];
    const empty = parsePublicDiligenceReport(parsed);
    if (!empty) throw new Error("must parse");
    const proof = proofFromDiligenceReport(empty);
    expect(proof.spent).toEqual({
      usd: 0.05,
      note: "specialist calls only",
    });
    // Gates: reject, null(registered-clear), hold, hold
    expect(proof.decided.outcome).toBe(
      "1 rejected, 2 held, 1 awaiting a model",
    );
  });
});
