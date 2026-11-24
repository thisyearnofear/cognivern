/**
 * Pure adapters from each /verify source record to the shared proof
 * envelope (cognivern.proof.v1). The envelope only carries what the record
 * itself carries — no payload, no invented figures.
 * See docs/internals/proof-and-eval-contracts.md.
 */

import { explorerTxUrl } from "@cognivern/shared";
import type { ProofReceipt, PublicProof } from "@cognivern/shared";
import type { PublicDiligenceReport } from "@/lib/diligence-report";
import {
  REPLAY_WINNER,
  SANDBOX_REPLAY_ID,
  type VisibilityEvidenceRow,
} from "@/lib/visibility-replay";
import {
  displayPartyName,
  ROUND_PROOF_LIMITS,
  type PublicCommitment,
  type RoundVerification,
} from "@/lib/verify-records";

export function proofFromCommitment(c: PublicCommitment): PublicProof {
  const receipts: ProofReceipt[] = [
    { label: "Commitment root", value: c.commitmentRoot },
  ];
  if (c.anchors.zerogRootHash) {
    receipts.push({ label: "0G root hash", value: c.anchors.zerogRootHash });
  }
  if (c.anchors.zerogTxHash) {
    receipts.push({
      label: "0G transaction",
      value: c.anchors.zerogTxHash,
      href: explorerTxUrl("zerog-galileo", c.anchors.zerogTxHash),
    });
  }
  if (c.anchors.filecoinCid) {
    receipts.push({ label: "Filecoin CID", value: c.anchors.filecoinCid });
  }
  if (c.anchors.filecoinTxHash) {
    receipts.push({
      label: "Filecoin transaction",
      value: c.anchors.filecoinTxHash,
      href: explorerTxUrl("filecoin-calibration", c.anchors.filecoinTxHash),
    });
  }
  return {
    schema: "cognivern.proof.v1",
    kind: "credit-commitment",
    id: c.id,
    title: c.program?.name ?? "Credit commitment",
    asked:
      `Sponsored inference credits for ${c.participantCount} participant(s)` +
      (c.program?.sponsorName ? `, funded by ${c.program.sponsorName}` : "") +
      ".",
    mandate: { id: c.programId, label: c.program?.name ?? null },
    spent: { usd: c.highWaterMarkUsd, note: "high-water mark" },
    decided: {
      outcome: c.status,
      detail:
        c.status === "anchored"
          ? "Commitment root is anchored externally."
          : "Anchoring is still pending.",
    },
    receipts,
    limits: [
      "Shows aggregate commitment metadata only; individual balances are checked with a participant receipt.",
    ],
    generatedAt: c.createdAt,
  };
}

export function proofFromRound(r: RoundVerification): PublicProof {
  const receipts: ProofReceipt[] = [];
  const refs: [string, string | undefined][] = [
    ["Auction contract", r.ledgerRefs?.auction],
    ["Result contract", r.ledgerRefs?.result],
    ["Cancellation contract", r.ledgerRefs?.cancelled],
  ];
  for (const [label, value] of refs) {
    if (value) receipts.push({ label, value });
  }
  if (r.winningProposalHash) {
    receipts.push({ label: "Winning proposal hash", value: r.winningProposalHash });
  }
  if (r.settledAssetCid) {
    receipts.push({ label: "Settled asset", value: r.settledAssetCid });
  }
  if (r.governanceTimeline) {
    receipts.push(
      { label: "Governance run", value: r.governanceTimeline.runId },
      {
        label: "Governance events",
        value: `${r.governanceTimeline.events.length} hashed event(s)`,
      },
    );
  }
  return {
    schema: "cognivern.proof.v1",
    kind: "sealed-bid-round",
    id: r.roundId,
    title: r.description || "Sealed-bid round",
    asked: r.serviceCategory
      ? `Select a vendor for ${r.serviceCategory} by sealed bid.`
      : "Select a vendor by sealed bid.",
    mandate: { id: null, label: null },
    spent: {
      usd: r.winningBid,
      note: r.winningBid !== null ? "winning bid" : null,
    },
    decided: {
      outcome: r.status,
      detail: r.winner ? `Winner: ${displayPartyName(r.winner)}` : null,
    },
    receipts,
    limits: [...ROUND_PROOF_LIMITS],
    generatedAt: null,
  };
}

