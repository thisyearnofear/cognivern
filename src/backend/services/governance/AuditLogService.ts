import { AgentAction, PolicyCheck } from "@backend/types/Agent.js";
import logger from "@backend/utils/logger.js";
import { zeroGStorageService } from "@backend/services/blockchain/ZeroGStorageService.js";
import { filecoinStorageService } from "@backend/services/blockchain/FilecoinStorageService.js";
import { creRunStore, CreRunStore } from "@backend/cre/storage/CreRunStore.js";
import { CreRun, CreArtifact } from "@backend/cre/types.js";
import { ethers } from "ethers";
import crypto from "node:crypto";

export interface AuditLog {
  id: string;
  timestamp: string;
  agent: string;
  actionType: string;
  description: string;
  complianceStatus: "compliant" | "non-compliant" | "warning";
  severity: "low" | "medium" | "high" | "critical";
  responseTime?: number;
  details: Record<string, any>;
  policyChecks: PolicyCheck[];
  outcome: "allowed" | "denied";
  metadata: Record<string, any>;
  signingProvider?: "local" | "ledger" | "speculos" | "ows_remote";
  evidence: {
    hash: string;
    cid?: string;
    signature?: string;
    signer?: string;
    artifactIds?: string[];
    policyIds?: string[];
    citations?: string[];
    // Storage-anchoring fields surfaced from the CRE run so the audit
    // page's "Cross-Chain Anchoring" panel renders for real runs.
    zeroGRootHash?: string;
    filecoinCid?: string;
    filecoinTxHash?: string;
    // Suspicion score from the control-evaluation service. Surfaced here
    // so the audit page's "Suspicion Analysis" panel survives reloads.
    suspicion?: {
      composite: number;
      label: string;
      dimensions: Record<string, number>;
      escalated: boolean;
      reasoning: string[];
    };
    // AI usage (provider/model/tokens/cost) for the AI Spend insights.
    aiUsage?: {
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      taskClass: string;
    };
  };
}

export interface AuditInsight {
  id: string;
  type: "pattern" | "recommendation" | "trend" | "alert";
  title: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  actionRequired: boolean;
  relatedLogs: string[];
}

/**
 * Unified AuditLogService - Now a bridge to the Core Run Engine (CRE)
 *
 * Instead of separate audit logs, everything is a verifiable CRE run.
 */
export class AuditLogService {
  private creStore: CreRunStore;

  constructor(creStore: CreRunStore = creRunStore) {
    this.creStore = creStore;
    logger.info("AuditLogService initialized (CRE-Unified Mode)");
  }

  /**
   * Helper to get a signer for CRE evidence
   */
  private getSigner(): ethers.Signer | undefined {
    const pk = process.env.FILECOIN_PRIVATE_KEY;
    if (!pk) return undefined;
    return new ethers.Wallet(pk);
  }

  /**
   * Helper to sign evidence for an audit run
   */
  private async signEvidence(data: unknown) {
    const json = JSON.stringify(data);
    const hash = crypto.createHash("sha256").update(json).digest("hex");
    const signer = this.getSigner();
    if (!signer) return { hash };
    const signature = await signer.signMessage(
      ethers.getBytes(`0x${hash}`),
    );
    const signerAddress = await signer.getAddress();
    return { hash, signature, signer: signerAddress };
  }

