import logger from "../utils/logger.js";
import { PolicyEnforcementService } from "./PolicyEnforcementService.js";
import { Policy, PolicyRule } from "../types/Policy.js";
import { PolicyService, sharedPolicyService } from "./PolicyService.js";
import { CreRunRecorder } from "../cre/runRecorder.js";
import { creRunStore } from "../cre/storage/CreRunStore.js";
import { enrichCreRunEvidence } from "../shared/utils/evidence.js";
import { AgentAction } from "../types/Agent.js";
import { ethers } from "ethers";
import { createHash } from "node:crypto";
import {
  owsLocalVaultService,
  OwsResolvedAccess,
} from "./OwsLocalVaultService.js";
import { ledgerSigningProvider } from "../signing/LedgerSigningProvider.js";
import {
  FhenixPolicyService,
  FhenixClientAdapter,
  sharedFhenixPolicyService,
} from "./FhenixPolicyService.js";
import { blockchainConfig } from "../shared/config/index.js";
import { circuitBreakers } from "../shared/utils/circuitBreaker.js";
import { withTimeout, retry } from "../shared/utils/index.js";

const GOVERNANCE_ABI = [
  "function evaluateAction(bytes32 actionId, bytes32 agentId, string memory actionType, bytes32 dataHash, bool approved) external",
  "function getAgent(bytes32 agentId) view returns (bytes32 id, string name, address owner, string[] capabilities, uint256 registeredAt, uint8 status, bytes32 currentPolicyId)",
  "function getPolicy(bytes32 policyId) view returns (bytes32 id, string name, string description, bytes32 rulesHash, address creator, uint256 createdAt, uint256 updatedAt, uint8 status)",
  "function registerAgent(bytes32 agentId, string memory name, string[] memory capabilities, bytes32 policyId) external",
  "function updateAgentStatus(bytes32 agentId, uint8 status) external",
  "function createPolicy(bytes32 policyId, string memory name, string memory description, bytes32 rulesHash) external",
  "function updatePolicyStatus(bytes32 policyId, uint8 status) external",
  "function authorizeEvaluator(address evaluator) external",
];

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
  confidential?: boolean;
  encryptedAmount?: string;
  vendorHash?: string;
}

