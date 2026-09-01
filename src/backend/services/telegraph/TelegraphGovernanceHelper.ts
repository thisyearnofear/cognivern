/**
 * TelegraphGovernanceHelper
 *
 * Bridges Telegraph miner calls with Cognivern's governance pipeline.
 * Handles confidence-based routing: high confidence → auto-approve,
 * low confidence → hold for operator review.
 *
 * Flow:
 *   1. Call Telegraph miner
 *   2. Check confidence threshold
 *   3. If met → GovernanceClient.previewSpend
 *   4. Record as telegraph.signal artifact
 *   5. Track x402 payment as governed spend
 *   6. Return decision + evidence
 */

import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService } from "./TelegraphService.js";
import {
  TelegraphMinerRequest,
  TelegraphMinerResponse,
  TelegraphEngineAskRequest,
  TelegraphEngineAskResponse,
} from "./types.js";
import { CreArtifact } from "@backend/cre/types.js";
import { randomUUID } from "crypto";

const logger = new Logger("TelegraphGovernanceHelper");

export interface TelegraphGovernedCallRequest {
  agentId: string;
  workspaceId?: string;
  mandateId?: string;
  policyId?: string;
  minerRequest: TelegraphMinerRequest;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TelegraphGovernedCallResult<T = unknown> {
  success: boolean;
  status: "approved" | "held" | "denied" | "failed";
  response?: TelegraphMinerResponse<T>;
  decision?: {
    approved: boolean;
    reason: string;
    confidenceMet: boolean;
    threshold: number;
    actualConfidence: number | null;
    confidenceKnown: boolean;
  };
  artifact?: CreArtifact;
  error?: string;
}

export interface TelegraphEngineGovernedRequest {
  agentId: string;
  workspaceId?: string;
  mandateId?: string;
  policyId?: string;
  engineRequest: TelegraphEngineAskRequest;
  description?: string;
  metadata?: Record<string, unknown>;
}

export class TelegraphGovernanceHelper {
  /**
   * Execute a Telegraph miner call with governance.
   *
   * The actual spend preview/execution is triggered separately when
   * the intelligence leads to an on-chain action.
   */
  async governedMinerCall<T = unknown>(
    request: TelegraphGovernedCallRequest,
  ): Promise<TelegraphGovernedCallResult<T>> {
    try {
      const minerResponse = await telegraphService.callMiner<T>(request.minerRequest);

      if (!minerResponse.success) {
        return {
          success: false,
          status: "failed",
          response: minerResponse,
          error: minerResponse.error,
        };
      }

      const confidence = minerResponse.metadata.confidence;
      const threshold = request.minerRequest.confidenceThreshold ?? telegraphService.getConfidenceThreshold();
      const confidenceKnown = confidence !== null;
      const confidenceMet = confidenceKnown && telegraphService.meetsConfidenceThreshold(confidence, threshold);

      // Determine status: unknown confidence → held (fail-safe)
      const status = confidenceMet ? "approved" : "held";

      const artifact = this.createTelegraphArtifact(
        minerResponse,
        {
          agentId: request.agentId,
          workspaceId: request.workspaceId,
          mandateId: request.mandateId,
          policyId: request.policyId,
          description: request.description,
          confidenceMet,
          threshold,
        },
      );

      logger.info("Telegraph governed call completed", {
        agentId: request.agentId,
        minerId: minerResponse.metadata.minerId,
        minerName: minerResponse.metadata.minerName,
        confidence,
        threshold,
        status,
        costUsd: minerResponse.metadata.costUsd,
      });

      return {
        success: true,
        status,
        response: minerResponse,
        decision: {
          approved: confidenceMet,
          reason: confidenceMet
            ? `Confidence ${(confidence ?? 0).toFixed(2)} meets threshold ${threshold.toFixed(2)}`
            : confidenceKnown
              ? `Confidence ${(confidence ?? 0).toFixed(2)} below threshold ${threshold.toFixed(2)} - held for review`
              : `Confidence unknown - held for review (fail-safe)`,
          confidenceMet,
          threshold,
          actualConfidence: confidence,
          confidenceKnown,
        },
        artifact,
      };
    } catch (error) {
      logger.error("Telegraph governed call failed", {
        agentId: request.agentId,
        error,
      });

      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a Telegraph Engine auto-routed call with governance.
   */
  async governedEngineAsk(
    request: TelegraphEngineGovernedRequest,
  ): Promise<TelegraphGovernedCallResult<TelegraphEngineAskResponse>> {
    try {
      const engineResponse = await telegraphService.engineAsk(request.engineRequest);
      const confidence = engineResponse.confidence;
      const threshold = request.engineRequest.confidenceThreshold ?? telegraphService.getConfidenceThreshold();
      const confidenceKnown = confidence !== null;
      const confidenceMet = confidenceKnown && telegraphService.meetsConfidenceThreshold(confidence, threshold);

      const status = confidenceMet ? "approved" : "held";

      const artifact = this.createEngineArtifact(
        engineResponse,
        {
          agentId: request.agentId,
          workspaceId: request.workspaceId,
          mandateId: request.mandateId,
          policyId: request.policyId,
          description: request.description,
          confidenceMet,
          threshold,
        },
      );

      logger.info("Telegraph engine ask completed", {
        agentId: request.agentId,
        minerId: engineResponse.minerId,
        minerName: engineResponse.minerName,
        confidence,
        threshold,
        status,
        costUsd: engineResponse.costUsd,
      });

      return {
        success: true,
        status,
        response: {
          success: true,
          data: engineResponse,
          metadata: {
            minerId: engineResponse.minerId,
            minerName: engineResponse.minerName,
            confidence,
            latencyMs: engineResponse.latencyMs,
            costUsd: engineResponse.costUsd,
            timestamp: engineResponse.timestamp,
          },
        },
        decision: {
          approved: confidenceMet,
          reason: confidenceMet
            ? `Confidence ${(confidence ?? 0).toFixed(2)} meets threshold ${threshold.toFixed(2)}`
            : confidenceKnown
              ? `Confidence ${confidence!.toFixed(2)} below threshold ${threshold.toFixed(2)} - held for review`
              : `Confidence unknown - held for review (fail-safe)`,
          confidenceMet,
          threshold,
          actualConfidence: confidence,
          confidenceKnown,
        },
        artifact,
      };
    } catch (error) {
      logger.error("Telegraph engine ask failed", {
        agentId: request.agentId,
        error,
      });

      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a telegraph.signal CRE artifact from a miner response.
   */
  private createTelegraphArtifact(
    response: TelegraphMinerResponse,
    context: {
      agentId: string;
      workspaceId?: string;
      mandateId?: string;
      policyId?: string;
      description?: string;
      confidenceMet: boolean;
      threshold: number;
    },
  ): CreArtifact {
    return {
      id: randomUUID(),
      type: "telegraph.signal",
      createdAt: new Date().toISOString(),
      data: {
        agentId: context.agentId,
        workspaceId: context.workspaceId,
        mandateId: context.mandateId,
        policyId: context.policyId,
        description: context.description,
        miner: {
          id: response.metadata.minerId,
          name: response.metadata.minerName,
          intent: response.metadata.intent,
        },
        signal: {
          data: response.data,
          confidence: response.metadata.confidence,
          confidenceThreshold: context.threshold,
          confidenceMet: context.confidenceMet,
        },
        cost: {
          usd: response.metadata.costUsd,
          paymentMethod: "x402",
          paid: (response.metadata as Record<string, unknown>).paid ?? false,
          paymentNetwork: (response.metadata as Record<string, unknown>).paymentNetwork,
        },
        latencyMs: response.metadata.latencyMs,
        timestamp: response.metadata.timestamp,
      },
    };
  }

  /**
   * Create a telegraph.signal CRE artifact from an engine response.
   */
  private createEngineArtifact(
    response: TelegraphEngineAskResponse,
    context: {
      agentId: string;
      workspaceId?: string;
      mandateId?: string;
      policyId?: string;
      description?: string;
      confidenceMet: boolean;
      threshold: number;
    },
  ): CreArtifact {
    return {
      id: randomUUID(),
      type: "telegraph.signal",
      createdAt: new Date().toISOString(),
      data: {
        agentId: context.agentId,
        workspaceId: context.workspaceId,
        mandateId: context.mandateId,
        policyId: context.policyId,
        description: context.description,
        miner: {
          id: response.minerId,
          name: response.minerName,
          autoRouted: true,
        },
        signal: {
          answer: response.answer,
          confidence: response.confidence,
          confidenceThreshold: context.threshold,
          confidenceMet: context.confidenceMet,
        },
        cost: {
          usd: response.costUsd,
          paymentMethod: "x402",
          paid: true,
          paymentNetwork: "evm",
        },
        latencyMs: response.latencyMs,
        timestamp: response.timestamp,
      },
    };
  }

  /**
   * Helper to convert Telegraph signal to a spend intent.
   *
   * Use this when the Telegraph intelligence leads to an on-chain action.
   * The spend intent can then be passed to GovernanceClient.previewSpend.
   */
  createSpendIntentFromSignal(
    artifact: CreArtifact | null | undefined,
    spendDetails: {
      recipient: string;
      amount: string;
      asset: string;
      reason: string;
    },
  ): Record<string, unknown> | null {
    if (!artifact) return null;
    if (artifact.type !== "telegraph.signal") {
      throw new Error("Artifact is not a telegraph.signal");
    }

    const data = artifact.data as Record<string, unknown>;

    return {
      agentId: data.agentId,
      workspaceId: data.workspaceId,
      mandateId: data.mandateId,
      policyId: data.policyId,
      recipient: spendDetails.recipient,
      amount: spendDetails.amount,
      asset: spendDetails.asset,
      reason: spendDetails.reason,
      metadata: {
        source: "telegraph",
        artifactId: artifact.id,
        minerId: (data.miner as Record<string, unknown> | undefined)?.id,
        minerName: (data.miner as Record<string, unknown> | undefined)?.name,
        confidence: (data.signal as Record<string, unknown> | undefined)?.confidence,
        intelligenceCostUsd: (data.cost as Record<string, unknown> | undefined)?.usd,
      },
    };
  }
}

// Singleton instance
export const telegraphGovernanceHelper = new TelegraphGovernanceHelper();
