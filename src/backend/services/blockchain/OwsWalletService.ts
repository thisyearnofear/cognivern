import logger from '@backend/utils/logger.js';
import crypto from 'node:crypto';
import { Policy } from '@backend/types/Policy.js';
import { PolicyService, sharedPolicyService } from '@backend/services/governance/PolicyService.js';
import { PolicyEnforcementService } from '@backend/services/governance/PolicyEnforcementService.js';
import { CreRunRecorder } from '@backend/cre/runRecorder.js';
import { CreRun } from '@backend/cre/types.js';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import { enrichCreRunEvidence } from '@backend/shared/utils/evidence.js';
import { AgentAction } from '@backend/types/Agent.js';
import { ethers } from 'ethers';
import { owsLocalVaultService, OwsResolvedAccess } from './OwsLocalVaultService.js';
import { ledgerSigningProvider } from '@backend/signing/LedgerSigningProvider.js';
import { FhenixPolicyService, sharedFhenixPolicyService } from './FhenixPolicyService.js';
import { OwsWalletPolicyEvaluator } from './OwsWalletPolicy.js';
import { OwsWalletOnChainManager } from './OwsWalletOnChain.js';
import { blockchainConfig, cleanverseConfig, keeperHubConfig } from '@backend/shared/config/index.js';
import { keeperHubExecutionProvider } from './KeeperHubExecutionProvider.js';
import {
  cleanverseExecutionProvider,
  cleanverseIdentityService,
  deriveCleanversePolicySignals,
  summarizeAPass,
  type CleanverseIdentityScreening,
} from './cleanverse/index.js';
import {
  sourceAwareSpendAuthorizationService,
  SpendSourceProvenance,
} from '@backend/services/governance/SourceAwareSpendAuthorization.js';
import { FundedMandateService, type FundedMandate } from '@backend/services/governance/FundedMandateService.js';

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
  status: 'approved' | 'held' | 'denied';
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
  onChainStatus?: 'recorded' | 'failed' | 'skipped';
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
  /** KeeperHub execution identifier for cross-system evidence correlation. */
  transferExecutionId?: string;
  /** Chain used by the execution provider, for explorer links and evidence. */
  transferChainId?: number;
  /** Sender identity reported by the managed execution provider. */
  transferFrom?: string;
  /** KeeperHub-provided explorer link for the transfer, when available. */
  transferTransactionLink?: string;
  /** Whether KeeperHub used a sponsored/relayed execution path. */
  transferSponsored?: boolean;
  /** KeeperHub's authoritative receipt verification result. */
  transferVerified?: boolean;
  transferReceiptStatus?: string;
  transferReceipts?: Array<{
    hash: string;
    chainId?: number;
    verified?: boolean;
    receiptStatus?: string;
    blockNumber?: number;
    gasUsed?: string;
    verifiedAt?: string;
  }>;
  transferStatus?: 'sent' | 'failed' | 'skipped' | 'uncertain';
  transferError?: string;
  transferIdempotencyKey?: string;
  /** A provider execution exists, but completion/evidence is not yet safe to retry. */
  transferUncertain?: boolean;
  /**
   * Independent reconciliation of the recorded transferTxHash against the
   * actual chain receipt (status, recipient, value). The audit record is
   * built from this verification, not from the broadcast call's own
   * return value — the executor's claim is treated as a claim.
   * - "verified"   — receipt fetched; status/recipient/value all match
   * - "mismatch"   — receipt fetched but at least one check failed
   * - "unverified" — no receipt available (timeout, managed executor, RPC error)
   */
  receiptVerification?: ReceiptVerification;
}

export interface ReceiptVerification {
  outcome: 'verified' | 'mismatch' | 'unverified';
  checks?: {
    receiptStatusOk: boolean;
    recipientMatches: boolean;
    valueMatches: boolean;
  };
  blockNumber?: number;
  reason?: string;
}

export interface SpendExecutionContext {
  apiKeyToken?: string | null;
  walletId?: string;
  confidential?: boolean;
  encryptedAmount?: string;
  vendorHash?: string;
  /** Raw, short-lived authorization supplied for this request only. It is
   * validated into audit-safe evidence and is never persisted in the run. */
  sourceAuthorizationToken?: string;
  /** Workspace context used to scope persisted spend evidence. */
  workspaceId?: string;
}

export class OwsWalletService {
  private policyService: PolicyService;
  private policyEnforcement: PolicyEnforcementService;
  private fhenixPolicyService: FhenixPolicyService;
  private policyEvaluator: OwsWalletPolicyEvaluator;
  onChainManager: OwsWalletOnChainManager;

  constructor(policyService?: PolicyService, fhenixPolicyService?: FhenixPolicyService) {
    this.policyService = policyService || sharedPolicyService;
    this.fhenixPolicyService = fhenixPolicyService || sharedFhenixPolicyService;
    this.policyEnforcement = new PolicyEnforcementService(
      this.policyService,
      this.fhenixPolicyService,
    );
    this.policyEvaluator = new OwsWalletPolicyEvaluator();
    this.onChainManager = new OwsWalletOnChainManager();
  }

  public async issueAuditPermit(auditor: string, policyId: string): Promise<string> {
    return this.fhenixPolicyService.issueAuditPermit(auditor, policyId);
  }

  public async initialize(): Promise<void> {
    await owsLocalVaultService.ensureBootstrapWallet();
  }

