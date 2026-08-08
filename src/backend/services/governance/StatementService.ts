import { createHash } from "node:crypto";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import { FundedMandateService, type FundedMandate } from "./FundedMandateService.js";
import { OutcomeObservationService, type OutcomeObservation } from "./OutcomeObservationService.js";
import {
  buildSpendAttributionReport,
  getRunSpendAttribution,
  type SpendAttributionReport,
} from "./SpendAttributionService.js";

export interface FundedMandateStatement {
  version: 1;
  statementId: string;
  mandate: FundedMandate;
  capital: {
    byAsset: Record<string, {
      authorizedAmount: string;
      allocatedAmount: string;
      consumedAmount: string;
      pendingAmount: string;
    }>;
    walletSpendByAsset: Record<string, string>;
  };
  performance: {
    outcomes: OutcomeObservation[];
    knownUnknowns: string[];
    evidenceCompleteness: {
      outcomeCount: number;
      outcomesWithEvidence: number;
      spendRecordCount: number;
      spendRecordsWithTransactionEvidence: number;
    };
    attributionNote: string;
  };
  evidence: {
    runIds: string[];
    allocationIds: string[];
    transactionHashes: string[];
    externalReferences: string[];
  };
  generatedAt: string;
  contentHash: string;
}

type StatementPayload = Omit<FundedMandateStatement, "contentHash">;

/** Canonical JSON for statement hashing: sorted object keys, preserved arrays. */
export function canonicalStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  return "null";
}

export function hashStatementPayload(payload: StatementPayload | FundedMandateStatement): string {
  // Strip the display timestamp AND any embedded contentHash so the reported
  // hash is reproducible from the returned payload alone (spec: the hash
  // covers the canonical payload excluding contentHash itself and generatedAt).
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...stablePayload } = payload as Record<string, unknown>;
  return createHash("sha256")
    .update(canonicalStringify(stablePayload), "utf8")
    .digest("hex");
}

function inMeasurementWindow(timestamp: string, mandate: FundedMandate): boolean {
  const window = mandate.measurementWindow;
  if (!window) return true;
  const observedAt = new Date(timestamp).getTime();
  const startsAt = new Date(window.startsAt).getTime();
  const endsAt = window.endsAt ? new Date(window.endsAt).getTime() : undefined;
  if (!Number.isFinite(observedAt) || !Number.isFinite(startsAt)) return false;
  return observedAt >= startsAt && (endsAt === undefined || observedAt <= endsAt);
}

function buildCapital(
  mandate: FundedMandate,
  report: SpendAttributionReport,
): FundedMandateStatement["capital"] {
  const assets = new Set([
    ...Object.keys(mandate.budget.byAsset),
    ...Object.keys(report.totalsByAsset),
  ]);
  const byAsset: FundedMandateStatement["capital"]["byAsset"] = {};

  for (const asset of [...assets].sort()) {
    const budget = mandate.budget.byAsset[asset];
    const totals = report.totalsByAsset[asset];
    byAsset[asset] = {
      authorizedAmount: budget?.authorizedAmount || "0",
      // Allocation and consumption are derived from governed attribution.
      allocatedAmount: totals?.allocatedAmount || "0",
      consumedAmount: totals?.consumedAmount || "0",
      pendingAmount: totals?.pendingAmount || "0",
    };
  }

  return {
    byAsset,
    walletSpendByAsset: report.records
      .filter((record) => record.status === "consumed" && Boolean(record.transactionHash))
      .reduce((totals, record) => {
        totals[record.asset] = (BigInt(totals[record.asset] || "0") + BigInt(record.consumedAmount)).toString();
        return totals;
      }, {} as Record<string, string>),
  };
}

