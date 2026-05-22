import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";
import { zeroGStorageService } from "./ZeroGStorageService.js";
import { creRunStore, CreRunStore } from "../cre/storage/CreRunStore.js";
import { CreRun, CreArtifact } from "../cre/types.js";
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
  evidence: {
    hash: string;
    cid?: string;
    signature?: string;
    signer?: string;
    artifactIds?: string[];
    policyIds?: string[];
    citations?: string[];
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
  private async signEvidence(data: any) {
    const signer = this.getSigner();
    if (!signer) return { hash: "unsigned" };
    const json = JSON.stringify(data);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(json));
    const signature = await signer.signMessage(hash);
    const signerAddress = await signer.getAddress();
    return { hash, signature, signer: signerAddress };
  }

  /**
   * Maps a Core Run (CRE) to a legacy AuditLog for UI compatibility.
   */
  public mapCreRunToAuditLog(run: CreRun): AuditLog {
    const lastStep = run.steps[run.steps.length - 1];

    return {
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
      policyChecks: [],
      outcome: run.ok ? "allowed" : "denied",
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
        artifactIds: run.artifacts.map(a => a.id),
      },
    };
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
      latencyMs: 0,
      stepCount: 1,
      artifactCount: 1,
    };

    const evidence = await this.signEvidence({
      runId,
      ok: true,
      status: "completed",
      metrics,
      artifactHashes: [ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(artifact.data)))],
    });

    const workflowType =
      eventData.eventType === "agent_registration"
        ? "registration"
        : "generic";

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
      steps: [{
        kind: "compute",
        name: "audit_log_event",
        startedAt,
        finishedAt,
        ok: true,
        summary: `${eventData.agentType} agent performed ${eventData.eventType}`,
        details: eventData.details,
      }],
    };

    await this.creStore.add(run);
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean,
  ): Promise<void> {
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
    };

    const evidence = await this.signEvidence({
      runId,
      ok: allowed,
      status: "completed",
      metrics,
      artifactHashes: [ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(artifact.data)))],
    });

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
      evidence,
      artifacts: [artifact],
      steps: [{
        kind: "evm_write",
        name: action.type,
        startedAt: action.timestamp || now,
        finishedAt: now,
        ok: allowed,
        summary: action.description,
        details: action.metadata,
      }],
    };

    await this.creStore.add(run);

    // Anchor governance decision to 0G Storage (non-fatal, fire-and-forget)
    zeroGStorageService.anchorAuditRecord({
      runId,
      workflow: "governance",
      outcome: allowed ? "allowed" : "denied",
      agentId: action.metadata?.agentId,
      actionType: action.type,
      timestamp: now,
      evidenceHash: evidence.hash,
    }).catch(() => { /* already logged inside ZeroGStorageService */ });
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
    let logs = runs.map(r => this.mapCreRunToAuditLog(r));

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
      logs = logs.filter((log) => log.complianceStatus === filters.complianceStatus);
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