  /**
   * Maps a Core Run (CRE) to a legacy AuditLog for UI compatibility.
   */
  public mapCreRunToAuditLog(run: CreRun): AuditLog {
    const lastStep = run.steps[run.steps.length - 1];

    // Surface real policyChecks from the run. The governance workflow
    // stores them on the last step's details.policyChecks, and/or on the
    // run's evidence block. Prefer step details (set by the workflow),
    // fall back to any artifact that carries them.
    const policyChecks = extractPolicyChecks(run);

    // Surface the on-chain txHash from attestation artifacts so the
    // audit page's "On-Chain" badge and explorer link render for real
    // attestation runs.
    const txHash = extractTxHash(run);

    // Confidential (FHE) metadata — present when the policy was evaluated
    // under Fhenix. The frontend gates its FHE badge on
    // confidential.fheEvaluated or a policyCheck.metadata.confidential
    // flag.
    const confidential = extractConfidential(run, policyChecks);

    // Suspicion score from the control-evaluation service. The governance
    // workflow writes it to evidence.suspicion; surface it so the audit
    // page's "Suspicion Analysis" panel renders post-reload.
    const suspicion = run.evidence?.suspicion;

    // AI usage (provider/model/tokens/cost) — written by the governance
    // workflow when the evaluator calls an LLM (Together AI / etc.).
    // Surfaced as a top-level field because AuditLogController reads
    // log.aiUsage directly for the AI Spend insights endpoint.
    const aiUsage = run.evidence?.aiUsage;

    // Build the base AuditLog, then attach the rich fields the frontend
    // audit page renders. We cast through Record<string, unknown> because
    // the legacy AuditLog interface doesn't declare confidential / txHash
    // / suspicion / aiUsage, but the frontend reads them via duck-typing.
    const log: AuditLog = {
      id: run.runId,
      timestamp: run.finishedAt || run.startedAt,
      agent: run.provenance?.model || "governance-agent",
      actionType: run.workflow,
      description: lastStep?.summary || `${run.workflow} execution`,
      complianceStatus: run.ok ? "compliant" : "non-compliant",
      severity: run.ok ? "low" : "medium",
      responseTime: run.metrics?.latencyMs,
      details: {
        ...run.metrics,
        stepCount: run.steps.length,
        artifactCount: run.artifacts.length,
        workflowVersion: run.provenance?.workflowVersion,
      },
      policyChecks,
      outcome: run.ok ? "allowed" : "denied",
      signingProvider: extractSigningProvider(run),
      metadata: {
        mode: run.mode,
        source: run.provenance?.source,
        parentRunId: run.parentRunId,
      },
      evidence: {
        hash: run.evidence?.hash || "pending",
        cid: run.evidence?.cid,
        signature: run.evidence?.signature,
        signer: run.evidence?.signer,
        artifactIds: run.artifacts.map((a) => a.id),
        // Preserve storage-anchoring fields so the audit page's
        // "Cross-Chain Anchoring" panel renders for real runs.
        zeroGRootHash: run.evidence?.zeroGRootHash,
        filecoinCid: run.evidence?.filecoinCid,
        filecoinTxHash: run.evidence?.filecoinTxHash,
        // Preserve the suspicion score so it survives a page reload.
        suspicion,
      },
    };

    // Attach fields the frontend reads via duck-typing but the legacy
    // AuditLog interface doesn't declare.
    const enriched = log as AuditLog & Record<string, unknown>;
    if (txHash) enriched.txHash = txHash;
    if (confidential) enriched.confidential = confidential;
    if (aiUsage) enriched.aiUsage = aiUsage;
    // Always expose artifacts so getOnChainTxHash() can find attestation
    // txHashes even when the workflow didn't surface them at top level.
    enriched.artifacts = run.artifacts;

    return enriched;
  }

