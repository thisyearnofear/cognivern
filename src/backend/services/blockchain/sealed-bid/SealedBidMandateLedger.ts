import { randomUUID } from "node:crypto";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreArtifact, CreRun } from "@backend/cre/types.js";
import { getRunSpendAttribution } from "@backend/services/governance/SpendAttributionService.js";
import type { BackendName } from "./types.js";

/**
 * Links a sealed-bid round to a funded mandate through the CRE ledger.
 *
 * The round itself lives on the auction backend (Canton/FHE); what the
 * mandate statement needs is a `capital_attribution` artifact on a run whose
 * projectId is the workspace — the same shape StatementService already
 * aggregates. Allocation is recorded when the round is created, then
 * finalized as `consumed` on reveal or `failed` (escrow returned) on cancel.
 * The `allocationId`/`intentId` convention `sealed-bid:<roundId>` makes each
 * round's record deduplicate against its own latest artifact.
 */

export interface SealedBidMandateLink {
  runId: string;
  workspaceId: string;
  mandateId: string;
}

interface SealedBidRunStore {
  add(run: CreRun): Promise<void>;
  get(runId: string): Promise<CreRun | undefined>;
  replace(run: CreRun): Promise<void>;
  list(): Promise<CreRun[]>;
}

const ALLOCATION_PREFIX = "sealed-bid:";

function allocationIdFor(roundId: string): string {
  return `${ALLOCATION_PREFIX}${roundId}`;
}

function attributionArtifact(
  base: {
    roundId: string;
    workspaceId: string;
    mandateId: string;
    agentId: string;
    asset: string;
    requestedAmount: string;
    backend: BackendName;
  },
  amounts: {
    allocatedAmount: string;
    consumedAmount: string;
    status: "allocated" | "consumed" | "failed";
    outcome: string;
  },
): CreArtifact {
  const recordedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    type: "capital_attribution",
    createdAt: recordedAt,
    data: {
      version: 1,
      allocationId: allocationIdFor(base.roundId),
      intentId: allocationIdFor(base.roundId),
      workspaceId: base.workspaceId,
      mandateId: base.mandateId,
      agentId: base.agentId,
      asset: base.asset,
      requestedAmount: base.requestedAmount,
      allocatedAmount: amounts.allocatedAmount,
      consumedAmount: amounts.consumedAmount,
      status: amounts.status,
      provider: `sealed-bid:${base.backend}`,
      executionId: base.roundId,
      transactionLink: `/verify?round=${base.roundId}`,
      outcome: amounts.outcome,
      recordedAt,
    },
  };
}

export function createSealedBidMandateLedger(
  store: SealedBidRunStore = creRunStore,
) {
  const linkByRoundId = new Map<string, SealedBidMandateLink>();

  async function recordAllocation(params: {
    roundId: string;
    workspaceId: string;
    mandateId: string;
    agentId: string;
    asset: string;
    amountBase: string;
    backend: BackendName;
  }): Promise<void> {
    const startedAt = new Date().toISOString();
    const run: CreRun = {
      runId: randomUUID(),
      projectId: params.workspaceId,
      workflow: "spend",
      mode: "cre",
      startedAt,
      ok: false,
      status: "running",
      provenance: { source: "cognivern", model: params.agentId },
      events: [],
      steps: [],
      artifacts: [
        attributionArtifact(
          {
            roundId: params.roundId,
            workspaceId: params.workspaceId,
            mandateId: params.mandateId,
            agentId: params.agentId,
            asset: params.asset,
            requestedAmount: params.amountBase,
            backend: params.backend,
          },
          {
            allocatedAmount: params.amountBase,
            consumedAmount: "0",
            status: "allocated",
            outcome: "escrowed_for_round",
          },
        ),
      ],
    };
    await store.add(run);
    linkByRoundId.set(params.roundId, {
      runId: run.runId,
      workspaceId: params.workspaceId,
      mandateId: params.mandateId,
    });
  }

  async function finalize(
    roundId: string,
    amounts: {
      allocatedAmount: string;
      consumedAmount: string;
      status: "consumed" | "failed";
      outcome: string;
    },
    runStatus: CreRun["status"],
    ok: boolean,
  ): Promise<void> {
    const link = linkByRoundId.get(roundId);
    if (!link) return;
    const run = await store.get(link.runId);
    if (!run) return;
    const latest = getRunSpendAttribution(run);
    run.artifacts = [
      ...run.artifacts,
      attributionArtifact(
        {
          roundId,
          workspaceId: link.workspaceId,
          mandateId: link.mandateId,
          agentId: latest?.agentId ?? "sealed-bid",
          asset: latest?.asset ?? "USDC",
          requestedAmount: latest?.requestedAmount ?? amounts.allocatedAmount,
          backend:
            (latest?.provider?.split(":")[1] as BackendName | undefined) ??
            "fhe",
        },
        amounts,
      ),
    ];
    run.status = runStatus;
    run.ok = ok;
    run.finishedAt = new Date().toISOString();
    await store.replace(run);
  }

  return {
    recordAllocation,

    /** Reveal settles the escrow to the winner — the allocation is consumed. */
    async recordSettlement(roundId: string): Promise<void> {
      const link = linkByRoundId.get(roundId);
      if (!link) return;
      const run = await store.get(link.runId);
      const amount = run ? getRunSpendAttribution(run)?.allocatedAmount : undefined;
      if (!amount) return;
      await finalize(
        roundId,
        {
          allocatedAmount: amount,
          consumedAmount: amount,
          status: "consumed",
          outcome: "awarded_to_winner",
        },
        "completed",
        true,
      );
    },

    /** Cancel returns the escrow — the allocation is voided, nothing spent. */
    async recordCancellation(roundId: string): Promise<void> {
      const link = linkByRoundId.get(roundId);
      if (!link) return;
      await finalize(
        roundId,
        {
          allocatedAmount: "0",
          consumedAmount: "0",
          status: "failed",
          outcome: "round_cancelled_escrow_returned",
        },
        "cancelled",
        true,
      );
    },

    getLink(roundId: string): SealedBidMandateLink | undefined {
      return linkByRoundId.get(roundId);
    },

    /**
     * Repopulate the in-memory link map from persisted runs. The latest
     * capital_attribution artifact is authoritative; only records under the
     * `sealed-bid:` allocation prefix belong to this ledger.
     */
    async rebuild(): Promise<Map<string, SealedBidMandateLink>> {
      linkByRoundId.clear();
      for (const run of await store.list()) {
        const attribution = getRunSpendAttribution(run);
        if (!attribution?.allocationId.startsWith(ALLOCATION_PREFIX)) continue;
        const roundId = attribution.allocationId.slice(ALLOCATION_PREFIX.length);
        linkByRoundId.set(roundId, {
          runId: run.runId,
          workspaceId: attribution.workspaceId ?? run.projectId,
          mandateId: attribution.mandateId ?? "",
        });
      }
      return linkByRoundId;
    },
  };
}

export const sealedBidMandateLedger = createSealedBidMandateLedger();
