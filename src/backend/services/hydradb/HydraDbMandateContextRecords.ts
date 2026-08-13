import { createHash } from "node:crypto";
import type { FundedMandate } from "@backend/services/governance/FundedMandateService.js";
import type { OutcomeObservation } from "@backend/services/governance/OutcomeObservationService.js";
import type { FundedMandateStatement } from "@backend/services/governance/StatementService.js";
import type { AllocationRecommendation } from "@backend/services/governance/AllocationRecommendationService.js";
import type { AppKnowledgeRecord } from "./HydraDbIngestionService.js";

export function collectionForWorkspace(workspaceId: string): string {
  // Keep the collection name readable, but include a digest so IDs such as
  // "team/a" and "team_a" cannot collide and merge tenants in HydraDB.
  const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const workspaceDigest = createHash("sha256").update(workspaceId).digest("hex").slice(0, 16);
  return `cognivern_workspace_${safeWorkspaceId}_${workspaceDigest}`;
}

function metadata(workspaceId: string, mandateId: string, objectType: string): Record<string, unknown> {
  return {
    workspace_id: workspaceId,
    mandate_id: mandateId,
    object_type: objectType,
    origin: "cognivern_mandate_graph",
  };
}

function relationIds(...ids: Array<string | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function mandateToHydraRecord(mandate: FundedMandate): AppKnowledgeRecord {
  const relations = relationIds(
    ...mandate.agentIds.map((agentId) => `cognivern_agent_${agentId}`),
    ...mandate.policyIds.map((policyId) => `cognivern_policy_${policyId}`),
  );
  return {
    id: `cognivern_mandate_${mandate.id}`,
    database: "cognivern",
    collection: collectionForWorkspace(mandate.workspaceId),
    title: `Funded mandate — ${mandate.name}`,
    type: "mandate",
    url: `https://cognivern.persidian.com/capital?mandate=${encodeURIComponent(mandate.id)}`,
    timestamp: mandate.updatedAt,
    content: {
      text: [
        `Funded mandate: ${mandate.name}`,
        `Objective: ${mandate.objective}`,
        `Status: ${mandate.status}`,
        `Updated: ${mandate.updatedAt}`,
        `Agents: ${mandate.agentIds.join(", ") || "none assigned"}`,
        mandate.agentIds.length > 0 ? `The mandate authorizes agent(s) ${mandate.agentIds.join(", ")} to pursue the objective.` : "The mandate has no assigned agents.",
        `Policies: ${mandate.policyIds.join(", ") || "none assigned"}`,
        mandate.policyIds.length > 0 ? `The mandate uses policy/policies ${mandate.policyIds.join(", ")} for governed spend.` : "The mandate has no assigned policies.",
        `Budget: ${JSON.stringify(mandate.budget.byAsset)}`,
        mandate.measurementWindow
          ? `Measurement window: ${mandate.measurementWindow.startsAt} → ${mandate.measurementWindow.endsAt ?? "open"}`
          : "",
        mandate.successMetrics.length > 0
          ? `Success metrics: ${mandate.successMetrics.map((metric) => `${metric.name} (${metric.unit})`).join(", ")}`
          : "Success metrics: none configured",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    tenant_metadata: {
      workspace_id: mandate.workspaceId,
      mandate_id: mandate.id,
      object_type: "mandate",
    },
    additional_metadata: {
      ...metadata(mandate.workspaceId, mandate.id, "mandate"),
      record_id: mandate.id,
      canonical_url: `/capital?mandate=${encodeURIComponent(mandate.id)}`,
    },
    relations: { ids: relations },
  };
}

export function outcomeToHydraRecord(observation: OutcomeObservation): AppKnowledgeRecord {
  // Notes and raw external references intentionally stay in Cognivern's
  // authoritative ledger. The derived index receives only evidence types and
  // integrity hashes, so a HydraDB compromise does not disclose private URLs
  // or operator notes.
  const evidenceText = observation.evidence
    .map((evidence) => `${evidence.type}${evidence.hash ? ` (${evidence.hash})` : ""}`)
    .join(", ");
  const evidenceRelations = observation.evidence.map((evidence) => {
    if (evidence.type === "run") return `cognivern_run_${evidence.reference}`;
    if (evidence.type === "transaction") return `cognivern_transaction_${evidence.reference}`;
    return undefined;
  });
  return {
    id: `cognivern_outcome_${observation.id}`,
    database: "cognivern",
    collection: collectionForWorkspace(observation.workspaceId),
    title: `Outcome observation — ${observation.value} ${observation.unit}`,
    type: "outcome",
    url: `/capital?mandate=${encodeURIComponent(observation.mandateId)}#outcomes`,
    timestamp: observation.observedAt,
    content: {
      text: [
        `Outcome observation for mandate ${observation.mandateId}: ${observation.value} ${observation.unit}`,
        `The mandate evidence graph links this outcome to mandate ${observation.mandateId}.`,
        `Kind: ${observation.kind}; confidence: ${observation.confidence}`,
        `Source: ${observation.source}`,
        evidenceText ? `Evidence: ${evidenceText}` : "Evidence: none recorded",
        observation.notes ? "Notes: recorded in Cognivern (omitted from derived index)" : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    tenant_metadata: {
      workspace_id: observation.workspaceId,
      mandate_id: observation.mandateId,
      object_type: "outcome",
      confidence: observation.confidence,
    },
    additional_metadata: {
      ...metadata(observation.workspaceId, observation.mandateId, "outcome"),
      outcome_id: observation.id,
      metric_id: observation.metricId,
      kind: observation.kind,
      confidence: observation.confidence,
      source: observation.source,
      observed_at: observation.observedAt,
      record_id: observation.id,
      canonical_url: `/capital?mandate=${encodeURIComponent(observation.mandateId)}#outcomes`,
      evidence_types: observation.evidence.map((evidence) => evidence.type),
      evidence_reference_count: observation.evidence.length,
    },
    relations: {
      ids: relationIds(`cognivern_mandate_${observation.mandateId}`, ...evidenceRelations),
    },
  };
}

export function recommendationToHydraRecord(recommendation: AllocationRecommendation): AppKnowledgeRecord {
  return {
    id: `cognivern_recommendation_${recommendation.mandateId}`,
    database: "cognivern",
    collection: collectionForWorkspace(recommendation.workspaceId),
    title: `Allocation review — ${recommendation.recommendation.stance}`,
    type: "mandate_recommendation",
    url: `/capital?mandate=${encodeURIComponent(recommendation.mandateId)}#recommendation`,
    timestamp: recommendation.generatedAt,
    content: {
      text: [
        `Current allocation recommendation for mandate ${recommendation.mandateId}: ${recommendation.recommendation.stance}`,
        `Evidence status: ${recommendation.status}; completeness score: ${recommendation.evidenceCompleteness.score}`,
        `Blockers: ${recommendation.evidenceCompleteness.blockers.join(" | ") || "none"}`,
        `Reasoning: ${recommendation.recommendation.reasoning.join(" | ") || "none"}`,
        `Governance boundary: ${recommendation.governanceNote}`,
      ].join("\n"),
    },
    tenant_metadata: {
      workspace_id: recommendation.workspaceId,
      mandate_id: recommendation.mandateId,
      object_type: "mandate_recommendation",
    },
    additional_metadata: {
      ...metadata(recommendation.workspaceId, recommendation.mandateId, "mandate_recommendation"),
      record_id: recommendation.mandateId,
      canonical_url: `/capital?mandate=${encodeURIComponent(recommendation.mandateId)}#recommendation`,
      stance: recommendation.recommendation.stance,
      status: recommendation.status,
      blocker_count: recommendation.evidenceCompleteness.blockers.length,
      governance_advisory: true,
    },
    relations: { ids: [`cognivern_mandate_${recommendation.mandateId}`] },
  };
}

export function statementToHydraRecord(statement: FundedMandateStatement): AppKnowledgeRecord {
  const mandateId = statement.mandate.id;
  const relations = relationIds(
    `cognivern_mandate_${mandateId}`,
    ...statement.evidence.runIds.map((runId) => `cognivern_run_${runId}`),
    ...statement.evidence.transactionHashes.map((hash) => `cognivern_transaction_${hash}`),
  );
  return {
    // Candidate statements use a shared display statementId, so the mandate
    // must be part of the derived-store key to prevent cross-mandate upserts.
    id: `cognivern_statement_${mandateId}_${statement.statementId}`,
    database: "cognivern",
    collection: collectionForWorkspace(statement.mandate.workspaceId),
    title: `Mandate statement — ${statement.mandate.name}`,
    type: "mandate_statement",
    url: `/capital?mandate=${encodeURIComponent(mandateId)}#statement`,
    timestamp: statement.generatedAt,
    content: {
      text: [
        `Mandate statement ${statement.statementId} for ${statement.mandate.name}`,
        `This statement evidences mandate ${mandateId} and links governed runs to observed outcomes and transaction receipts.`,
        `Objective: ${statement.mandate.objective}`,
        `Capital by asset: ${JSON.stringify(statement.capital.byAsset)}`,
        `Outcomes: ${statement.performance.outcomes.length}; spend records: ${statement.performance.evidenceCompleteness.spendRecordCount}; evidence completeness: ${JSON.stringify(statement.performance.evidenceCompleteness)}`,
        `Known unknowns: ${statement.performance.knownUnknowns.join(" | ") || "none"}`,
        `Attribution note: ${statement.performance.attributionNote}`,
        `Content hash: ${statement.contentHash}`,
      ].join("\n"),
    },
    tenant_metadata: {
      workspace_id: statement.mandate.workspaceId,
      mandate_id: mandateId,
      object_type: "mandate_statement",
    },
    additional_metadata: {
      ...metadata(statement.mandate.workspaceId, mandateId, "mandate_statement"),
      statement_id: statement.statementId,
      content_hash: statement.contentHash,
      known_unknown_count: statement.performance.knownUnknowns.length,
      run_count: statement.evidence.runIds.length,
      transaction_count: statement.evidence.transactionHashes.length,
      record_id: statement.statementId,
      canonical_url: `/capital?mandate=${encodeURIComponent(mandateId)}#statement`,
    },
    relations: { ids: relations },
  };
}