  async logEvent(eventData: {
    eventType: string;
    agentType: string;
    timestamp: Date;
    details: Record<string, any>;
  }): Promise<void> {
    const runId = crypto.randomUUID();
    const startedAt = eventData.timestamp.toISOString();
    const finishedAt = new Date().toISOString();

    const artifact: CreArtifact = {
      id: crypto.randomUUID(),
      type: "attestation_request", // Map generic event to artifact
      createdAt: finishedAt,
      data: eventData.details,
    };

    const metrics = {
      latencyMs: eventData.details?.latencyMs ?? 0,
      stepCount: 1,
      artifactCount: 1,
    };

    const evidence = await this.signEvidence({
      runId,
      ok: true,
      status: "completed",
      metrics,
      artifactHashes: [
        ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(artifact.data))),
      ],
    });

    const workflowType =
      eventData.eventType === "agent_registration" ? "registration" : "generic";

    const run: CreRun = {
      runId,
      workflow: workflowType,
      mode: "cre",
      startedAt,
      finishedAt,
      ok: true,
      status: "completed",
      metrics,
      provenance: {
        source: "cognivern",
        model: eventData.agentType,
      },
      evidence,
      artifacts: [artifact],
      steps: [
        {
          kind: "compute",
          name: "audit_log_event",
          startedAt,
          finishedAt,
          ok: true,
          summary: `${eventData.agentType} agent performed ${eventData.eventType}`,
          details: eventData.details,
        },
      ],
    };

    await this.creStore.add(run);

    // Anchor event to 0G Storage (non-fatal, fire-and-forget with post-hoc update)
    zeroGStorageService
      .anchorAuditRecord({
        runId,
        workflow: workflowType,
        eventType: eventData.eventType,
        agentType: eventData.agentType,
        timestamp: startedAt,
        evidenceHash: evidence.hash,
      })
      .then(async (result) => {
        if (result) {
          run.evidence = {
            hash: run.evidence?.hash ?? "pending",
            ...(run.evidence ?? {}),
            zeroGRootHash: result.rootHash,
          };
          await this.creStore.replace(run);
        }
      })
      .catch(() => {});

    // Anchor event to Filecoin AIGovernanceStorage (non-fatal, fire-and-forget with post-hoc update)
    filecoinStorageService
      .anchorAuditRecord({
        runId,
        workflow: workflowType,
        eventType: eventData.eventType,
        agentType: eventData.agentType,
        timestamp: startedAt,
        evidenceHash: evidence.hash,
      })
      .then(async (result) => {
        if (result) {
          run.evidence = {
            hash: run.evidence?.hash ?? "pending",
            ...(run.evidence ?? {}),
            zeroGRootHash: run.evidence?.zeroGRootHash,
            filecoinCid: result.cid,
            filecoinTxHash: result.txHash,
          };
          await this.creStore.replace(run);
        }
      })
      .catch(() => {});
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean,
    options?: {
      suspicion?: Record<string, unknown>;
      aiUsage?: {
        provider: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        taskClass: string;
      };
    },
  ): Promise<string> {
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();

    const artifact: CreArtifact = {
      id: crypto.randomUUID(),
      type: "attestation_request",
      createdAt: now,
      data: { action, policyChecks },
    };

    const metrics = {
      latencyMs: action.metadata?.durationMs || 0,
      stepCount: 1,
      artifactCount: 1,
      // Surface AI cost on the run metrics so the runs page and audit
      // page can display it without re-deriving from evidence.
      estimatedCostUsd: options?.aiUsage?.costUsd,
      estimatedTokens: options?.aiUsage
        ? options.aiUsage.inputTokens + options.aiUsage.outputTokens
        : undefined,
    };

    const evidence = await this.signEvidence({
      runId,
      ok: allowed,
      status: "completed",
      metrics,
      artifactHashes: [
        ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(artifact.data))),
      ],
    });

    // Attach suspicion + aiUsage to the evidence block so they survive
    // reload and are surfaced by mapCreRunToAuditLog.
    if (options?.suspicion) {
      (evidence as Record<string, unknown>).suspicion = options.suspicion;
    }
    if (options?.aiUsage) {
      (evidence as Record<string, unknown>).aiUsage = options.aiUsage;
    }

    const run: CreRun = {
      runId,
      workflow: "governance",
      mode: "cre",
      startedAt: action.timestamp || now,
      finishedAt: now,
      ok: allowed,
      status: "completed",
      metrics,
      provenance: {
        source: "cognivern",
        model: String(action.metadata?.agentId || "governance-agent"),
      },
      evidence: evidence as CreRun["evidence"],
      artifacts: [artifact],
      steps: [
        {
          kind: "evm_write",
          name: action.type,
          startedAt: action.timestamp || now,
          finishedAt: now,
          ok: allowed,
          summary: action.description,
          details: {
            ...action.metadata,
            // Persist policyChecks on the step so mapCreRunToAuditLog's
            // extractPolicyChecks() can surface them on the audit page.
            policyChecks,
          },
        },
      ],
    };

    await this.creStore.add(run);

    // Anchor governance decision to 0G Storage (non-fatal, fire-and-forget with post-hoc update)
    zeroGStorageService
      .anchorAuditRecord({
        runId,
        workflow: "governance",
        outcome: allowed ? "allowed" : "denied",
        agentId: action.metadata?.agentId,
        actionType: action.type,
        timestamp: now,
        evidenceHash: evidence.hash,
      })
      .then(async (result) => {
        if (result) {
          run.evidence = {
            hash: run.evidence?.hash ?? "pending",
            ...(run.evidence ?? {}),
            zeroGRootHash: result.rootHash,
          };
          await this.creStore.replace(run);
        }
      })
      .catch(() => {
        /* already logged inside ZeroGStorageService */
      });

    // Anchor governance decision to Filecoin AIGovernanceStorage (non-fatal, fire-and-forget with post-hoc update)
    filecoinStorageService
      .anchorAuditRecord({
        runId,
        workflow: "governance",
        outcome: allowed ? "allowed" : "denied",
        agentId: action.metadata?.agentId,
        actionType: action.type,
        timestamp: now,
        evidenceHash: evidence.hash,
      })
      .then(async (result) => {
        if (result) {
          run.evidence = {
            hash: run.evidence?.hash ?? "pending",
            ...(run.evidence ?? {}),
            zeroGRootHash: run.evidence?.zeroGRootHash,
            filecoinCid: result.cid,
            filecoinTxHash: result.txHash,
          };
          await this.creStore.replace(run);
        }
      })
      .catch(() => {});

    return runId;
  }

  async getFilteredLogs(filters: {
    startDate?: string;
    endDate?: string;
    agent?: string;
    actionType?: string;
    complianceStatus?: string;
    severity?: string;
  }): Promise<AuditLog[]> {
    const runs = await this.creStore.list();
    let logs = runs.map((r) => this.mapCreRunToAuditLog(r));

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      logs = logs.filter((log) => new Date(log.timestamp) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      logs = logs.filter((log) => new Date(log.timestamp) <= end);
    }
    if (filters.agent && filters.agent !== "all") {
      logs = logs.filter((log) => log.agent === filters.agent);
    }
    if (filters.actionType && filters.actionType !== "all") {
      logs = logs.filter((log) => log.actionType === filters.actionType);
    }
    if (filters.complianceStatus && filters.complianceStatus !== "all") {
      logs = logs.filter(
        (log) => log.complianceStatus === filters.complianceStatus,
      );
    }
    if (filters.severity && filters.severity !== "all") {
      logs = logs.filter((log) => log.severity === filters.severity);
    }

    return logs;
  }

  async generateInsights(): Promise<AuditInsight[]> {
    // Insights should be derived from CRE runs in the future
    return [];
  }

  async resolveInsight(insightId: string): Promise<boolean> {
    return true;
  }

  /**
   * Fetch recent action history for a specific agent, mapped to the format
   * needed by ControlEvaluationService.scoreStatisticalAnomaly.
   * Returns up to 100 most recent actions from the last 30 days.
   */
  async getAgentHistory(agentId: string): Promise<Array<{ amount: number; vendor?: string; timestamp: string }>> {
    const logs = await this.getFilteredLogs({ agent: agentId });
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    return logs
      .filter((log) => new Date(log.timestamp).getTime() >= thirtyDaysAgo)
      .slice(-100)
      .map((log) => ({
        amount: Number(log.metadata?.amount ?? log.metadata?.amountUsd ?? 0),
        vendor: log.metadata?.vendor as string | undefined,
        timestamp: log.timestamp,
      }));
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    return this.getFilteredLogs({ startDate: startTime, endDate: endTime });
  }

  async searchLogs(options: any): Promise<AuditLog[]> {
    return this.getFilteredLogs(options);
  }

  async exportLogs(
    startDate: string,
    endDate: string,
    format: "json" | "csv",
  ): Promise<any> {
    const logs = await this.getFilteredLogs({ startDate, endDate });
    return { format, data: logs };
  }
}

