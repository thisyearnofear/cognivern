import logger from "../utils/logger.js";
import { PolicyEnforcementService } from "./PolicyEnforcementService.js";
import { Policy, PolicyRule } from "../types/Policy.js";
import { PolicyService, sharedPolicyService } from "./PolicyService.js";
import { CreRunRecorder } from "../cre/runRecorder.js";
import { creRunStore } from "../cre/storage/CreRunStore.js";
import { enrichCreRunEvidence } from "../shared/utils/evidence.js";
import { AgentAction } from "../types/Agent.js";
import { ethers } from "ethers";
import {
  owsLocalVaultService,
  OwsResolvedAccess,
} from "./OwsLocalVaultService.js";

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
  runId?: string;
  status: "approved" | "held" | "denied";
  policyId?: string;
  walletId?: string;
  walletAddress?: string;
  apiKeyId?: string;
  txHash?: string;
  signature?: string;
  error?: string;
  reason?: string;
}

export interface SpendExecutionContext {
  apiKeyToken?: string | null;
  walletId?: string;
}

export class OwsWalletService {
  private policyService: PolicyService;
  private policyEnforcement: PolicyEnforcementService;

  constructor(policyService?: PolicyService) {
    this.policyService = policyService || sharedPolicyService;
    this.policyEnforcement = new PolicyEnforcementService(this.policyService);
  }

  /**
   * Initialize the wallet service by ensuring a bootstrap wallet exists
   */
  public async initialize(): Promise<void> {
    await owsLocalVaultService.ensureBootstrapWallet();
  }

  /**
   * Request scoped access for an agent
   */
  public async getScopedAccess(
    agentId: string,
    scope: string[],
  ): Promise<boolean> {
    logger.info(
      `Requesting scoped access for agent ${agentId}: ${scope.join(", ")}`,
    );
    const wallets = await owsLocalVaultService.listWallets();
    if (wallets.length === 0) {
      await owsLocalVaultService.ensureBootstrapWallet();
    }
    return (await owsLocalVaultService.listWallets()).length > 0;
  }

  /**
   * Execute a spend intent with pre-sign policy checks
   */
  public async executeSpend(
    intent: SpendIntent,
    context: SpendExecutionContext = {},
  ): Promise<ExecutionResult> {
    const access = await this.resolveAccess(intent, context);
    const recorder = new CreRunRecorder({
      workflow: "spend",
      mode: access ? "cre" : "local",
    });

    try {
      logger.info(
        `SpendOS: Evaluating intent ${intent.id} from agent ${intent.agentId}`,
      );

      await recorder.addArtifact({
        type: "spend_intent",
        data: intent,
      });

      const step = recorder.startStep("compute", "policy_evaluation", {
        intent,
      });

      const action = this.toAgentAction(intent);
      const activePolicy = await this.resolveActiveSpendPolicy(
        access?.apiKey?.policyIds?.[0] ||
          (typeof intent.metadata?.policyId === "string"
            ? intent.metadata.policyId
            : undefined),
      );
      if (!activePolicy) {
        step.end({ ok: false, summary: "No active spend policy available" });
        return await this.handleHold(
          intent,
          recorder,
          "No active spend policy is available. Held for manual review.",
          undefined,
          access,
        );
      }

      let policyChecks: AgentAction["policyChecks"] = [];
      try {
        await this.policyEnforcement.loadPolicy(activePolicy.id);
        const decision = await this.policyEnforcement.evaluateDecision(action);
        policyChecks = decision.policyChecks;
      } catch (e) {
        step.end({ ok: false, summary: "Policy evaluation failed" });
        logger.warn(
          `Policy evaluation failed: ${e instanceof Error ? e.message : "unknown"}`,
        );
        return await this.handleHold(
          intent,
          recorder,
          `Policy evaluation failed for ${activePolicy.id}. Held for manual review.`,
          activePolicy.id,
          access,
        );
      }

      const decision = this.classifyDecision(activePolicy, policyChecks);
      const failedChecks = policyChecks.filter((check) => !check.result);
      step.end({
        ok: decision.status === "approved",
        summary:
          decision.status === "approved"
            ? `Policy ${activePolicy.id} approved spend`
            : decision.reason || `Policy ${activePolicy.id} blocked spend`,
        details: {
          policyId: activePolicy.id,
          failedChecks: failedChecks.map((check) => ({
            policyId: check.policyId,
            reason: check.reason,
          })),
        },
      });

      if (decision.status === "denied") {
        return await this.handleDeny(
          intent,
          recorder,
          decision.reason || "Policy violation",
          policyChecks,
          activePolicy.id,
          access,
        );
      }

      if (decision.status === "held") {
        return await this.handleHold(
          intent,
          recorder,
          decision.reason || "Spend requires manual review.",
          activePolicy.id,
          access,
        );
      }

      return await this.handleApprove(
        intent,
        recorder,
        activePolicy.id,
        access,
        context.apiKeyToken,
      );
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown execution error";
      logger.error(`SpendOS execution failed: ${errMsg}`);
      await recorder.finish(false);
      await this.persistRun(recorder);
      return {
        intentId: intent.id,
        status: "denied",
        error: errMsg,
      };
    }
  }