export class OwsWalletService {
  private policyService: PolicyService;
  private policyEnforcement: PolicyEnforcementService;
  private fhenixPolicyService: FhenixPolicyService;
  private onChainProvider: ethers.JsonRpcProvider | null = null;
  private onChainWallet: ethers.Wallet | null = null;
  private onChainContract: ethers.Contract | null = null;
  private lastProviderHealthCheck: number = 0;
  private static readonly HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

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
  }

  private async getOnChainSigner(): Promise<{ wallet: ethers.Wallet; contract: ethers.Contract } | null> {
    const pk = blockchainConfig.privateKey;
    if (!pk) return null;

    if (this.onChainWallet && this.onChainContract) {
      const now = Date.now();
      if (now - this.lastProviderHealthCheck > OwsWalletService.HEALTH_CHECK_INTERVAL_MS) {
        try {
          await withTimeout(this.onChainProvider!.getBlockNumber(), 5000);
          this.lastProviderHealthCheck = now;
        } catch {
          this.onChainProvider = null;
          this.onChainWallet = null;
          this.onChainContract = null;
        }
      }
      if (this.onChainWallet && this.onChainContract) {
        return { wallet: this.onChainWallet, contract: this.onChainContract };
      }
    }

    try {
      this.onChainProvider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      this.onChainWallet = new ethers.Wallet(pk, this.onChainProvider);
      this.onChainContract = new ethers.Contract(
        blockchainConfig.contracts.governance,
        GOVERNANCE_ABI,
        this.onChainWallet,
      );
      this.lastProviderHealthCheck = Date.now();
      return { wallet: this.onChainWallet, contract: this.onChainContract };
    } catch (error) {
      logger.warn("Failed to initialize on-chain signer:", error);
      return null;
    }
  }

  public async issueAuditPermit(
    auditor: string,
    policyId: string,
  ): Promise<string> {
    return this.fhenixPolicyService.issueAuditPermit(auditor, policyId);
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
      let policyDecision:
        | { status: ExecutionResult["status"]; reason?: string }
        | undefined;
      try {
        const evaluated = await this.evaluatePolicyChecks(
          intent,
          action,
          activePolicy,
          context,
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
        policyDecision || this.classifyDecision(activePolicy, policyChecks);
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

    // Dispatch to the right signing provider based on wallet metadata
    // Fallback: if externalSource is set but no signingProvider, treat as ows_remote (backward compat)
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

    const onChain = await this.recordOnChainApproval({
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

  private async recordOnChainApproval(params: {
    intentId: string;
    agentId: string;
    actionType: string;
    metadata: Record<string, any>;
  }): Promise<{ success: boolean; txHash?: string }> {
    const signer = await this.getOnChainSigner();
    if (!signer) return { success: false };

    try {
      return await circuitBreakers.blockchain.execute(async () => {
        const actionId = ethers.id(params.intentId);
        const agentBytes32 = ethers.id(params.agentId);
        const dataHash = ethers.ZeroHash;
        const gas = blockchainConfig.gasLimits;

        await this.ensureOnChainAgent(signer.wallet, signer.contract, params.agentId);

        const tx = await signer.contract.evaluateAction(
          actionId,
          agentBytes32,
          params.actionType,
          dataHash,
          true,
          { gasLimit: gas.evaluateAction },
        );
        const receipt = await withTimeout<ethers.ContractTransactionReceipt | null>(
          tx.wait(),
          60000,
        );
        logger.info(`On-chain approval recorded: ${receipt?.hash}`);
        return { success: true, txHash: receipt?.hash };
      });
    } catch (error) {
      logger.error("On-chain record failed:", error);
      return { success: false };
    }
  }

  private static readonly DEFAULT_POLICY_ID = ethers.id("cognivern-default-spend-policy");
  private static readonly DEFAULT_RULES_HASH = ethers.id("cognivern-default-rules-v1");

  private async ensureOnChainAgent(
    wallet: ethers.Wallet,
    contract: ethers.Contract,
    agentIdStr: string,
  ): Promise<void> {
    const agentId = ethers.id(agentIdStr);
    const gas = blockchainConfig.gasLimits;
    try {
      const agent = await retry(() => contract.getAgent(agentId), 2, 2000);
      if (agent.status === 1) return;
      if (agent.status === 0) {
        await (
          await contract.updateAgentStatus(agentId, 1, { gasLimit: gas.updateStatus })
        ).wait();
        logger.info(`On-chain agent ${agentIdStr} activated (was Registered)`);
      }
      return;
    } catch {
      // Agent doesn't exist — register + activate
    }

    try {
      const policyId = OwsWalletService.DEFAULT_POLICY_ID;
      const rulesHash = OwsWalletService.DEFAULT_RULES_HASH;

      try {
        await retry(() => contract.getPolicy(policyId), 2, 2000);
      } catch {
        await (
          await contract.createPolicy(
            policyId,
            "Cognivern Default Spend Policy",
            "Auto-created default policy for governed agent spends",
            rulesHash,
            { gasLimit: gas.createPolicy },
          )
        ).wait();
        await (
          await contract.updatePolicyStatus(policyId, 1, { gasLimit: gas.updateStatus })
        ).wait();
      }

      await (
        await contract.registerAgent(
          agentId,
          `${agentIdStr}`,
          ["spend-governance"],
          policyId,
          { gasLimit: gas.registerAgent },
        )
      ).wait();
      await (
        await contract.updateAgentStatus(agentId, 1, { gasLimit: gas.updateStatus })
      ).wait();
      logger.info(`On-chain agent ${agentIdStr} registered and activated`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to register on-chain agent ${agentIdStr}: ${reason}`);
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

  private shouldUseConfidentialPolicy(activePolicy: Policy): boolean {
    return activePolicy.metadata?.confidential === true;
  }

  private async evaluatePolicyChecks(
    intent: SpendIntent,
    action: AgentAction,
    activePolicy: Policy,
    context: SpendExecutionContext,
  ): Promise<{
    policyChecks: AgentAction["policyChecks"];
    decision?: { status: ExecutionResult["status"]; reason?: string };
  }> {
    if (!this.shouldUseConfidentialPolicy(activePolicy)) {
      await this.policyEnforcement.loadPolicy(activePolicy.id);
      const decision = await this.policyEnforcement.evaluateDecision(action);
      return { policyChecks: decision.policyChecks };
    }

    if (
      typeof context.encryptedAmount !== "string" &&
      typeof intent.metadata?.encryptedAmount !== "string"
    ) {
      return {
        policyChecks: [
          {
            policyId: activePolicy.id,
            result: false,
            reason:
              "Confidential policy requires encrypted amount input. Held for manual review.",
          },
        ],
        decision: {
          status: "held",
          reason:
            "Confidential policy requires encrypted amount input. Held for manual review.",
        },
      };
    }

    const amountWei = BigInt(intent.amount);
    const vendorHash =
      context.vendorHash ||
      (typeof intent.metadata?.vendorHash === "string"
        ? intent.metadata.vendorHash
        : `0x${createHash("sha256").update(intent.recipient).digest("hex")}`);

    const confidentialDecision =
      await this.fhenixPolicyService.evaluateEncrypted({
        agentId: intent.agentId,
        policyId: activePolicy.id,
        amountWei,
        vendorHash,
      });

    const decisionByOutcome: Record<
      typeof confidentialDecision.outcome,
      { status: ExecutionResult["status"]; reason?: string }
    > = {
      approve: { status: "approved" },
      hold: {
        status: "held",
        reason: "Confidential policy requires manual review.",
      },
      deny: {
        status: "denied",
        reason: "Confidential policy denied this spend.",
      },
    };

    return {
      policyChecks: [
        {
          policyId: activePolicy.id,
          result: confidentialDecision.outcome === "approve",
          reason: `Confidential outcome: ${confidentialDecision.outcome}`,
        },
      ],
      decision: {
        ...decisionByOutcome[confidentialDecision.outcome],
        reason:
          decisionByOutcome[confidentialDecision.outcome].reason ||
          `Confidential decision ${confidentialDecision.decisionId} approved spend`,
      },
    };
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

    const action = this.toAgentAction(intent);
    const evaluated = await this.evaluatePolicyChecks(
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
    );
    const policyResult =
      evaluated.decision ||
      this.classifyDecision(activePolicy, evaluated.policyChecks);

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

  /**
   * Execute a governed DeFi action (e.g. Swap) via Fhenix policy and X Layer vault.
   */
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
}

export const owsWalletService = new OwsWalletService();
