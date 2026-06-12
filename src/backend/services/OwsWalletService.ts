import logger from "../utils/logger.js";
import { Policy } from "../types/Policy.js";
import { PolicyService, sharedPolicyService } from "./PolicyService.js";
import { PolicyEnforcementService } from "./PolicyEnforcementService.js";
import { CreRunRecorder } from "../cre/runRecorder.js";
import { creRunStore } from "../cre/storage/CreRunStore.js";
import { enrichCreRunEvidence } from "../shared/utils/evidence.js";
import { AgentAction } from "../types/Agent.js";
import { ethers } from "ethers";
import {
  owsLocalVaultService,
  OwsResolvedAccess,
} from "./OwsLocalVaultService.js";
import { ledgerSigningProvider } from "../signing/LedgerSigningProvider.js";
import {
  FhenixPolicyService,
  sharedFhenixPolicyService,
} from "./FhenixPolicyService.js";
import { OwsWalletPolicyEvaluator } from "./OwsWalletPolicy.js";
import { OwsWalletOnChainManager } from "./OwsWalletOnChain.js";

export interface SpendIntent {
  id: string;
  agentId: string;
  recipient: string;
  amount: string;
  asset: string;
  reason: string;
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
  confidential?: boolean;
  encryptedAmount?: string;
  vendorHash?: string;
}

export class OwsWalletService {
  private policyService: PolicyService;
  private policyEnforcement: PolicyEnforcementService;
  private fhenixPolicyService: FhenixPolicyService;
  private policyEvaluator: OwsWalletPolicyEvaluator;
  onChainManager: OwsWalletOnChainManager;

  constructor(
    policyService?: PolicyService,
    fhenixPolicyService?: FhenixPolicyService,
  ) {
    this.policyService = policyService || sharedPolicyService;
    this.fhenixPolicyService = fhenixPolicyService || sharedFhenixPolicyService;
    this.policyEnforcement = new PolicyEnforcementService(
      this.policyService,
      this.fhenixPolicyService,
    );
    this.policyEvaluator = new OwsWalletPolicyEvaluator();
    this.onChainManager = new OwsWalletOnChainManager();
  }

  public async issueAuditPermit(
    auditor: string,
    policyId: string,
  ): Promise<string> {
    return this.fhenixPolicyService.issueAuditPermit(auditor, policyId);
  }

  public async initialize(): Promise<void> {
    await owsLocalVaultService.ensureBootstrapWallet();
  }

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