  private async handleApprove(
    intent: SpendIntent,
    recorder: CreRunRecorder,
    policyId: string,
    access?: OwsResolvedAccess | null,
    apiKeyToken?: string | null,
  ): Promise<ExecutionResult> {
    const s = recorder.startStep("evm_write", "wallet_sign_and_broadcast");

    if (!access) {
      s.end({ ok: false, summary: "Wallet unavailable for signing" });
      return await this.handleHold(
        intent,
        recorder,
        "Wallet access is not authorized. Spend held until a valid OWS API key is provided.",
        policyId,
        access,
      );
    }

    const spendEnvelope = {
      intentId: intent.id,
      agentId: intent.agentId,
      recipient: intent.recipient,
      amount: intent.amount,
      asset: intent.asset,
      reason: intent.reason,
      metadata: intent.metadata || {},
      walletId: access.wallet.id,
      walletAddress: access.wallet.accounts[0]?.address,
      apiKeyId: access.apiKey?.id,
    };
    const payload = JSON.stringify(spendEnvelope);

    let signature: string;
    let signer: string;

    // Check if this is an external wallet and use external signing
    if (access.wallet.metadata?.externalSource) {
      const externalSignResult =
        await owsLocalVaultService.signWithExternalWallet({
          walletId: access.wallet.id,
          message: payload,
        });

      if (!externalSignResult) {
        s.end({ ok: false, summary: "External wallet signing failed" });
        return await this.handleHold(
          intent,
          recorder,
          "External wallet signing failed. Spend held for manual review.",
          policyId,
          access,
        );
      }

      signature = externalSignResult.signature;
      signer = externalSignResult.signer;
    } else {
      // Use local signing
      const localSignResult = await owsLocalVaultService.signMessage({
        walletId: access.wallet.id,
        message: payload,
        apiKeyToken,
      });
      signature = localSignResult.signature;
      signer = localSignResult.signer;
    }

    const txHash = ethers.keccak256(ethers.toUtf8Bytes(signature));

    await recorder.addArtifact({
      type: "attestation_result",
      data: {
        txHash,
        signature,
        intentId: intent.id,
        policyId,
        walletId: access.wallet.id,
        walletAddress: signer,
        apiKeyId: access.apiKey?.id,
        status: "approved",
      },
    });

    s.end({ ok: true, summary: `Signed spend authorization: ${txHash}` });
    await recorder.finish(true);
    const run = await this.persistRun(recorder);

    return {
      intentId: intent.id,
      runId: run.runId,
      status: "approved",
      policyId,
      walletId: access.wallet.id,
      walletAddress: signer,
      apiKeyId: access.apiKey?.id,
      txHash,
      signature,
    };
  }

