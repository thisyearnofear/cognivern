import { StatementService, type FundedMandateStatement } from "./StatementService.js";

export type RecommendationStance = "hold" | "consider_next_allocation";

export interface AllocationRecommendation {
  version: 1;
  mandateId: string;
  workspaceId: string;
  generatedAt: string;
  statementId: string;
  status: "insufficient_evidence" | "ready";
  evidenceCompleteness: {
    score: number;
    outcomeCount: number;
    outcomesWithEvidence: number;
    verifiedOutcomeCount: number;
    spendRecordCount: number;
    verifiedSpendRecordCount: number;
    blockers: string[];
  };
  operationalMetrics: {
    costPerObservedOutcomeByAsset: Record<string, string>;
    verifiedOutcomeCount: number;
  };
  recommendation: {
    stance: RecommendationStance;
    reasoning: string[];
  };
  governanceNote: string;
}

function stanceReasoning(
  statement: FundedMandateStatement,
  verifiedOutcomeCount: number,
  uncertainCount: number,
  remainingByAsset: Record<string, string>,
  complianceBlockers: string[],
): { stance: RecommendationStance; reasoning: string[] } {
  const reasoning: string[] = [];

  if (statement.mandate.status !== "active") {
    reasoning.push(`Mandate status is "${statement.mandate.status}"; next-allocation reviews apply only to active mandates.`);
  }
  if (statement.performance.knownUnknowns.length > 0) {
    reasoning.push("Known unknowns remain; the statement does not yet present a complete evidence package.");
  }
  if (verifiedOutcomeCount === 0) {
    reasoning.push("No independently verified outcome observations were recorded in the measurement window.");
  }
  if (uncertainCount > 0) {
    reasoning.push(`${uncertainCount} spend attribution record(s) remain uncertain and must be reconciled first.`);
  }
  for (const blocker of complianceBlockers) {
    reasoning.push(blocker);
  }

  const hasHeadroom = Object.values(remainingByAsset).some((amount) => BigInt(amount) > 0n);
  if (!hasHeadroom) {
    reasoning.push("Authorized amounts are fully consumed; no next allocation headroom remains.");
  }

  const readyForRecommendation =
    statement.mandate.status === "active" &&
    verifiedOutcomeCount > 0 &&
    uncertainCount === 0 &&
    hasHeadroom &&
    statement.performance.knownUnknowns.length === 0 &&
    complianceBlockers.length === 0;

  if (readyForRecommendation) {
    return {
      stance: "consider_next_allocation",
      reasoning: [
        "Verified outcomes were observed alongside receipt-backed spend within the measurement window.",
        "A bounded next allocation may be worth evaluating; any new spend still requires explicit operator approval through the governance boundary.",
      ],
    };
  }

  return { stance: "hold", reasoning };
}

export const AllocationRecommendationService = {
  async generate(workspaceId: string, mandateId: string): Promise<AllocationRecommendation> {
    const statement = await StatementService.generateCandidate(workspaceId, mandateId);
    const outcomes = statement.performance.outcomes;
    const verifiedOutcomeCount = outcomes.filter(
      (outcome) => outcome.confidence === "independently_verified",
    ).length;
    const outcomesWithEvidence = statement.performance.evidenceCompleteness.outcomesWithEvidence;
    const spendRecordCount = statement.performance.evidenceCompleteness.spendRecordCount;
    const verifiedSpendRecordCount =
      statement.performance.evidenceCompleteness.spendRecordsWithTransactionEvidence;
    const uncertainCount = statement.performance.knownUnknowns.filter((unknown) =>
      /uncertain/i.test(unknown),
    ).length;

    const blockers: string[] = [];
    if (outcomes.length === 0) blockers.push("No outcome observations were recorded in the measurement window.");
    if (outcomesWithEvidence === 0) blockers.push("No outcome observations carry an evidence reference.");
    if (spendRecordCount === 0) blockers.push("No governed spend attribution records were found.");
    if (verifiedSpendRecordCount === 0) blockers.push("No spend records carry receipt-backed transaction evidence.");
    if (uncertainCount > 0) blockers.push("Uncertain spend attribution records require reconciliation.");

    const complianceBlockers: string[] = [];
    const settlement = statement.mandate.settlement;
    if (settlement?.requireCleanverseIdentity || settlement?.requireVerifiedSettlement) {
      const unverified = statement.performance.knownUnknowns.filter((unknown) =>
        /Cleanverse verified settlement|CVI screening/i.test(unknown),
      );
      for (const unknown of unverified) {
        complianceBlockers.push(unknown);
        blockers.push(unknown);
      }
      if (
        statement.performance.evidenceCompleteness.cleanverseVerifiedSpendRecordCount === 0 &&
        statement.performance.evidenceCompleteness.spendRecordCount > 0
      ) {
        const msg =
          "Mandate requires Cleanverse verified settlement but no Cleanverse-settled spend records were found.";
        complianceBlockers.push(msg);
        blockers.push(msg);
      }
    }

    const score = blockers.length === 0
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (outcomesWithEvidence + verifiedSpendRecordCount) /
              Math.max(1, (outcomes.length || 1) + (spendRecordCount || 1)),
          ),
        );

    const remainingByAsset = Object.fromEntries(
      Object.entries(statement.capital.byAsset)
        .map(([asset, totals]) => [
          asset,
          (BigInt(totals.authorizedAmount) - BigInt(totals.consumedAmount) >= 0n
            ? BigInt(totals.authorizedAmount) - BigInt(totals.consumedAmount)
            : 0n
          ).toString(),
        ])
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    );

    // Mandate-wide ratio: verified wallet spend per asset divided by the total
    // number of independently verified outcomes. Intentionally not a financial
    // return figure and never rendered when no verified outcomes exist.
    const costPerObservedOutcomeByAsset =
      verifiedOutcomeCount === 0
        ? {}
        : Object.fromEntries(
            Object.entries(statement.capital.walletSpendByAsset)
              .map(([asset, consumed]) => [
                asset,
                (BigInt(consumed) / BigInt(verifiedOutcomeCount)).toString(),
              ])
              .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
          );

    const { stance, reasoning } = stanceReasoning(
      statement,
      verifiedOutcomeCount,
      uncertainCount,
      remainingByAsset,
      complianceBlockers,
    );

    return {
      version: 1,
      mandateId,
      workspaceId,
      generatedAt: new Date().toISOString(),
      statementId: statement.statementId,
      status: blockers.length === 0 ? "ready" : "insufficient_evidence",
      evidenceCompleteness: {
        score,
        outcomeCount: outcomes.length,
        outcomesWithEvidence,
        verifiedOutcomeCount,
        spendRecordCount,
        verifiedSpendRecordCount,
        blockers,
      },
      operationalMetrics: {
        costPerObservedOutcomeByAsset,
        verifiedOutcomeCount,
      },
      recommendation: { stance, reasoning },
      governanceNote:
        "Recommendations are advisory. A new allocation is never executed automatically; it requires explicit operator approval through the existing policy governance boundary.",
    };
  },
};