function extractSigningProvider(run: CreRun): AuditLog["signingProvider"] {
  const artifact = run.artifacts.find(
    (a) => a.type === "attestation_result",
  );
  if (!artifact) return undefined;
  const sp = (artifact.data as Record<string, unknown>)?.signingProvider;
  if (
    sp === "local" ||
    sp === "ledger" ||
    sp === "speculos" ||
    sp === "ows_remote"
  ) {
    return sp;
  }
  return undefined;
}

/**
 * Extract policyChecks from a CRE run. The governance workflow stores
 * them on the last compute step's details.policyChecks. Fall back to
 * any artifact that carries them (e.g. spend_intent artifacts).
 */
function extractPolicyChecks(run: CreRun): PolicyCheck[] {
  // 1. Last step details
  for (let i = run.steps.length - 1; i >= 0; i--) {
    const step = run.steps[i];
    const details = step.details as Record<string, unknown> | undefined;
    const checks = details?.policyChecks;
    if (Array.isArray(checks) && checks.length > 0) {
      return checks as PolicyCheck[];
    }
  }
  // 2. Artifacts
  for (const artifact of run.artifacts) {
    const data = artifact.data as Record<string, unknown> | undefined;
    const checks = data?.policyChecks;
    if (Array.isArray(checks) && checks.length > 0) {
      return checks as PolicyCheck[];
    }
  }
  return [];
}

/**
 * Extract an on-chain txHash from attestation_result artifacts.
 */
function extractTxHash(run: CreRun): string | undefined {
  const artifact = run.artifacts.find((a) => a.type === "attestation_result");
  if (!artifact) return undefined;
  const data = artifact.data as Record<string, unknown> | undefined;
  const txHash = data?.txHash;
  if (typeof txHash === "string" && txHash.length > 0) {
    return txHash;
  }
  return undefined;
}

/**
 * Extract confidential (FHE) metadata. Present when any policyCheck was
 * evaluated under FHE (metadata.confidential === true) or when the run
 * carries Fhenix decision ids on its evidence block.
 */
function extractConfidential(
  run: CreRun,
  policyChecks: PolicyCheck[],
): Record<string, unknown> | undefined {
  const fheCheck = policyChecks.find(
    (c) =>
      (c.metadata as Record<string, unknown> | undefined)?.confidential === true,
  );
  const decisionIds: string[] = [];
  for (const c of policyChecks) {
    const meta = c.metadata as Record<string, unknown> | undefined;
    const did = meta?.decisionId;
    if (typeof did === "string") decisionIds.push(did);
  }
  if (fheCheck || decisionIds.length > 0) {
    return {
      fheEvaluated: true,
      chain: "fhenix-arbitrum-sepolia",
      decisionIds,
      attestations: policyChecks
        .map((c) => (c.metadata as Record<string, unknown> | undefined)?.attestation)
        .filter((a): a is string => typeof a === "string"),
    };
  }
  return undefined;
}