export function proofFromDiligenceReport(
  report: PublicDiligenceReport,
): PublicProof {
  const specialistSpend = report.summary.run.specialistSpendUsd;
  let modelCostTotal = 0;
  let modelRan = false;
  let unpricedModelCost = false;
  for (const model of report.models) {
    if (model.skipped) continue;
    for (const c of report.cases) {
      const arm = c.perModel.find((r) => r.label === model.label);
      if (!arm) continue;
      for (const cost of [arm.alone.costUsd, arm.governed.costUsd]) {
        if (typeof cost === "number") modelCostTotal += cost;
      }
      if (arm.alone.decision !== "unparseable" || arm.alone.errored) {
        modelRan = true;
      }
      if (
        (arm.alone.decision !== "unparseable" && arm.alone.costUsd === null) ||
        (arm.governed.modelDecision !== null &&
          arm.governed.costUsd === null)
      ) {
        unpricedModelCost = true;
      }
    }
  }
  const spentNote = !modelRan
    ? "specialist calls only"
    : unpricedModelCost
      ? "specialist calls only; model usage not priced"
      : "specialist calls plus model usage";

  const firstModel = report.models.find((m) => !m.skipped);
  const counts = new Map<string, number>();
  let awaiting = 0;
  for (const c of report.cases) {
    const arm = firstModel
      ? c.perModel.find((r) => r.label === firstModel.label)
      : undefined;
    const decision = arm?.governed.finalDecision ?? c.gate?.decision ?? null;
    if (decision === null) awaiting += 1;
    else counts.set(decision, (counts.get(decision) ?? 0) + 1);
  }
  const parts: string[] = [];
  const ordered: [string, string][] = [
    ["reject", "rejected"],
    ["hold", "held"],
    ["proceed", "proceeded"],
  ];
  for (const [decision, label] of ordered) {
    const n = counts.get(decision);
    if (n) parts.push(`${n} ${label}`);
  }
  if (awaiting) parts.push(`${awaiting} awaiting a model`);

  const receipts: ProofReceipt[] = report.cases.flatMap((c) => {
    const hash = c.evidence.steps[0]?.evidenceHash;
    return hash ? [{ label: `${c.id} evidence`, value: hash }] : [];
  });

  return {
    schema: "cognivern.proof.v1",
    kind: "diligence-report",
    id: report.id,
    title: "Supplier diligence report",
    asked: `Should each of ${report.cases.length} supplier(s) be onboarded and paid?`,
    mandate: { id: report.mandateId ?? null, label: null },
    spent: {
      usd: unpricedModelCost ? specialistSpend : specialistSpend + modelCostTotal,
      note: spentNote,
      capUsd: report.spendCapUsd,
    },
    decided: {
      outcome: parts.join(", ") || "no decisions recorded",
      detail:
        report.summary.run.escalations > 0
          ? `${report.summary.run.escalations} item(s) sent to human review`
          : null,
    },
    receipts,
    limits: [...report.honestyBounds],
    generatedAt: report.generatedAt,
  };
}

export function proofFromVisibilityReplay(
  evidence: VisibilityEvidenceRow[],
): PublicProof {
  const winningAmount = evidence[0]?.winningAmount;
  return {
    schema: "cognivern.proof.v1",
    kind: "sealed-bid-replay",
    id: SANDBOX_REPLAY_ID,
    title: "Sealed from whom?",
    asked:
      "Which party can see which quote before and after a sealed-bid round closes?",
    mandate: { id: null, label: null },
    spent: { usd: null, note: "synthetic amounts; no funds moved" },
    decided: {
      outcome: `${REPLAY_WINNER} won`,
      detail:
        winningAmount !== undefined ? `Result: ${winningAmount}` : null,
    },
    receipts: [
      {
        label: "Sandbox output",
        value: "canton-visibility-44996498857.json",
        href: "/evidence/canton-visibility-44996498857.json",
      },
    ],
    limits: [
      "Verified Canton sandbox run, not a production round.",
      "Synthetic amounts; no wallet, no funds, no live writes.",
    ],
    generatedAt: null,
  };
}