  private async handleHold(
    intent: SpendIntent,
    recorder: CreRunRecorder,
    reason: string,
    policyId?: string,
    access?: OwsResolvedAccess | null,
  ): Promise<ExecutionResult> {
    await recorder.addArtifact({
      type: "error",
      data: {
        intentId: intent.id,
        status: "held",
        reason,
        policyId,
        walletId: access?.wallet.id,
        walletAddress: access?.wallet.accounts[0]?.address,
        apiKeyId: access?.apiKey?.id,
      },
    });

    await recorder.pauseForApproval(reason, "wallet_sign_and_broadcast", {
      intentId: intent.id,
      policyId,
    });
    const run = await this.persistRun(recorder);

    return {
      intentId: intent.id,
      runId: run.runId,
      status: "held",
      policyId,
      walletId: access?.wallet.id,
      walletAddress: access?.wallet.accounts[0]?.address,
      apiKeyId: access?.apiKey?.id,
      reason,
    };
  }

  private async handleDeny(
    intent: SpendIntent,
    recorder: CreRunRecorder,
    reason: string,
    checks: AgentAction["policyChecks"],
    policyId?: string,
    access?: OwsResolvedAccess | null,
  ): Promise<ExecutionResult> {
    await recorder.addArtifact({
      type: "error",
      data: {
        intentId: intent.id,
        status: "denied",
        reason,
        policyId,
        walletId: access?.wallet.id,
        walletAddress: access?.wallet.accounts[0]?.address,
        apiKeyId: access?.apiKey?.id,
        policyChecks: checks,
      },
    });

    await recorder.finish(false);
    const run = await this.persistRun(recorder);

    return {
      intentId: intent.id,
      runId: run.runId,
      status: "denied",
      policyId,
      walletId: access?.wallet.id,
      walletAddress: access?.wallet.accounts[0]?.address,
      apiKeyId: access?.apiKey?.id,
      reason,
    };
  }

  public async getStatus() {
    await owsLocalVaultService.ensureBootstrapWallet();
    const vaultStatus = await owsLocalVaultService.getStatus();
    const activePolicy = await this.resolveActiveSpendPolicy();
    return {
      layer: "SpendOS",
      status: vaultStatus.walletCount > 0 ? "active" : "unconfigured",
      provider: vaultStatus.provider,
      walletConnected: vaultStatus.walletCount > 0,
      walletAddress: vaultStatus.wallets[0]?.accounts[0]?.address || null,
      walletId: vaultStatus.wallets[0]?.id || null,
      apiKeyCount: vaultStatus.apiKeyCount,
      activePolicyId: activePolicy?.id || null,
      activePolicyName: activePolicy?.name || null,
      features: [
        "encrypted-local-wallet-storage",
        "delegated-api-keys",
        "pre-sign-policies",
        "held-action-review",
        "scoped-access",
        "run-ledger-persistence",
      ],
    };
  }

  private toAgentAction(intent: SpendIntent): AgentAction {
    const amountValue = Number(intent.amount);
    const metadata = {
      ...(intent.metadata || {}),
      agentId: intent.agentId,
      amount: intent.amount,
      amountValue: Number.isFinite(amountValue) ? amountValue : 0,
      amountUsd: this.resolveAmountUsd(intent, amountValue),
      asset: intent.asset,
      recipient: intent.recipient,
    };

    return {
      id: intent.id,
      timestamp: intent.timestamp,
      type: "spend",
      description: intent.reason,
      metadata,
      policyChecks: [],
    };
  }

  private resolveAmountUsd(intent: SpendIntent, amountValue: number): number {
    const metadataAmountUsd = Number(intent.metadata?.amountUsd);
    if (Number.isFinite(metadataAmountUsd)) {
      return metadataAmountUsd;
    }

    if (["USD", "USDC", "USDT"].includes(intent.asset.toUpperCase())) {
      return Number.isFinite(amountValue) ? amountValue : 0;
    }

    return Number.isFinite(amountValue) ? amountValue : 0;
  }