      const action = this.policyEvaluator.toAgentAction(intent);
      const activePolicy = await this.policyEvaluator.resolveActiveSpendPolicy(
        this.policyService,
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
      let policyDecision:
        | { status: ExecutionResult["status"]; reason?: string }
        | undefined;
      try {
        const evaluated = await this.policyEvaluator.evaluatePolicyChecks(
          intent,
          action,
          activePolicy,
          context,
          this.policyEnforcement,
          this.fhenixPolicyService,
        );
        policyChecks = evaluated.policyChecks;
        policyDecision = evaluated.decision;
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

      const decision =
        policyDecision || this.policyEvaluator.classifyDecision(activePolicy, policyChecks);
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

    const metadata = access.wallet.metadata || {};
    const provider = (metadata.signingProvider as string) ||
      (metadata.externalSource ? "ows_remote" : "local");

    switch (provider) {
      case "ledger": {
        try {
          const result = await ledgerSigningProvider.sign({
            walletId: access.wallet.id,
            message: payload,
          });
          signature = result.signature;
          signer = result.signer;
        } catch (error) {
          s.end({ ok: false, summary: "Ledger hardware signing failed" });
          const message =
            error instanceof Error
              ? error.message
              : "Unknown Ledger error";
          return await this.handleHold(
            intent,
            recorder,
            `Ledger signing failed: ${message}. ` +
              "Connect and unlock your Ledger device, open the Ethereum app, and try again.",
            policyId,
            access,
          );
        }
        break;
      }

      case "speculos":
      case "ows_remote": {
        const externalResult =
          await owsLocalVaultService.signWithExternalWallet({
            walletId: access.wallet.id,
            message: payload,
          });

        if (!externalResult) {
          s.end({ ok: false, summary: "External wallet signing failed" });
          return await this.handleHold(
            intent,
            recorder,
            "External wallet signing failed. Spend held for manual review.",
            policyId,
            access,
          );
        }

        signature = externalResult.signature;
        signer = externalResult.signer;
        break;
      }

      default: {
        const localResult = await owsLocalVaultService.signMessage({
          walletId: access.wallet.id,
          message: payload,
          apiKeyToken,
        });
        signature = localResult.signature;
        signer = localResult.signer;
        break;
      }
    }

    const onChain = await this.onChainManager.recordOnChainApproval({
      intentId: intent.id,
      agentId: intent.agentId,
      actionType: "spend",
      metadata: intent.metadata || {},
    });
    const txHash = onChain.txHash || ethers.keccak256(ethers.toUtf8Bytes(signature));

    await recorder.addArtifact({
      type: "attestation_result",
      data: {
        signingProvider: provider,
        txHash,
        signature,
        intentId: intent.id,
        policyId,
        walletId: access.wallet.id,
        walletAddress: signer,
        apiKeyId: access.apiKey?.id,
        status: "approved",
        onChainStatus: onChain.success ? "recorded" : "offline",
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
    const activePolicy = await this.policyEvaluator.resolveActiveSpendPolicy(this.policyService);
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

    const activePolicy = await this.policyEvaluator.resolveActiveSpendPolicy(
      this.policyService,
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

    const action = this.policyEvaluator.toAgentAction(intent);
    const evaluated = await this.policyEvaluator.evaluatePolicyChecks(
      intent,
      action,
      activePolicy,
      {
        apiKeyToken: intent.metadata?.apiKeyToken as string | undefined,
        confidential: intent.metadata?.confidentialPolicy === true,
        encryptedAmount:
          typeof intent.metadata?.encryptedAmount === "string"
            ? intent.metadata.encryptedAmount
            : undefined,
        vendorHash:
          typeof intent.metadata?.vendorHash === "string"
            ? intent.metadata.vendorHash
            : undefined,
      },
      this.policyEnforcement,
      this.fhenixPolicyService,
    );
    const policyResult =
      evaluated.decision ||
      this.policyEvaluator.classifyDecision(activePolicy, evaluated.policyChecks);

    return {
      intentId: intent.id,
      status: policyResult.status,
      policyId: activePolicy.id,
      reason: policyResult.reason,
      simulation: {
        wouldExecute: policyResult.status === "approved",
        gasEstimate: policyResult.status === "approved" ? "21000" : undefined,
        warnings: evaluated.policyChecks
          .filter((c) => !c.result)
          .map((c) => c.reason || `Policy check failed`),
      },
    };
  }

  public async executeDeFiAction(params: {
    agentId: string;
    policyId: string;
    amountWei: bigint;
    target: string;
    data: string;
  }): Promise<{
    success: boolean;
    decisionId?: string;
    txHash?: string;
    error?: string;
  }> {
    try {
      logger.info(`Executing governed DeFi action for agent ${params.agentId}`);

      const result = await this.fhenixPolicyService.requestDeFiAction({
        agentId: params.agentId,
        policyId: params.policyId,
        amountWei: params.amountWei,
        target: params.target,
        data: params.data,
      });

      return {
        success: true,
        decisionId: result.decisionId,
        txHash: result.txHash,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "DeFi execution failed";
      logger.error(`DeFi action failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
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

  private async persistRun(recorder: CreRunRecorder) {
    const run = enrichCreRunEvidence(recorder.getRun());
    await creRunStore.replace(run);
    return run;
  }
}

export const owsWalletService = new OwsWalletService();
