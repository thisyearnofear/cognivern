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
import { blockchainConfig } from "../shared/config/index.js";

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
  /**
   * Whether the on-chain approval record was actually written to X Layer.
   * - "recorded" — txHash is a real on-chain receipt
   * - "failed"   — recordOnChainApproval failed; txHash is null
   * - "skipped"  — on-chain recording was not attempted (e.g. disabled)
   *
   * Callers MUST treat "failed" + status=approved as a partial success: the
   * policy approved the spend, the envelope was signed, but the on-chain
   * audit record is missing. The previous behavior fabricated a
   * keccak256(signature) hash and returned it as txHash; that is removed
   * because it conflated "approved" with "on-chain recorded" and was the
   * single most dangerous line in the spend path for credibility.
   */
  onChainStatus?: "recorded" | "failed" | "skipped";
  /**
   * Real on-chain value transfer result (native gas token), separate from the
   * governance approval record above.
   * - "sent"    — transferTxHash is a real broadcast receipt; funds moved
   * - "failed"  — the transfer broadcast failed; transferTxHash is undefined
   * - "skipped" — transfer was not attempted (e.g. amount invalid → held)
   *
   * Same fail-loud contract as onChainStatus: a "failed" transfer with
   * status=approved is a PARTIAL success (policy approved + envelope signed),
   * NOT moved money. Never fabricate transferTxHash on failure.
   */
  transferTxHash?: string;
  transferStatus?: "sent" | "failed" | "skipped";
  transferError?: string;
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

    let valueWei: bigint;
    try {
      valueWei = BigInt(intent.amount);
    } catch {
      s.end({ ok: false, summary: "Invalid spend amount" });
      return await this.handleHold(
        intent,
        recorder,
        `Spend amount "${intent.amount}" is not a valid integer (wei). Held for review.`,
        policyId,
        access,
      );
    }
    if (valueWei <= 0n) {
      s.end({ ok: false, summary: "Non-positive spend amount" });
      return await this.handleHold(
        intent,
        recorder,
        `Spend amount must be positive (got ${valueWei} wei). Held for review.`,
        policyId,
        access,
      );
    }

    return await this.finalizeApprovedSpend({
      intent,
      recorder,
      step: s,
      policyId,
      access,
      signer,
      signature,
      signingProvider: provider,
      valueWei,
      apiKeyToken,
      operatorApproved: false,
    });
  }

  /**
   * Shared tail for an approved spend: broadcast the native value transfer,
   * write the governance approval record, persist evidence, and return the
   * result. Called from both handleApprove (scoped-key path) and
   * resumeHeldSpend (operator-approved path).
   */
  private async finalizeApprovedSpend(params: {
    intent: SpendIntent;
    recorder: CreRunRecorder;
    step: { end: (p: { ok: boolean; summary?: string; details?: Record<string, unknown> }) => void };
    policyId: string;
    access: OwsResolvedAccess;
    signer: string;
    signature?: string;
    signingProvider: string;
    valueWei: bigint;
    apiKeyToken?: string | null;
    operatorApproved: boolean;
  }): Promise<ExecutionResult> {
    const {
      intent,
      recorder,
      step: s,
      policyId,
      access,
      signer,
      signature,
      signingProvider,
      valueWei,
      apiKeyToken,
      operatorApproved,
    } = params;

    // Broadcast the real native value transfer FROM the scoped wallet.
    const transfer = await owsLocalVaultService.sendNativeTransfer({
      walletId: access.wallet.id,
      apiKeyToken: operatorApproved ? undefined : apiKeyToken,
      operatorApproved,
      to: intent.recipient,
      valueWei,
      rpcUrl: blockchainConfig.rpcUrl,
      chainId: blockchainConfig.chainId,
      gasLimit: blockchainConfig.gasLimits.nativeTransfer,
    });
    // Never fabricate transferTxHash on failure (same fail-loud contract as
    // onChainStatus). A failed transfer with status=approved is a PARTIAL
    // success, not moved money — callers must surface it.
    const transferTxHash =
      "txHash" in transfer ? transfer.txHash : undefined;
    const transferStatus: "sent" | "failed" =
      "txHash" in transfer ? "sent" : "failed";
    const transferError =
      "error" in transfer ? transfer.error : undefined;

    // Governance approval record (audit), independent of the value transfer.
    const onChain = await this.onChainManager.recordOnChainApproval({
      intentId: intent.id,
      agentId: intent.agentId,
      actionType: "spend",
      metadata: intent.metadata || {},
    });
    const txHash = onChain.success ? onChain.txHash : undefined;
    const onChainStatus: "recorded" | "failed" = onChain.success
      ? "recorded"
      : "failed";

    await recorder.addArtifact({
      type: "attestation_result",
      data: {
        signingProvider,
        txHash,
        signature,
        transferTxHash,
        transferStatus,
        transferError,
        operatorApproved,
        intentId: intent.id,
        policyId,
        walletId: access.wallet.id,
        walletAddress: signer,
        apiKeyId: access.apiKey?.id,
        status: "approved",
        onChainStatus,
      },
    });

    s.end({
      ok: transferStatus === "sent",
      summary:
        transferStatus === "sent"
          ? `Transfer broadcast: ${transferTxHash}`
          : `Transfer failed: ${transferError}`,
    });
    await recorder.finish(transferStatus === "sent");
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
      onChainStatus,
      transferTxHash,
      transferStatus,
      transferError,
    };
  }

  /**
   * Resume a spend that was held (paused_for_approval) once an operator
   * approves it. Authority here is the operator's JWT (verified by the
   * controller), which substitutes for the scoped OWS API key — the original
   * caller's token is NEVER persisted, so it cannot be replayed here.
   *
   * This is the ONLY path that reaches sendNativeTransfer with
   * operatorApproved=true; the public /api/spend path always goes through the
   * fail-closed scoped-key branch in handleApprove.
   */
  // In-process per-runId serializer. Two concurrent operator approvals on the
  // same held run would otherwise both pass the paused_for_approval guard and
  // double-broadcast — the await get() in each call resolves before either
  // claim is written, so the read-then-write is not atomic. Holding a single
  // promise per runId forces strict serialization within this process.
  // Multi-process deployments still need an external lock (Redis, DB advisory).
  private resumeLocks = new Map<string, Promise<unknown>>();

  public async resumeHeldSpend(
    runId: string,
    operatorId: string,
  ): Promise<ExecutionResult> {
    const prior = this.resumeLocks.get(runId);
    if (prior) {
      await prior.catch(() => undefined);
    }
    let release: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    this.resumeLocks.set(runId, gate);
    try {
      return await this.resumeHeldSpendInner(runId, operatorId);
    } finally {
      release!();
      if (this.resumeLocks.get(runId) === gate) {
        this.resumeLocks.delete(runId);
      }
    }
  }

  private async resumeHeldSpendInner(
    runId: string,
    operatorId: string,
  ): Promise<ExecutionResult> {
    const heldRun = await creRunStore.get(runId);
    if (!heldRun) {
      return { intentId: runId, status: "denied", error: "Run not found" };
    }
    if (heldRun.workflow !== "spend") {
      return {
        intentId: runId,
        status: "denied",
        error: `Run ${runId} is not a spend workflow`,
      };
    }
    if (heldRun.status !== "paused_for_approval") {
      return {
        intentId: runId,
        status: "denied",
        error: `Run ${runId} is not awaiting approval (status: ${heldRun.status})`,
      };
    }

    const intentArtifact = heldRun.artifacts.find(
      (a) => a.type === "spend_intent",
    );
    const intent = intentArtifact?.data as SpendIntent | undefined;
    if (!intent || !intent.id) {
      return {
        intentId: runId,
        status: "denied",
        error: "Held run has no spend_intent artifact to resume",
      };
    }

    // handleHold persisted walletId/policyId on the "error" (held) artifact.
    const heldArtifact = heldRun.artifacts.find((a) => a.type === "error");
    const heldData = (heldArtifact?.data as Record<string, unknown>) || {};
    const walletId =
      (typeof heldData.walletId === "string" ? heldData.walletId : undefined) ||
      (typeof intent.metadata?.walletId === "string"
        ? intent.metadata.walletId
        : undefined);
    const policyId =
      typeof heldData.policyId === "string" ? heldData.policyId : "unknown";

    if (!walletId) {
      return {
        intentId: intent.id,
        status: "denied",
        error: "Held run has no wallet bound; cannot resume",
      };
    }

    const wallet = (await owsLocalVaultService.listWallets()).find(
      (w) => w.id === walletId,
    );
    if (!wallet) {
      return {
        intentId: intent.id,
        status: "denied",
        error: `Wallet ${walletId} no longer exists in the vault`,
      };
    }
    const access: OwsResolvedAccess = { wallet, apiKey: undefined };

    let valueWei: bigint;
    try {
      valueWei = BigInt(intent.amount);
    } catch {
      return {
        intentId: intent.id,
        status: "denied",
        error: `Spend amount "${intent.amount}" is not a valid integer (wei)`,
      };
    }
    if (valueWei <= 0n) {
      return {
        intentId: intent.id,
        status: "denied",
        error: `Spend amount must be positive (got ${valueWei} wei)`,
      };
    }

    // Flip the held run to "running" so the lock-skipping case (e.g. cache
    // re-populates from disk between lock acquisitions, or a future external
    // lock fails open) still has a status-based denial under it. The
    // resumeLocks gate above is the primary defense; this is belt + braces.
    const claimed = {
      ...heldRun,
      status: "running" as const,
      finishedAt: undefined,
    };
    await creRunStore.replace(claimed);

    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    recorder.getRun().parentRunId = runId;
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const s = recorder.startStep("evm_write", "wallet_sign_and_broadcast", {
      resumedFrom: runId,
      operatorId,
    });

    logger.info(
      `Operator ${operatorId} resuming held spend ${intent.id} (run ${runId})`,
    );

    const result = await this.finalizeApprovedSpend({
      intent,
      recorder,
      step: s,
      policyId,
      access,
      signer: wallet.accounts[0]?.address || walletId,
      signature: undefined,
      signingProvider: "operator",
      valueWei,
      apiKeyToken: null,
      operatorApproved: true,
    });

    // Roll back the claim on failure so the held run is retryable. The
    // transfer didn't move money, so the run is still "needs approval" —
    // leaving it at "running" would cause the next attempt to deny.
    if (result.transferStatus !== "sent") {
      const rolledBack = {
        ...heldRun,
        status: "paused_for_approval" as const,
        finishedAt: undefined,
      };
      await creRunStore.replace(rolledBack);
    }

    return result;
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
