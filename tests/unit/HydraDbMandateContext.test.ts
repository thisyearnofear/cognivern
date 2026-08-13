import { describe, expect, it } from "vitest";
import {
  collectionForWorkspace,
  mandateToHydraRecord,
  outcomeToHydraRecord,
  recommendationToHydraRecord,
  statementToHydraRecord,
} from "@backend/services/hydradb/HydraDbMandateContextRecords.js";
import {
  chunkBelongsToMandate,
  scopeGraphContext,
} from "@backend/services/hydradb/HydraDbMandateContextService.js";
import type { FundedMandate } from "@backend/services/governance/FundedMandateService.js";
import type { OutcomeObservation } from "@backend/services/governance/OutcomeObservationService.js";
import type { FundedMandateStatement } from "@backend/services/governance/StatementService.js";
import type { AllocationRecommendation } from "@backend/services/governance/AllocationRecommendationService.js";

describe("HydraDB mandate context mappings", () => {
  const mandate: FundedMandate = {
    id: "mandate-growth",
    workspaceId: "workspace/a",
    name: "Growth pilot",
    objective: "Acquire qualified customers",
    agentIds: ["agent-1"],
    status: "active",
    budget: {
      byAsset: {
        USDC: {
          authorizedAmount: "1000",
          allocatedAmount: "100",
          consumedAmount: "50",
          pendingAmount: "50",
        },
      },
    },
    policyIds: ["policy-1"],
    successMetrics: [{ id: "leads", name: "Qualified leads", unit: "leads", target: "10" }],
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };

  it("uses a workspace-specific collection and preserves mandate relationships", () => {
    const record = mandateToHydraRecord(mandate);

    expect(collectionForWorkspace("workspace/a")).toMatch(/^cognivern_workspace_workspace_a_[a-f0-9]{16}$/);
    expect(collectionForWorkspace("workspace/a")).not.toBe(collectionForWorkspace("workspace_a"));
    expect(record.id).toBe("cognivern_mandate_mandate-growth");
    expect(record.collection).toBe(collectionForWorkspace("workspace/a"));
    expect(record.additional_metadata).toMatchObject({
      workspace_id: "workspace/a",
      mandate_id: "mandate-growth",
      object_type: "mandate",
    });
    expect(record.relations?.ids).toEqual([
      "cognivern_agent_agent-1",
      "cognivern_policy_policy-1",
    ]);
    expect(record.content.text).toContain("Objective: Acquire qualified customers");
  });

  it("links outcomes to their mandate and evidence sources", () => {
    const observation: OutcomeObservation = {
      id: "outcome-1",
      mandateId: mandate.id,
      workspaceId: mandate.workspaceId,
      kind: "verified_external_state",
      value: "12",
      unit: "leads",
      observedAt: "2026-08-13T12:00:00.000Z",
      source: "CRM",
      confidence: "independently_verified",
      evidence: [
        { type: "run", reference: "run-1" },
        { type: "transaction", reference: "0xabc" },
        { type: "external_record", reference: "crm://private/outcome-1", hash: "hash-1" },
      ],
      notes: "Internal note that must remain in the authoritative ledger",
      createdAt: "2026-08-13T12:00:00.000Z",
    };

    const record = outcomeToHydraRecord(observation);
    expect(record.id).toBe("cognivern_outcome_outcome-1");
    expect(record.relations?.ids).toEqual([
      "cognivern_mandate_mandate-growth",
      "cognivern_run_run-1",
      "cognivern_transaction_0xabc",
    ]);
    expect(record.additional_metadata).toMatchObject({
      workspace_id: "workspace/a",
      mandate_id: "mandate-growth",
      object_type: "outcome",
      confidence: "independently_verified",
      evidence_types: ["run", "transaction", "external_record"],
    });
    expect(record.content.text).not.toContain("run-1");
    expect(record.content.text).not.toContain("crm://private/outcome-1");
    expect(record.content.text).not.toContain("Internal note that must remain");
    expect(record.content.text).toContain("external_record (hash-1)");
    expect(record.additional_metadata.canonical_url).toBe("/capital?mandate=mandate-growth#outcomes");
  });

  it("maps the bounded recommendation without making it an authorization", () => {
    const recommendation = {
      version: 1,
      mandateId: mandate.id,
      workspaceId: mandate.workspaceId,
      generatedAt: "2026-08-13T12:00:00.000Z",
      statementId: "candidate",
      status: "insufficient_evidence",
      evidenceCompleteness: {
        score: 0.5,
        outcomeCount: 1,
        outcomesWithEvidence: 1,
        verifiedOutcomeCount: 0,
        spendRecordCount: 1,
        verifiedSpendRecordCount: 0,
        blockers: ["No receipt"],
      },
      operationalMetrics: { costPerObservedOutcomeByAsset: {}, verifiedOutcomeCount: 0 },
      recommendation: { stance: "hold", reasoning: ["Review the evidence first."] },
      governanceNote: "Requires explicit operator approval through the governance boundary.",
    } satisfies AllocationRecommendation;

    const record = recommendationToHydraRecord(recommendation);
    expect(record.additional_metadata).toMatchObject({
      object_type: "mandate_recommendation",
      governance_advisory: true,
      stance: "hold",
    });
    expect(record.content.text).toContain("explicit operator approval");
  });

  it("links statement evidence without changing Cognivern's statement semantics", () => {
    const statement = {
      version: 1,
      statementId: "statement-mandate-growth-v1",
      mandate,
      capital: {
        byAsset: mandate.budget.byAsset,
        walletSpendByAsset: { USDC: "50" },
        cleanverseVerifiedSpendByAsset: {},
        cleanverseVerifiedShareOfConsumed: null,
      },
      performance: {
        outcomes: [],
        knownUnknowns: ["No independent outcome yet"],
        evidenceCompleteness: {
          outcomeCount: 0,
          outcomesWithEvidence: 0,
          spendRecordCount: 1,
          spendRecordsWithTransactionEvidence: 1,
          cleanverseVerifiedSpendRecordCount: 0,
        },
        attributionNote: "This is evidence, not causal attribution.",
      },
      evidence: {
        runIds: ["run-1"],
        allocationIds: ["allocation-1"],
        transactionHashes: ["0xabc"],
        externalReferences: ["crm://private/statement-source"],
      },
      generatedAt: "2026-08-13T12:00:00.000Z",
      contentHash: "a".repeat(64),
    } satisfies FundedMandateStatement;

    const record = statementToHydraRecord(statement);
    expect(record.id).toBe("cognivern_statement_mandate-growth_statement-mandate-growth-v1");
    expect(record.relations?.ids).toEqual([
      "cognivern_mandate_mandate-growth",
      "cognivern_run_run-1",
      "cognivern_transaction_0xabc",
    ]);
    expect(record.content.text).toContain("This is evidence, not causal attribution.");
    expect(record.content.text).not.toContain("crm://private/statement-source");
    expect(record.additional_metadata.canonical_url).toBe("/capital?mandate=mandate-growth#statement");
  });

  it("keeps mandate graph context and chunks scoped to the requested mandate", () => {
    const keptChunk = {
      id: "cognivern_run_kept",
      additional_metadata: { mandate_id: mandate.id },
    };
    const foreignChunk = {
      id: "cognivern_run_foreign",
      additional_metadata: { mandate_id: "other-mandate" },
    };
    const scoped = scopeGraphContext(
      {
        query_paths: [
          { source_chunk_ids: ["cognivern_run_kept"] },
          { source_chunk_ids: ["cognivern_run_foreign"], text: "Growth pilot" },
        ],
        chunk_relations: [
          { source_chunk_ids: ["cognivern_run_kept"] },
          { source_chunk_ids: ["cognivern_run_foreign"], text: "mandate-growth" },
        ],
        chunk_id_to_group_ids: {
          cognivern_run_kept: ["group-kept"],
          cognivern_run_foreign: ["group-foreign"],
        },
      },
      [keptChunk],
      mandate.id,
      mandate.name,
    );

    expect(chunkBelongsToMandate(keptChunk, mandate.id)).toBe(true);
    expect(chunkBelongsToMandate(foreignChunk, mandate.id)).toBe(false);
    expect(scoped?.query_paths).toEqual([{ source_chunk_ids: ["cognivern_run_kept"] }]);
    expect(scoped?.chunk_relations).toEqual([{ source_chunk_ids: ["cognivern_run_kept"] }]);
    expect(scoped?.chunk_id_to_group_ids).toEqual({ cognivern_run_kept: ["group-kept"] });
  });
});