  private async resolveActiveSpendPolicy(
    explicitPolicyId?: string,
  ): Promise<Policy | null> {
    const requestedPolicyId =
      explicitPolicyId || process.env.ACTIVE_SPEND_POLICY;
    if (requestedPolicyId) {
      const explicitPolicy =
        await this.policyService.getPolicy(requestedPolicyId);
      if (explicitPolicy?.status === "active") {
        return explicitPolicy;
      }
    }

    const policies = await this.policyService.listPolicies();
    const activePolicies = policies.filter(
      (policy) => policy.status === "active" && policy.rules.length > 0,
    );
    const spendPolicy =
      activePolicies.find(
        (policy) =>
          String(policy.metadata?.category || "").toLowerCase() === "spend",
      ) ||
      activePolicies.find((policy) => policy.id === "spend-governance-policy");

    if (spendPolicy) {
      return spendPolicy;
    }

    return (
      activePolicies.sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )[0] || null
    );
  }

  private classifyDecision(
    policy: Policy,
    checks: AgentAction["policyChecks"],
  ): { status: ExecutionResult["status"]; reason?: string } {
    const failedChecks = checks.filter((check) => !check.result);
    if (failedChecks.length === 0) {
      return { status: "approved" };
    }

    const failedRules = failedChecks
      .map((check) => ({
        check,
        rule: policy.rules.find((rule) => rule.id === check.policyId),
      }))
      .filter(
        (
          value,
        ): value is {
          check: AgentAction["policyChecks"][number];
          rule: PolicyRule;
        } => Boolean(value.rule),
      );

    const denyRules = failedRules.filter(
      ({ rule }) => String(rule.type).toLowerCase() === "deny",
    );
    if (denyRules.length > 0) {
      return {
        status: "denied",
        reason: denyRules
          .map(
            ({ check, rule }) =>
              check.reason ||
              String(
                rule.action?.parameters?.reason ||
                  `${rule.id} denied the spend`,
              ),
          )
          .join("; "),
      };
    }

    return {
      status: "held",
      reason: failedRules
        .map(
          ({ check, rule }) =>
            check.reason ||
            String(
              rule.action?.parameters?.reason || `${rule.id} requires review`,
            ),
        )
        .join("; "),
    };
  }

  private async persistRun(recorder: CreRunRecorder) {
    const run = enrichCreRunEvidence(recorder.getRun());
    await creRunStore.replace(run);
    return run;
  }

  private async resolveAccess(
    intent: SpendIntent,
    context: SpendExecutionContext,
  ) {
    return owsLocalVaultService.resolveAccess({
      walletId:
        context.walletId ||
        (typeof intent.metadata?.walletId === "string"
          ? intent.metadata.walletId
          : undefined),
      apiKeyToken: context.apiKeyToken,
    });
  }

  /**
   * Preview a spend without executing - returns policy evaluation without signing
   */
  public async previewSpend(intent: SpendIntent): Promise<{
    intentId: string;
    status: "approved" | "denied" | "held";
    policyId?: string;
    reason?: string;
    simulation: {
      wouldExecute: boolean;
      gasEstimate?: string;
      warnings: string[];
    };
  }> {
    const access = await this.resolveAccess(intent, {
      apiKeyToken: intent.metadata?.apiKeyToken as string | undefined,
    });

    const activePolicy = await this.resolveActiveSpendPolicy(
      access?.apiKey?.policyIds?.[0] ||
        (typeof intent.metadata?.policyId === "string"
          ? intent.metadata.policyId
          : undefined),
    );

    if (!activePolicy) {
      return {
        intentId: intent.id,
        status: "held",
        reason: "No active spend policy available",
        simulation: {
          wouldExecute: false,
          warnings: ["No policy configured - spend would be held for review"],
        },
      };
    }

    await this.policyEnforcement.loadPolicy(activePolicy.id);
    const action = this.toAgentAction(intent);
    const decision = await this.policyEnforcement.evaluateDecision(action);
    const policyResult = this.classifyDecision(
      activePolicy,
      decision.policyChecks,
    );

    return {
      intentId: intent.id,
      status: policyResult.status,
      policyId: activePolicy.id,
      reason: policyResult.reason,
      simulation: {
        wouldExecute: policyResult.status === "approved",
        gasEstimate: policyResult.status === "approved" ? "21000" : undefined,
        warnings: decision.policyChecks
          .filter((c) => !c.result)
          .map((c) => c.reason || `Policy check failed`),
      },
    };
  }
}

export const owsWalletService = new OwsWalletService();
