import type { CreArtifact, CreRun, SpendAttribution } from "@backend/cre/types.js";

export interface SpendAttributionReportRecord extends SpendAttribution {
  runId: string;
  runStatus?: CreRun["status"];
  recordedAt: string;
}

export interface SpendAttributionReport {
  generatedAt: string;
  totalRecords: number;
  totalsByAsset: Record<
    string,
    {
      allocatedAmount: string;
      consumedAmount: string;
      pendingAmount: string;
      recordCount: number;
    }
  >;
  counts: {
    allocated: number;
    consumed: number;
    held: number;
    denied: number;
    failed: number;
    uncertain: number;
  };
  records: SpendAttributionReportRecord[];
}

const INTEGER_AMOUNT = /^\d+$/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function getAttributionArtifact(run: CreRun): CreArtifact | undefined {
  return [...run.artifacts]
    .reverse()
    .find((artifact) => artifact.type === "capital_attribution");
}

export function getRunSpendAttribution(run: CreRun): SpendAttribution | undefined {
  const data = asRecord(getAttributionArtifact(run)?.data);
  if (!data) return undefined;

  const status = data.status;
  if (
    status !== "allocated" &&
    status !== "consumed" &&
    status !== "held" &&
    status !== "denied" &&
    status !== "failed" &&
    status !== "uncertain"
  ) {
    return undefined;
  }

  const stringField = (key: keyof SpendAttribution): string | undefined =>
    typeof data[key] === "string" ? (data[key] as string) : undefined;

  const record = {
    version: typeof data.version === "number" ? data.version : 1,
    allocationId: stringField("allocationId"),
    intentId: stringField("intentId"),
    agentId: stringField("agentId"),
    asset: stringField("asset"),
    requestedAmount: stringField("requestedAmount"),
    allocatedAmount: stringField("allocatedAmount"),
    consumedAmount: stringField("consumedAmount"),
    status,
  } as SpendAttribution;

  if (
    !record.allocationId ||
    !record.intentId ||
    !record.agentId ||
    !record.asset ||
    !record.requestedAmount ||
    !record.allocatedAmount ||
    !record.consumedAmount ||
    !INTEGER_AMOUNT.test(record.requestedAmount) ||
    !INTEGER_AMOUNT.test(record.allocatedAmount) ||
    !INTEGER_AMOUNT.test(record.consumedAmount)
  ) {
    return undefined;
  }

  return {
    ...record,
    workspaceId: stringField("workspaceId"),
    mandateId: stringField("mandateId"),
    budgetId: stringField("budgetId"),
    policyId: stringField("policyId"),
    provider: stringField("provider"),
    executionId: stringField("executionId"),
    transactionHash: stringField("transactionHash"),
    transactionLink: stringField("transactionLink"),
    outcome: stringField("outcome"),
    recordedAt: stringField("recordedAt"),
  };
}

function addAmount(target: bigint, value: string): bigint {
  return target + BigInt(value);
}

export function buildSpendAttributionReport(
  runs: CreRun[],
  mandateId?: string,
  recordFilter?: (record: SpendAttributionReportRecord) => boolean,
): SpendAttributionReport {
  const records: SpendAttributionReportRecord[] = [];
  const latestByIntent = new Map<string, SpendAttributionReportRecord>();
  const totalsByAsset: SpendAttributionReport["totalsByAsset"] = {};
  const counts: SpendAttributionReport["counts"] = {
    allocated: 0,
    consumed: 0,
    held: 0,
    denied: 0,
    failed: 0,
    uncertain: 0,
  };

  for (const run of runs) {
    const attribution = getRunSpendAttribution(run);
    if (!attribution || (mandateId && attribution.mandateId !== mandateId)) continue;
    const record: SpendAttributionReportRecord = {
      ...attribution,
      runId: run.runId,
      runStatus: run.status,
      recordedAt: attribution.recordedAt || run.finishedAt || run.startedAt,
    };
    const previous = latestByIntent.get(record.intentId);
    const recordTime = new Date(record.recordedAt).getTime();
    const previousTime = previous ? new Date(previous.recordedAt).getTime() : -Infinity;
    // Prefer a reconciled/consumed lifecycle over an uncertain or held one
    // when records share a timestamp. Child/reconciled records are persisted
    // independently, so insertion order must never decide which lifecycle
    // state the report exposes.
    const statusRank: Record<SpendAttribution['status'], number> = {
      consumed: 5,
      allocated: 4,
      held: 3,
      uncertain: 2,
      failed: 1,
      denied: 0,
    };
    const recordRank = statusRank[record.status];
    const previousRank = previous ? statusRank[previous.status] : -1;
    if (
      !previous ||
      recordTime > previousTime ||
      (recordTime === previousTime &&
        (recordRank > previousRank ||
          (recordRank === previousRank && record.runId > previous.runId)))
    ) {
      latestByIntent.set(record.intentId, record);
    }
  }

  for (const record of latestByIntent.values()) {
    if (recordFilter && !recordFilter(record)) continue;
    records.push(record);
    counts[record.status] += 1;
    if (record.allocatedAmount !== '0') counts.allocated += 1;

    const asset = record.asset;
    const current = totalsByAsset[asset] || {
      allocatedAmount: "0",
      consumedAmount: "0",
      pendingAmount: "0",
      recordCount: 0,
    };
    const allocated = addAmount(BigInt(current.allocatedAmount), record.allocatedAmount);
    const consumed = addAmount(BigInt(current.consumedAmount), record.consumedAmount);
    totalsByAsset[asset] = {
      allocatedAmount: allocated.toString(),
      consumedAmount: consumed.toString(),
      pendingAmount: (allocated - consumed >= 0n ? allocated - consumed : 0n).toString(),
      recordCount: current.recordCount + 1,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    totalsByAsset,
    counts,
    records: recordFilter ? records : records.slice(0, 100),
  };
}