  public async getScopedAccess(agentId: string, scope: string[]): Promise<boolean> {
    logger.info(`Requesting scoped access for agent ${agentId}: ${scope.join(', ')}`);
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
    const mandateId = typeof intent.metadata?.mandateId === 'string' ? intent.metadata.mandateId.trim() : undefined;
    if (mandateId && (!context.workspaceId || !FundedMandateService.get(context.workspaceId, mandateId))) {
      return {
        intentId: intent.id,
        status: 'denied',
        error: 'Mandate is not valid for the current workspace',
      };
    }
    const access = await this.resolveAccess(intent, context);
    const recorder = new CreRunRecorder({
      workflow: 'spend',
      mode: access ? 'cre' : 'local',
    });
    recorder.getRun().projectId = context.workspaceId;

    try {
      logger.info(`SpendOS: Evaluating intent ${intent.id} from agent ${intent.agentId}`);

      const sourceAuthorization = sourceAwareSpendAuthorizationService.evaluate({
        agentId: intent.agentId,
        recipient: intent.recipient,
        amount: intent.amount,
        asset: intent.asset,
        reason: intent.reason,
        provenance: intent.metadata?.sourceProvenance as SpendSourceProvenance | undefined,
        token: context.sourceAuthorizationToken,
        consume: true,
      });
      intent.metadata = {
        ...(intent.metadata || {}),
        sourceAuthorization,
        ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
      };

      await recorder.addArtifact({
        type: 'spend_intent',
        data: intent,
      });

      if (!sourceAuthorization.authorized) {
        return await this.handleHold(
          intent,
          recorder,
          sourceAuthorization.reason || 'Source-aware authorization is required.',
          'source-aware-authorization',
          access,
        );
      }

      // Mandate settlement constraints (optional Cleanverse / asset / chain rules).
      const mandateEnforcement = this.enforceMandateSettlement(intent, access, context);
      if (mandateEnforcement) {
        if (mandateEnforcement.denyReason) {
          return await this.handleDeny(
            intent,
            recorder,
            mandateEnforcement.denyReason,
            [],
            'mandate-settlement',
            access,
          );
        }
        if (mandateEnforcement.forceCleanverseIdentity) {
          intent.metadata = {
            ...(intent.metadata || {}),
            requireCleanverseIdentity: true,
          };
        }
        if (mandateEnforcement.normalizedAsset) {
          intent.asset = mandateEnforcement.normalizedAsset;
        }
      }

      // CVI gate — A-Pass screening before policy evaluation when the wallet
      // is on the Cleanverse rail (or identity is explicitly required).
      const cleanverseScreening = await this.screenCleanverseIdentity(intent, access);
      if (cleanverseScreening) {
        const policySignals = cleanverseScreening.ok
          ? deriveCleanversePolicySignals(cleanverseScreening)
          : undefined;
        intent.metadata = {
          ...(intent.metadata || {}),
          cleanverseIdentity: cleanverseScreening,
          ...(policySignals
            ? {
                cleanverse: {
                  ...policySignals,
                  sender: summarizeAPass(cleanverseScreening.sender.aPass),
                  recipient: summarizeAPass(cleanverseScreening.recipient.aPass),
                },
              }
            : {}),
        };
        await recorder.addArtifact({
          type: 'cleanverse_apass',
          data: {
            ...cleanverseScreening,
            policySignals,
          },
        });
        if (!cleanverseScreening.ok) {
          return await this.handleDeny(
            intent,
            recorder,
            cleanverseScreening.reason || 'Cleanverse CVI (A-Pass) screening failed',
            [],
            'cleanverse-cvi',
            access,
          );
        }
      }

      // Mandates that require verified settlement must run on the Cleanverse rail.
      const mandate = this.resolveMandate(intent, context);
      if (
        mandate?.settlement?.requireVerifiedSettlement &&
        (access?.wallet.metadata?.executionProvider as string) !== 'cleanverse'
      ) {
        return await this.handleDeny(
          intent,
          recorder,
          'Mandate requires Cleanverse verified settlement (executionProvider=cleanverse)',
          [],
          'mandate-settlement',
          access,
        );
      }

      const step = recorder.startStep('compute', 'policy_evaluation', {
        intent,
      });

      const action = this.policyEvaluator.toAgentAction(intent);
      const activePolicy = await this.policyEvaluator.resolveActiveSpendPolicy(
        this.policyService,
        access?.apiKey?.policyIds?.[0] ||
          (typeof intent.metadata?.policyId === 'string' ? intent.metadata.policyId : undefined),
      );
      if (!activePolicy) {
        step.end({ ok: false, summary: 'No active spend policy available' });
        return await this.handleHold(
          intent,
          recorder,
          'No active spend policy is available. Held for manual review.',
          undefined,
          access,
        );
      }

      let policyChecks: AgentAction['policyChecks'] = [];
      let policyDecision: { status: ExecutionResult['status']; reason?: string } | undefined;
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
        step.end({ ok: false, summary: 'Policy evaluation failed' });
        logger.warn(`Policy evaluation failed: ${e instanceof Error ? e.message : 'unknown'}`);
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
        ok: decision.status === 'approved',
        summary:
          decision.status === 'approved'
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

      if (decision.status === 'denied') {
        return await this.handleDeny(
          intent,
          recorder,
          decision.reason || 'Policy violation',
          policyChecks,
          activePolicy.id,
          access,
        );
      }

      if (decision.status === 'held') {
        return await this.handleHold(
          intent,
          recorder,
          decision.reason || 'Spend requires manual review.',
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
      const errMsg = error instanceof Error ? error.message : 'Unknown execution error';
      logger.error(`SpendOS execution failed: ${errMsg}`);
      await this.addSpendAttributionArtifact(recorder, intent, {
        status: 'failed',
        allocatedAmount: '0',
        consumedAmount: '0',
        outcome: errMsg,
      });
      await recorder.finish(false);
      await this.persistRun(recorder);
      return {
        intentId: intent.id,
        status: 'denied',
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
    const s = recorder.startStep('evm_write', 'wallet_sign_and_broadcast');

    if (!access) {
      s.end({ ok: false, summary: 'Wallet unavailable for signing' });
      return await this.handleHold(
        intent,
        recorder,
        'Wallet access is not authorized. Spend held until a valid OWS API key is provided.',
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
    const provider =
      (metadata.signingProvider as string) || (metadata.externalSource ? 'ows_remote' : 'local');

    switch (provider) {
      case 'ledger': {
        try {
          const result = await ledgerSigningProvider.sign({
            walletId: access.wallet.id,
            message: payload,
          });
          signature = result.signature;
          signer = result.signer;
        } catch (error) {
          s.end({ ok: false, summary: 'Ledger hardware signing failed' });
          const message = error instanceof Error ? error.message : 'Unknown Ledger error';
          return await this.handleHold(
            intent,
            recorder,
            `Ledger signing failed: ${message}. ` +
              'Connect and unlock your Ledger device, open the Ethereum app, and try again.',
            policyId,
            access,
          );
        }
        break;
      }

      case 'speculos':
      case 'ows_remote': {
        const externalResult = await owsLocalVaultService.signWithExternalWallet({
          walletId: access.wallet.id,
          message: payload,
        });

        if (!externalResult) {
          s.end({ ok: false, summary: 'External wallet signing failed' });
          return await this.handleHold(
            intent,
            recorder,
            'External wallet signing failed. Spend held for manual review.',
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
      s.end({ ok: false, summary: 'Invalid spend amount' });
      return await this.handleHold(
        intent,
        recorder,
        `Spend amount "${intent.amount}" is not a valid integer (wei). Held for review.`,
        policyId,
        access,
      );
    }
    if (valueWei <= 0n) {
      s.end({ ok: false, summary: 'Non-positive spend amount' });
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
    step: {
      end: (p: { ok: boolean; summary?: string; details?: Record<string, unknown> }) => void;
    };
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

    // Broadcast the real value transfer FROM the scoped wallet.
    // KeeperHub → managed native transfer; Cleanverse → aUSD-D ERC-20 on Monad;
    // otherwise local native RPC.
    const executionProvider = (access.wallet.metadata?.executionProvider as string) || 'local';
    const rawChainId = access.wallet.metadata?.chainId;
    const walletChainId =
      typeof rawChainId === 'number'
        ? rawChainId
        : typeof rawChainId === 'string'
          ? Number(rawChainId)
          : executionProvider === 'cleanverse'
            ? cleanverseConfig.monadChainId
            : blockchainConfig.chainId;
    const keeperHubWalletAddress = access.wallet.metadata?.keeperHubWalletAddress as
      | string
      | undefined;
    const cleanverseSenderAddress = access.wallet.metadata?.cleanverseSenderAddress as
      | string
      | undefined;
    const senderAddress =
      executionProvider === 'cleanverse'
        ? cleanverseSenderAddress || access.wallet.accounts[0]?.address || signer
        : keeperHubWalletAddress || access.wallet.accounts[0]?.address || signer;

    let transfer:
      | Awaited<ReturnType<typeof keeperHubExecutionProvider.executeTransfer>>
      | Awaited<ReturnType<typeof cleanverseExecutionProvider.executeTransfer>>
      | Awaited<ReturnType<typeof owsLocalVaultService.sendNativeTransfer>>;

    if (executionProvider === 'keeperhub') {
      transfer = await keeperHubExecutionProvider.executeTransfer({
        intentId: intent.id,
        from: senderAddress,
        to: intent.recipient,
        valueWei,
        chainId: walletChainId,
      });
    } else if (executionProvider === 'cleanverse') {
      transfer = await cleanverseExecutionProvider.executeTransfer({
        intentId: intent.id,
        walletId: access.wallet.id,
        apiKeyToken,
        operatorApproved,
        from: senderAddress,
        to: intent.recipient,
        amount: valueWei,
        chainId: walletChainId || cleanverseConfig.monadChainId,
      });
    } else {
      transfer = await owsLocalVaultService.sendNativeTransfer({
        walletId: access.wallet.id,
        apiKeyToken: operatorApproved ? undefined : apiKeyToken,
        operatorApproved,
        to: intent.recipient,
        valueWei,
        rpcUrl: blockchainConfig.rpcUrl,
        chainId: blockchainConfig.chainId,
        gasLimit: blockchainConfig.gasLimits.nativeTransfer,
      });
    }
    // Never fabricate transferTxHash on failure (same fail-loud contract as
    // onChainStatus). A failed transfer with status=approved is a PARTIAL
    // success, not moved money — callers must surface it.
    const transferTxHash = 'txHash' in transfer ? transfer.txHash : undefined;
    const transferExecutionId =
      'executionId' in transfer && typeof transfer.executionId === 'string'
        ? transfer.executionId
        : undefined;
    const transferChainId =
      'chainId' in transfer && typeof transfer.chainId === 'number' ? transfer.chainId : undefined;
    const transferFrom =
      'from' in transfer && typeof transfer.from === 'string' ? transfer.from : undefined;
    const transferTransactionLink =
      'transactionLink' in transfer && typeof transfer.transactionLink === 'string'
        ? transfer.transactionLink
        : undefined;
    const transferSponsored =
      'sponsored' in transfer && typeof transfer.sponsored === 'boolean'
        ? transfer.sponsored
        : undefined;
    const transferVerified =
      'verified' in transfer && typeof transfer.verified === 'boolean'
        ? transfer.verified
        : undefined;
    const transferReceiptStatus =
      'receiptStatus' in transfer && typeof transfer.receiptStatus === 'string'
        ? transfer.receiptStatus
        : undefined;
    const transferReceipts =
      'receipts' in transfer && Array.isArray(transfer.receipts) ? transfer.receipts : undefined;
    const transferTokenAddress =
      'tokenAddress' in transfer && typeof transfer.tokenAddress === 'string'
        ? transfer.tokenAddress
        : undefined;
    const transferTokenSymbol =
      'tokenSymbol' in transfer && typeof transfer.tokenSymbol === 'string'
        ? transfer.tokenSymbol
        : undefined;
    const transferVerifyApass =
      'verifyApass' in transfer ? transfer.verifyApass : undefined;
    const transferError = 'error' in transfer ? transfer.error : undefined;
    const transferIdempotencyKey =
      'idempotencyKey' in transfer && typeof transfer.idempotencyKey === 'string'
        ? transfer.idempotencyKey
        : undefined;
    const providerTransferUncertain = 'uncertain' in transfer && transfer.uncertain === true;
    const hasValidTransferTxHash =
      typeof transferTxHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(transferTxHash);
    const claimedTransferResponse =
      ('txHash' in transfer && transfer.txHash !== undefined) ||
      ('executionId' in transfer && transfer.executionId !== undefined) ||
      providerTransferUncertain;
    const transferStatus: 'sent' | 'failed' | 'uncertain' =
      hasValidTransferTxHash
        ? 'sent'
        : claimedTransferResponse
          ? 'uncertain'
          : 'failed';

    // Reconcile the claimed txHash against the actual chain receipt. The
    // executor's return value is treated as a claim; the audit record
    // carries the independent verification outcome.
    let receiptVerification: ReceiptVerification;
    if (transferStatus !== 'sent' || !transferTxHash) {
      receiptVerification = {
        outcome: 'unverified',
        reason: 'no broadcast to verify',
      };
    } else if (executionProvider === 'keeperhub') {
      const receiptStatusOk = transferReceiptStatus === 'success';
      const verified = transferVerified === true;
      const recipientMatches = 'recipientMatches' in transfer && transfer.recipientMatches === true;
      const valueMatches = 'valueMatches' in transfer && transfer.valueMatches === true;
      receiptVerification = {
        outcome: verified && receiptStatusOk && recipientMatches && valueMatches ? 'verified' : 'unverified',
        checks: {
          receiptStatusOk,
          recipientMatches,
          valueMatches,
        },
        reason:
          verified && receiptStatusOk && recipientMatches && valueMatches
            ? undefined
            : 'KeeperHub did not provide a verified receipt matching the requested transfer',
      };
    } else if (executionProvider === 'cleanverse') {
      const receiptStatusOk =
        'receiptStatus' in transfer && transfer.receiptStatus === 'success';
      const verified = 'verified' in transfer && transfer.verified === true;
      const recipientMatches =
        'recipientMatches' in transfer && transfer.recipientMatches === true;
      const valueMatches = 'valueMatches' in transfer && transfer.valueMatches === true;
      receiptVerification = {
        outcome:
          verified && receiptStatusOk && recipientMatches && valueMatches
            ? 'verified'
            : 'unverified',
        checks: {
          receiptStatusOk,
          recipientMatches,
          valueMatches,
        },
        reason:
          verified && receiptStatusOk && recipientMatches && valueMatches
            ? undefined
            : 'Cleanverse aUSD-D Transfer event did not match the requested spend',
      };
    } else {
      receiptVerification = await this.verifyTransferReceipt(
        transferTxHash,
        intent.recipient,
        valueWei,
      );
      if (receiptVerification.outcome === 'mismatch') {
        logger.error(
          `Receipt mismatch for spend ${intent.id} (tx ${transferTxHash}): ${JSON.stringify(receiptVerification.checks)}`,
        );
      }
    }

    await recorder.addArtifact({
      type: 'receipt_verification',
      data: {
        intentId: intent.id,
        transferTxHash,
        expectedRecipient: intent.recipient,
        expectedValueWei: valueWei.toString(),
        ...receiptVerification,
      },
    });

    // Governance approval record (audit), independent of the value transfer.
    const onChain = await this.onChainManager.recordOnChainApproval({
      intentId: intent.id,
      agentId: intent.agentId,
      actionType: 'spend',
      metadata: intent.metadata || {},
    });
    const txHash = onChain.success ? onChain.txHash : undefined;
    const onChainDataHash = onChain.success ? onChain.dataHash : undefined;
    const onChainStatus: 'recorded' | 'failed' = onChain.success ? 'recorded' : 'failed';

    // A failed broadcast is retryable because no transaction was claimed. A
    // claimed-but-unverified or provider-uncertain execution is different:
    // it may already have moved funds and must be reconciled before retry.
    const transferUncertain =
      transferStatus === 'uncertain' ||
      (transferStatus === 'sent' && receiptVerification.outcome !== 'verified');
    const attributionStatus =
      transferStatus === 'failed'
        ? 'failed'
        : transferUncertain
          ? 'uncertain'
          : 'consumed';
    const normalizedTransferStatus: 'sent' | 'failed' | 'uncertain' = transferUncertain
      ? 'uncertain'
      : transferStatus;
    await this.addSpendAttributionArtifact(recorder, intent, {
      status: attributionStatus,
      allocatedAmount: valueWei.toString(),
      consumedAmount: attributionStatus === 'consumed' ? valueWei.toString() : '0',
      policyId,
      provider: executionProvider,
      executionId: transferExecutionId,
      transactionHash: transferTxHash,
      transactionLink: transferTransactionLink,
      outcome:
        attributionStatus === 'consumed'
          ? 'value_transfer_verified'
          : transferError || receiptVerification.reason,
    });

    if (transferUncertain) {
      await recorder.addArtifact({
        type: 'error',
        data: {
          intentId: intent.id,
          status: 'execution_uncertain',
          reason:
            transferError ||
            receiptVerification.reason ||
            'Transfer was submitted but could not be independently verified',
          recoveryRequired: true,
          transferExecutionId,
          transferIdempotencyKey,
          transferTxHash,
          expectedSender: transferFrom || signer,
          expectedRecipient: intent.recipient,
          expectedValueWei: valueWei.toString(),
          chainId: transferChainId || walletChainId,
        },
      });
    }

    await recorder.addArtifact({
      type: 'attestation_result',
      data: {
        signingProvider,
        executionProvider,
        txHash,
        signature,
        transferTxHash,
        transferExecutionId,
        transferChainId,
        transferFrom,
        transferTransactionLink,
        transferSponsored,
        transferVerified,
        transferReceiptStatus,
        transferReceipts,
        transferTokenAddress,
        transferTokenSymbol,
        transferVerifyApass,
        transferStatus: normalizedTransferStatus,
        transferError,
        transferIdempotencyKey,
        transferUncertain,
        receiptVerification,
        operatorApproved,
        intentId: intent.id,
        policyId,
        walletId: access.wallet.id,
        walletAddress: signer,
        apiKeyId: access.apiKey?.id,
        status: 'approved',
        onChainStatus,
        onChainDataHash,
      },
    });

    s.end({
      ok: normalizedTransferStatus === 'sent' && receiptVerification.outcome === 'verified',
      summary:
        normalizedTransferStatus === 'sent'
          ? `Transfer broadcast: ${transferTxHash}`
          : normalizedTransferStatus === 'uncertain'
            ? 'Transfer submitted but receipt verification is required'
            : `Transfer failed: ${transferError}`,
    });
    await recorder.finish(normalizedTransferStatus === 'sent' && receiptVerification.outcome === 'verified');
    const run = await this.persistRun(recorder);

    return {
      intentId: intent.id,
      runId: run.runId,
      status: 'approved',
      policyId,
      walletId: access.wallet.id,
      walletAddress: signer,
      apiKeyId: access.apiKey?.id,
      txHash,
      signature,
      onChainStatus,
      transferTxHash,
      transferExecutionId,
      transferChainId,
      transferFrom,
      transferTransactionLink,
      transferSponsored,
      transferVerified,
      transferReceiptStatus,
      transferReceipts,
      transferStatus: normalizedTransferStatus,
      transferError,
      transferIdempotencyKey,
      transferUncertain,
      receiptVerification,
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

  public async resumeHeldSpend(runId: string, operatorId: string): Promise<ExecutionResult> {
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

  private async resumeHeldSpendInner(runId: string, operatorId: string): Promise<ExecutionResult> {
    const heldRun = await creRunStore.get(runId);
    if (!heldRun) {
      return { intentId: runId, status: 'denied', error: 'Run not found' };
    }
    if (heldRun.workflow !== 'spend') {
      return {
        intentId: runId,
        status: 'denied',
        error: `Run ${runId} is not a spend workflow`,
      };
    }
    if (heldRun.status !== 'paused_for_approval') {
      return {
        intentId: runId,
        status: 'denied',
        error: `Run ${runId} is not awaiting approval (status: ${heldRun.status})`,
      };
    }

    const intentArtifact = heldRun.artifacts.find((a) => a.type === 'spend_intent');
    const intent = intentArtifact?.data as SpendIntent | undefined;
    if (!intent || !intent.id) {
      return {
        intentId: runId,
        status: 'denied',
        error: 'Held run has no spend_intent artifact to resume',
      };
    }

    // handleHold persisted walletId/policyId on the "error" (held) artifact.
    const heldArtifact = heldRun.artifacts.find((a) => a.type === 'error');
    const heldData = (heldArtifact?.data as Record<string, unknown>) || {};
    const walletId =
      (typeof heldData.walletId === 'string' ? heldData.walletId : undefined) ||
      (typeof intent.metadata?.walletId === 'string' ? intent.metadata.walletId : undefined);
    const policyId = typeof heldData.policyId === 'string' ? heldData.policyId : 'unknown';

    if (!walletId) {
      return {
        intentId: intent.id,
        status: 'denied',
        error: 'Held run has no wallet bound; cannot resume',
      };
    }

    const wallet = (await owsLocalVaultService.listWallets()).find((w) => w.id === walletId);
    if (!wallet) {
      return {
        intentId: intent.id,
        status: 'denied',
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
        status: 'denied',
        error: `Spend amount "${intent.amount}" is not a valid integer (wei)`,
      };
    }
    if (valueWei <= 0n) {
      return {
        intentId: intent.id,
        status: 'denied',
        error: `Spend amount must be positive (got ${valueWei} wei)`,
      };
    }

    // Flip the held run to "running" so the lock-skipping case (e.g. cache
    // re-populates from disk between lock acquisitions, or a future external
    // lock fails open) still has a status-based denial under it. The
    // resumeLocks gate above is the primary defense; this is belt + braces.
    const claimed = {
      ...heldRun,
      status: 'running' as const,
      finishedAt: undefined,
    };
    await creRunStore.replace(claimed);

    const recorder = new CreRunRecorder({ workflow: 'spend', mode: 'cre' });
    recorder.getRun().parentRunId = runId;
    recorder.getRun().projectId = heldRun.projectId;
    await recorder.addArtifact({ type: 'spend_intent', data: intent });
    const s = recorder.startStep('evm_write', 'wallet_sign_and_broadcast', {
      resumedFrom: runId,
      operatorId,
    });

    logger.info(`Operator ${operatorId} resuming held spend ${intent.id} (run ${runId})`);

    try {
      const result = await this.finalizeApprovedSpend({
        intent,
        recorder,
        step: s,
        policyId,
        access,
        signer: wallet.accounts[0]?.address || walletId,
        signature: undefined,
        signingProvider: 'operator',
        valueWei,
        apiKeyToken: null,
        operatorApproved: true,
      });

      if (result.transferStatus === 'uncertain') {
        // An ambiguous provider response does not prove that no funds moved.
        // Keep the original claim locked and persist a recovery marker; an
        // operator must reconcile the provider execution before any retry.
        const recoveryRun: CreRun = {
          ...claimed,
          ok: false,
          status: 'running',
          requiresApproval: false,
          approvalState: 'pending',
          artifacts: [
            ...claimed.artifacts,
            {
              id: crypto.randomUUID(),
              type: 'error',
              createdAt: new Date().toISOString(),
              data: {
                intentId: intent.id,
                status: 'execution_uncertain',
                reason: result.transferError || 'KeeperHub execution status is uncertain',
                operatorId,
                recoveryRequired: true,                    transferExecutionId: result.transferExecutionId,
                    transferIdempotencyKey: result.transferIdempotencyKey,
                    expectedSender:
                      (access.wallet.metadata?.keeperHubWalletAddress as string | undefined) ||
                      access.wallet.accounts[0]?.address,
                    expectedRecipient: intent.recipient,
                expectedValueWei: valueWei.toString(),
                chainId: Number(access.wallet.metadata?.chainId || blockchainConfig.chainId),
              },
            },
          ],
        };
        await creRunStore.replace(enrichCreRunEvidence(recoveryRun));
      } else if (result.transferStatus !== 'sent') {
        // A returned ordinary failure proves that this invocation did not
        // move money, so the original held run is safe to retry.
        const rolledBack = {
          ...heldRun,
          status: 'paused_for_approval' as const,
          finishedAt: undefined,
        };
        await creRunStore.replace(rolledBack);
      }

      return result;
    } catch (error) {
      // Once the provider has been called, an exception does not prove that
      // no funds moved. Keep the claim as `running` rather than reopening it
      // and risking a duplicate broadcast. Persist an explicit recovery
      // artifact so an operator can reconcile the provider execution before
      // any retry/release is introduced.
      const message = error instanceof Error ? error.message : String(error);
      const uncertainRun: CreRun = {
        ...claimed,
        ok: false,
        status: 'running',
        requiresApproval: false,
        approvalState: 'pending',
        artifacts: [
          ...claimed.artifacts,
          {
            id: crypto.randomUUID(),
            type: 'error',
            createdAt: new Date().toISOString(),
            data: {
              intentId: intent.id,
              status: 'execution_uncertain',
              reason: message,
              operatorId,                    recoveryRequired: true,
                    expectedSender:
                      (access.wallet.metadata?.keeperHubWalletAddress as string | undefined) ||
                      access.wallet.accounts[0]?.address,
                    expectedRecipient: intent.recipient,
                    expectedValueWei: valueWei.toString(),
              chainId: Number(access.wallet.metadata?.chainId || blockchainConfig.chainId),
            },
          },
        ],
      };
      await creRunStore.replace(enrichCreRunEvidence(uncertainRun));
      return {
        intentId: intent.id,
        runId,
        status: 'held',
        reason: 'execution_uncertain',
        transferStatus: 'uncertain',
        transferUncertain: true,
        error: `Spend execution is uncertain and requires reconciliation: ${message}`,
      };
    }
  }

  /**
   * Fetch the real chain receipt for a claimed transfer txHash and compare
   * it against what the intent said should happen. Best-effort: RPC errors
   * or timeouts yield "unverified", never a throw.
   */
  private async verifyTransferReceipt(
    txHash: string,
    expectedRecipient: string,
    expectedValueWei: bigint,
  ): Promise<ReceiptVerification> {
    try {
      const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      const receipt = await provider.waitForTransaction(txHash, 1, 10_000);
      if (!receipt) {
        return {
          outcome: 'unverified',
          reason: 'no receipt within 10s of broadcast',
        };
      }
      const tx = await provider.getTransaction(txHash);
      const checks = {
        receiptStatusOk: receipt.status === 1,
        recipientMatches: (tx?.to || '').toLowerCase() === expectedRecipient.toLowerCase(),
        valueMatches: tx ? tx.value === expectedValueWei : false,
      };
      const ok = checks.receiptStatusOk && checks.recipientMatches && checks.valueMatches;
      return {
        outcome: ok ? 'verified' : 'mismatch',
        checks,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      return {
        outcome: 'unverified',
        reason: `receipt fetch failed: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }
  }

  private async addSpendAttributionArtifact(
    recorder: CreRunRecorder,
    intent: SpendIntent,
    params: {
      status: 'allocated' | 'consumed' | 'held' | 'denied' | 'failed' | 'uncertain';
      allocatedAmount: string;
      consumedAmount: string;
      policyId?: string;
      provider?: string;
      executionId?: string;
      transactionHash?: string;
      transactionLink?: string;
      outcome?: string;
    },
  ): Promise<void> {
    const metadata = intent.metadata || {};
    const allocationId =
      typeof metadata.allocationId === 'string' && metadata.allocationId.trim()
        ? metadata.allocationId.trim()
        : intent.id;
    const mandateId = typeof metadata.mandateId === 'string' ? metadata.mandateId : undefined;
    const budgetId = typeof metadata.budgetId === 'string' ? metadata.budgetId : undefined;
    const workspaceId =
      typeof metadata.workspaceId === 'string'
        ? metadata.workspaceId
        : recorder.getRun().projectId;
    const requestedAmount = intent.amount;
    const recordedAt = new Date().toISOString();
    const cleanverse = metadata.cleanverse as Record<string, unknown> | undefined;
    const cleanverseIdentity = metadata.cleanverseIdentity as CleanverseIdentityScreening | undefined;
    const compliance =
      cleanverse || cleanverseIdentity
        ? {
            cviOk: cleanverseIdentity?.ok === true,
            provider: params.provider,
            tier:
              typeof cleanverse?.senderTier === 'string'
                ? cleanverse.senderTier
                : undefined,
            amlCapUsd:
              typeof cleanverse?.amlCapUsd === 'number' ? cleanverse.amlCapUsd : undefined,
            travelRuleRequired: cleanverse?.travelRuleRequired === true,
            riskTier:
              typeof cleanverse?.riskTier === 'string' ? cleanverse.riskTier : undefined,
            verifiedSettlement: params.provider === 'cleanverse' && params.status === 'consumed',
          }
        : undefined;

    await recorder.addArtifact({
      type: 'capital_attribution',
      data: {
        version: 1,
        allocationId,
        workspaceId,
        mandateId,
        budgetId,
        intentId: intent.id,
        agentId: intent.agentId,
        policyId: params.policyId,
        asset: intent.asset,
        requestedAmount,
        allocatedAmount: params.allocatedAmount,
        consumedAmount: params.consumedAmount,
        status: params.status,
        provider: params.provider,
        executionId: params.executionId,
        transactionHash: params.transactionHash,
        transactionLink: params.transactionLink,
        outcome: params.outcome,
        recordedAt,
        ...(compliance ? { compliance } : {}),
      },
    });
  }

  private resolveMandate(
    intent: SpendIntent,
    context: SpendExecutionContext,
  ): FundedMandate | undefined {
    const mandateId =
      typeof intent.metadata?.mandateId === 'string' ? intent.metadata.mandateId.trim() : undefined;
    if (!mandateId || !context.workspaceId) return undefined;
    return FundedMandateService.get(context.workspaceId, mandateId);
  }

  private enforceMandateSettlement(
    intent: SpendIntent,
    access: OwsResolvedAccess | null | undefined,
    context: SpendExecutionContext,
  ): {
    denyReason?: string;
    forceCleanverseIdentity?: boolean;
    normalizedAsset?: string;
  } | null {
    const mandate = this.resolveMandate(intent, context);
    const settlement = mandate?.settlement;
    if (!settlement) return null;

    const result: {
      denyReason?: string;
      forceCleanverseIdentity?: boolean;
      normalizedAsset?: string;
    } = {};

    if (settlement.requireCleanverseIdentity || settlement.requireVerifiedSettlement) {
      result.forceCleanverseIdentity = true;
    }

    if (settlement.allowedAssets && settlement.allowedAssets.length > 0) {
      const allowed = new Map(
        settlement.allowedAssets.map((asset) => [asset.toUpperCase(), asset]),
      );
      const match = allowed.get(intent.asset.toUpperCase());
      if (!match) {
        result.denyReason = `Mandate settlement allows only: ${settlement.allowedAssets.join(', ')} (got ${intent.asset})`;
        return result;
      }
      result.normalizedAsset = match;
    }

    if (settlement.chainIds && settlement.chainIds.length > 0 && access) {
      const rawChainId = access.wallet.metadata?.chainId;
      const walletChainId =
        typeof rawChainId === 'number'
          ? rawChainId
          : typeof rawChainId === 'string'
            ? Number(rawChainId)
            : undefined;
      if (walletChainId === undefined || !settlement.chainIds.includes(walletChainId)) {
        result.denyReason = `Mandate settlement requires chain ${settlement.chainIds.join(', ')} (wallet chain ${walletChainId ?? 'unset'})`;
        return result;
      }
    }

    return result;
  }

  /**
   * When the wallet is on the Cleanverse rail (or identity is required),
   * screen sender + recipient A-Pass before policy evaluation.
   */
  private async screenCleanverseIdentity(
    intent: SpendIntent,
    access?: OwsResolvedAccess | null,
  ): Promise<CleanverseIdentityScreening | null> {
    const meta = access?.wallet.metadata || {};
    const executionProvider = (meta.executionProvider as string) || 'local';
    const requireIdentity =
      meta.requireCleanverseIdentity === true ||
      intent.metadata?.requireCleanverseIdentity === true;
    const needsScreening =
      executionProvider === 'cleanverse' ||
      requireIdentity ||
      cleanverseConfig.gateAllSpends;

    if (!needsScreening) {
      return null;
    }

    if (!cleanverseConfig.enabled) {
      return {
        required: true,
        chain: cleanverseConfig.chain,
        sender: {
          address: '',
          ok: false,
          reason: 'Cleanverse is not configured (missing API credentials)',
        },
        recipient: {
          address: intent.recipient,
          ok: false,
          reason: 'Cleanverse is not configured (missing API credentials)',
        },
        ok: false,
        reason:
          'Cleanverse CVI screening required but CLEANVERSE_API_ID / CLEANVERSE_API_KEY are not set',
      };
    }

    const sender =
      (typeof meta.cleanverseSenderAddress === 'string' && meta.cleanverseSenderAddress) ||
      access?.wallet.accounts[0]?.address;
    if (!sender) {
      return {
        required: true,
        chain: cleanverseConfig.chain,
        sender: { address: '', ok: false, reason: 'Sender wallet address unavailable' },
        recipient: { address: intent.recipient, ok: false, reason: 'Sender unavailable' },
        ok: false,
        reason: 'Cannot screen Cleanverse identity without a sender wallet address',
      };
    }

    return cleanverseIdentityService.screenAddresses(
      sender,
      intent.recipient,
      cleanverseConfig.chain,
    );
  }

  private async handleHold(
    intent: SpendIntent,
    recorder: CreRunRecorder,
    reason: string,
    policyId?: string,
    access?: OwsResolvedAccess | null,
  ): Promise<ExecutionResult> {
    const amountIsPositiveInteger = /^\d+$/.test(intent.amount) && BigInt(intent.amount) > 0n;
    await this.addSpendAttributionArtifact(recorder, intent, {
      status: 'held',
      allocatedAmount: amountIsPositiveInteger ? intent.amount : '0',
      consumedAmount: '0',
      policyId,
      outcome: reason,
    });
    await recorder.addArtifact({
      type: 'error',
      data: {
        intentId: intent.id,
        status: 'held',
        reason,
        policyId,
        walletId: access?.wallet.id,
        walletAddress: access?.wallet.accounts[0]?.address,
        apiKeyId: access?.apiKey?.id,
      },
    });

    await recorder.pauseForApproval(reason, 'wallet_sign_and_broadcast', {
      intentId: intent.id,
      policyId,
    });
    const run = await this.persistRun(recorder);

    return {
      intentId: intent.id,
      runId: run.runId,
      status: 'held',
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
    checks: AgentAction['policyChecks'],
    policyId?: string,
    access?: OwsResolvedAccess | null,
  ): Promise<ExecutionResult> {
    await this.addSpendAttributionArtifact(recorder, intent, {
      status: 'denied',
      allocatedAmount: '0',
      consumedAmount: '0',
      policyId,
      outcome: reason,
    });
    await recorder.addArtifact({
      type: 'error',
      data: {
        intentId: intent.id,
        status: 'denied',
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
      status: 'denied',
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
      layer: 'SpendOS',
      status: vaultStatus.walletCount > 0 ? 'active' : 'unconfigured',
      provider: vaultStatus.provider,
      walletConnected: vaultStatus.walletCount > 0,
      walletAddress: vaultStatus.wallets[0]?.accounts[0]?.address || null,
      walletId: vaultStatus.wallets[0]?.id || null,
      apiKeyCount: vaultStatus.apiKeyCount,
      activePolicyId: activePolicy?.id || null,
      activePolicyName: activePolicy?.name || null,
      keeperHub: {
        enabled: keeperHubConfig.enabled,
      },
      cleanverse: {
        enabled: cleanverseConfig.enabled,
        chain: cleanverseConfig.chain,
        monadChainId: cleanverseConfig.monadChainId,
        aTokenAddress: cleanverseConfig.aTokenAddress,
        aTokenSymbol: cleanverseConfig.aTokenSymbol,
        gateAllSpends: cleanverseConfig.gateAllSpends,
      },
      features: [
        'encrypted-local-wallet-storage',
        'delegated-api-keys',
        'pre-sign-policies',
        'held-action-review',
        'scoped-access',
        'run-ledger-persistence',
        ...(cleanverseConfig.enabled ? ['cleanverse-cvi-cva'] : []),
      ],
    };
  }

  public async previewSpend(
    intent: SpendIntent,
    context: SpendExecutionContext = {},
  ): Promise<{
    intentId: string;
    status: 'approved' | 'denied' | 'held';
    policyId?: string;
    reason?: string;
    simulation: {
      wouldExecute: boolean;
      gasEstimate?: string;
      warnings: string[];
    };
    cleanverse?: {
      screened: boolean;
      ok?: boolean;
      policySignals?: ReturnType<typeof deriveCleanversePolicySignals>;
    };
  }> {
    const access = await this.resolveAccess(intent, {
      apiKeyToken: context.apiKeyToken || (intent.metadata?.apiKeyToken as string | undefined),
      walletId: context.walletId,
    });

    const sourceAuthorization = sourceAwareSpendAuthorizationService.evaluate({
      agentId: intent.agentId,
      recipient: intent.recipient,
      amount: intent.amount,
      asset: intent.asset,
      reason: intent.reason,
      provenance: intent.metadata?.sourceProvenance as SpendSourceProvenance | undefined,
      token: context.sourceAuthorizationToken,
    });
    if (!sourceAuthorization.authorized) {
      return {
        intentId: intent.id,
        status: 'held',
        reason: sourceAuthorization.reason,
        simulation: {
          wouldExecute: false,
          warnings: [sourceAuthorization.reason || 'Source-aware authorization is required.'],
        },
      };
    }

    const mandateEnforcement = this.enforceMandateSettlement(intent, access, context);
    if (mandateEnforcement?.denyReason) {
      return {
        intentId: intent.id,
        status: 'denied',
        reason: mandateEnforcement.denyReason,
        simulation: { wouldExecute: false, warnings: [mandateEnforcement.denyReason] },
      };
    }
    if (mandateEnforcement?.forceCleanverseIdentity) {
      intent.metadata = {
        ...(intent.metadata || {}),
        requireCleanverseIdentity: true,
      };
    }
    if (mandateEnforcement?.normalizedAsset) {
      intent.asset = mandateEnforcement.normalizedAsset;
    }

    const mandate = this.resolveMandate(intent, context);
    if (
      mandate?.settlement?.requireVerifiedSettlement &&
      (access?.wallet.metadata?.executionProvider as string) !== 'cleanverse'
    ) {
      const reason =
        'Mandate requires Cleanverse verified settlement (executionProvider=cleanverse)';
      return {
        intentId: intent.id,
        status: 'denied',
        reason,
        simulation: { wouldExecute: false, warnings: [reason] },
      };
    }

    let cleanverseMeta:
      | {
          screened: boolean;
          ok?: boolean;
          policySignals?: ReturnType<typeof deriveCleanversePolicySignals>;
        }
      | undefined;
    const cleanverseScreening = await this.screenCleanverseIdentity(intent, access);
    if (cleanverseScreening) {
      const policySignals = cleanverseScreening.ok
        ? deriveCleanversePolicySignals(cleanverseScreening)
        : undefined;
      intent.metadata = {
        ...(intent.metadata || {}),
        cleanverseIdentity: cleanverseScreening,
        ...(policySignals
          ? {
              cleanverse: {
                ...policySignals,
                sender: summarizeAPass(cleanverseScreening.sender.aPass),
                recipient: summarizeAPass(cleanverseScreening.recipient.aPass),
              },
            }
          : {}),
      };
      cleanverseMeta = {
        screened: true,
        ok: cleanverseScreening.ok,
        policySignals,
      };
      if (!cleanverseScreening.ok) {
        return {
          intentId: intent.id,
          status: 'denied',
          reason: cleanverseScreening.reason || 'Cleanverse CVI (A-Pass) screening failed',
          simulation: {
            wouldExecute: false,
            warnings: [cleanverseScreening.reason || 'CVI screening failed'],
          },
          cleanverse: cleanverseMeta,
        };
      }
    }

    const activePolicy = await this.policyEvaluator.resolveActiveSpendPolicy(
      this.policyService,
      access?.apiKey?.policyIds?.[0] ||
        (typeof intent.metadata?.policyId === 'string' ? intent.metadata.policyId : undefined),
    );

    if (!activePolicy) {
      return {
        intentId: intent.id,
        status: 'held',
        reason: 'No active spend policy available',
        simulation: {
          wouldExecute: false,
          warnings: ['No policy configured - spend would be held for review'],
        },
        cleanverse: cleanverseMeta,
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
          typeof intent.metadata?.encryptedAmount === 'string'
            ? intent.metadata.encryptedAmount
            : undefined,
        vendorHash:
          typeof intent.metadata?.vendorHash === 'string' ? intent.metadata.vendorHash : undefined,
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
        wouldExecute: policyResult.status === 'approved',
        gasEstimate: policyResult.status === 'approved' ? '21000' : undefined,
        warnings: evaluated.policyChecks
          .filter((c) => !c.result)
          .map((c) => c.reason || `Policy check failed`),
      },
      cleanverse: cleanverseMeta,
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
      const errMsg = error instanceof Error ? error.message : 'DeFi execution failed';
      logger.error(`DeFi action failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  private async resolveAccess(intent: SpendIntent, context: SpendExecutionContext) {
    return owsLocalVaultService.resolveAccess({
      walletId:
        context.walletId ||
        (typeof intent.metadata?.walletId === 'string' ? intent.metadata.walletId : undefined),
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
