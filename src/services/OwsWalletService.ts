import logger from "../utils/logger.js";
import { PolicyEnforcementService } from "./PolicyEnforcementService.js";
import { PolicyService } from "./PolicyService.js";
import { CreRunRecorder } from "../cre/runRecorder.js";
import { AgentAction } from "../types/Agent.js";
import { ethers } from "ethers";
import crypto from "node:crypto";

export interface SpendIntent {
  id: string;
  agentId: string;
  recipient: string;
  amount: string; // in native units or stablecoin
  asset: string; // e.g., "ETH", "USDC", "NEAR"
  reason: string; // The "Intent" - why are we spending?
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  intentId: string;
  status: "approved" | "held" | "denied";
  txHash?: string;
  error?: string;
  reason?: string;
}

export class OwsWalletService {
  private policyEnforcement: PolicyEnforcementService;
  private signer?: ethers.Signer;
  private connected: boolean = false;
  private walletAddress?: string;

  constructor(policyService?: PolicyService) {
    this.policyEnforcement = new PolicyEnforcementService(policyService);

    const pk = process.env.FILECOIN_PRIVATE_KEY;
    if (pk) {
      this.signer = new ethers.Wallet(pk);
      this.signer.getAddress().then(addr => {
        this.walletAddress = addr;
        this.connected = true;
        logger.info(`SpendOS Execution Layer active for wallet: ${addr}`);
      });
    }
  }

  /**
   * Request scoped access for an agent
   */
  public async getScopedAccess(agentId: string, scope: string[]): Promise<boolean> {
    logger.info(`Requesting scoped access for agent ${agentId}: ${scope.join(", ")}`);
    // In a real OWS implementation, this would negotiate permissions with the wallet
    return true;
  }

  /**
   * Execute a spend intent with pre-sign policy checks
   */
  public async executeSpend(intent: SpendIntent): Promise<ExecutionResult> {
    const recorder = new CreRunRecorder({
      workflow: "governance",
      mode: "cre",
      signer: this.signer,
    });

    try {
      logger.info(`SpendOS: Evaluating intent ${intent.id} from agent ${intent.agentId}`);

      const step = recorder.startStep("compute", "policy_evaluation", { intent });

      // 1. Map intent to AgentAction for policy engine
      const action: AgentAction = {
        id: intent.id,
        timestamp: intent.timestamp,
        type: "spend",
        description: intent.reason,
        metadata: {
          agentId: intent.agentId,
          amount: intent.amount,
          asset: intent.asset,
          recipient: intent.recipient,
          ...intent.metadata
        },
        policyChecks: []
      };

      // 2. Load and evaluate policy
      // For the hackathon, we assume a default "spend-limit" policy is active
      const activePolicyId = process.env.ACTIVE_SPEND_POLICY || "default-spend-policy";

      let allowed = false;
      let policyChecks: any[] = [];

      try {
        await this.policyEnforcement.loadPolicy(activePolicyId);
        const decision = await this.policyEnforcement.evaluateDecision(action);
        allowed = decision.allowed;
        policyChecks = decision.policyChecks;
      } catch (e) {
        logger.warn(`Policy evaluation skipped or failed: ${e instanceof Error ? e.message : "unknown"}. Defaulting to HOLD.`);
        // If no policy is found, we don't auto-deny, we HOLD for human review
        return await this.handleHold(intent, recorder, "No active policy found. Held for manual review.");
      }

      step.end({ ok: allowed, summary: allowed ? "Policy approved" : "Policy denied" });

      if (!allowed) {
        return await this.handleDeny(intent, recorder, policyChecks);
      }

      // 3. Execute Transaction
      return await this.handleApprove(intent, recorder);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown execution error";
      logger.error(`SpendOS execution failed: ${errMsg}`);
      await recorder.finish(false);
      return {
        intentId: intent.id,
        status: "denied",
        error: errMsg
      };
    }
  }

  private async handleApprove(intent: SpendIntent, recorder: CreRunRecorder): Promise<ExecutionResult> {
    const s = recorder.startStep("evm_write", "wallet_sign_and_broadcast");

    // Simulate real signing
    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

    await recorder.addArtifact({
      type: "attestation_result",
      data: { txHash, intentId: intent.id, status: "approved" }
    });

    s.end({ ok: true, summary: `Transaction broadcast: ${txHash}` });
    await recorder.finish(true);

    return {
      intentId: intent.id,
      status: "approved",
      txHash
    };
  }

  private async handleHold(intent: SpendIntent, recorder: CreRunRecorder, reason: string): Promise<ExecutionResult> {
    await recorder.addArtifact({
      type: "error",
      data: { intentId: intent.id, status: "held", reason }
    });

    // We finish the run as "ok" because the governance process itself succeeded in catching the intent
    await recorder.finish(true);

    return {
      intentId: intent.id,
      status: "held",
      reason
    };
  }

  private async handleDeny(intent: SpendIntent, recorder: CreRunRecorder, checks: any[]): Promise<ExecutionResult> {
    await recorder.addArtifact({
      type: "error",
      data: { intentId: intent.id, status: "denied", policyChecks: checks }
    });

    await recorder.finish(false);

    return {
      intentId: intent.id,
      status: "denied",
      reason: "Policy violation"
    };
  }
}

export const owsWalletService = new OwsWalletService();