function buildKnownUnknowns(
  mandate: FundedMandate,
  report: SpendAttributionReport,
  observations: OutcomeObservation[],
): string[] {
  const unknowns: string[] = [];
  if (report.totalRecords === 0) {
    unknowns.push("No governed spend attribution records were found in the mandate measurement window.");
  }
  if (report.counts.uncertain > 0) {
    unknowns.push(`${report.counts.uncertain} spend attribution record(s) remain uncertain and require reconciliation.`);
  }
  if (observations.length === 0) {
    unknowns.push("No outcome observations were recorded in the mandate measurement window.");
  }
  if (observations.some((observation) => observation.evidence.length === 0)) {
    unknowns.push("One or more outcome observations have no evidence reference.");
  }
  if (report.records.some((record) => record.status === "consumed" && !record.transactionHash)) {
    unknowns.push("One or more consumed attribution records have no transaction hash in their evidence.");
  }

  const budgetAssets = new Set(Object.keys(mandate.budget.byAsset));
  for (const asset of Object.keys(report.totalsByAsset)) {
    if (!budgetAssets.has(asset)) {
      unknowns.push(`Derived governed allocation for ${asset} has no matching mandate authorization.`);
    }
  }
  for (const [asset, budget] of Object.entries(mandate.budget.byAsset)) {
    const totals = report.totalsByAsset[asset];
    if (totals && totals.allocatedAmount !== budget.allocatedAmount) {
      unknowns.push(`Mandate-entered allocated amount for ${asset} differs from derived governed attribution; the statement uses the derived amount.`);
    }
    if (totals && BigInt(totals.allocatedAmount) > BigInt(budget.authorizedAmount)) {
      unknowns.push(`Derived governed allocation for ${asset} exceeds the mandate authorization; no additional allocation is recommended.`);
    }
  }
  return [...new Set(unknowns)];
}

export const StatementService = {
  async generateCandidate(
    workspaceId: string,
    mandateId: string,
  ): Promise<FundedMandateStatement> {
    const mandate = FundedMandateService.get(workspaceId, mandateId);
    if (!mandate) throw new Error("Mandate not found");

    const allWorkspaceRuns = (await creRunStore.list()).filter((run) => {
      if (run.projectId !== workspaceId) return false;
      const attribution = getRunSpendAttribution(run);
      return Boolean(attribution && attribution.workspaceId === workspaceId && attribution.mandateId === mandateId);
    });
    const report = buildSpendAttributionReport(
      allWorkspaceRuns,
      mandateId,
      (record) => inMeasurementWindow(record.recordedAt, mandate),
    );
    const observations = OutcomeObservationService
      .list(workspaceId, mandateId)
      .filter((observation) => inMeasurementWindow(observation.observedAt, mandate));

    const transactionHashes = [...new Set(
      report.records
        .map((record) => record.transactionHash)
        .filter((hash): hash is string => Boolean(hash)),
    )].sort();
    const externalReferences = [...new Set(
      observations.flatMap((observation) => observation.evidence.map((evidence) => evidence.reference)),
    )].sort();
    const runIds = [...new Set(report.records.map((record) => record.runId))].sort();
    const allocationIds = [...new Set(report.records.map((record) => record.allocationId))].sort();
    const outcomesWithEvidence = observations.filter((observation) => observation.evidence.length > 0).length;

    const payload: StatementPayload = {
      version: 1,
      statementId: "candidate",
      mandate,
      capital: buildCapital(mandate, report),
      performance: {
        outcomes: observations,
        knownUnknowns: buildKnownUnknowns(mandate, report, observations),
        evidenceCompleteness: {
          outcomeCount: observations.length,
          outcomesWithEvidence,
          spendRecordCount: report.records.length,
          spendRecordsWithTransactionEvidence: report.records.filter((record) => Boolean(record.transactionHash)).length,
        },
        attributionNote: "This statement links governed spend to observed evidence; it does not establish causal attribution or financial performance.",
      },
      evidence: {
        runIds,
        allocationIds,
        transactionHashes,
        externalReferences,
      },
      generatedAt: new Date().toISOString(),
    };

    const overAuthorizedAssets = Object.entries(payload.capital.byAsset).filter(
      ([, totals]) => BigInt(totals.allocatedAmount) > BigInt(totals.authorizedAmount),
    );
    if (overAuthorizedAssets.length > 0) {
      throw new Error(
        `Mandate statement cannot be generated: derived allocation exceeds authorization for ${overAuthorizedAssets.map(([asset]) => asset).join(", ")}`,
      );
    }

    return {
      ...payload,
      contentHash: hashStatementPayload(payload),
    };
  },
};
