import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { enrichCreRunEvidence } from '@backend/shared/utils/evidence.js';
import { z } from 'zod';
import { runForecastingWorkflow } from '@backend/cre/workflows/forecasting.js';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import { creLedgerChain, hashRun } from '@backend/cre/persistence/CreLedgerChain.js';
import { CreRun } from '@backend/cre/types.js';
import { translateCreEventToAgUi } from '@backend/cre/agUiTranslation.js';
import { WorkspaceDataService } from '@backend/services/WorkspaceDataService.js';
import { owsWalletService } from '@backend/services/blockchain/OwsWalletService.js';
import { keeperHubExecutionProvider } from '@backend/services/blockchain/KeeperHubExecutionProvider.js';
import { zeroGStorageService } from '@backend/services/blockchain/ZeroGStorageService.js';
import { filecoinStorageService } from '@backend/services/blockchain/FilecoinStorageService.js';
import { blockchainConfig } from '@backend/shared/config/index.js';
import {
  buildSpendAttributionReport,
  getRunSpendAttribution,
} from '@backend/services/governance/SpendAttributionService.js';
import { FundedMandateService } from '@backend/services/governance/FundedMandateService.js';
import {
  IdempotencyRecord,
  idempotencyStore,
} from '@backend/modules/api/storage/IdempotencyStore.js';

const triggerForecastSchema = z.object({
  writeAttestation: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

const retryRunSchema = z.object({
  writeAttestation: z.boolean().optional(),
  fromStep: z.number().int().min(0).max(1000).optional(),
});

const submitApprovalSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(500).optional(),
});

const updatePlanSchema = z.object({
  plan: z.object({
    version: z.number().int().positive(),
    summary: z.string().max(500).optional(),
    steps: z.array(
      z.object({
        id: z.string().min(1).max(120),
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        enabled: z.boolean(),
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      }),
    ),
  }),
});

// Helper to get a signer for CRE evidence
function getCreSigner(): ethers.Signer | undefined {
  const pk = process.env.FILECOIN_PRIVATE_KEY;
  if (!pk) return undefined;
  return new ethers.Wallet(pk);
}

// Helper to sign an event during manual transitions (cancel, approve, etc)
async function signManualEvent(runId: string, data: any) {
  const signer = getCreSigner();
  if (!signer) return undefined;
  const json = JSON.stringify(data);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(json));
  const signature = await signer.signMessage(hash);
  const signerAddress = await signer.getAddress();
  return { hash, signature, signer: signerAddress };
}

function estimateTokenAndCost(stepCount: number, artifactCount: number) {
  const estimatedTokens = stepCount * 180 + artifactCount * 60;
  const estimatedCostUsd = Number((estimatedTokens * 0.0000025).toFixed(6));
  return { estimatedTokens, estimatedCostUsd };
}

function hasExecutionUncertainty(run: CreRun): boolean {
  return run.artifacts.some(
    (artifact) =>
      artifact.type === 'error' &&
      (artifact.data as { status?: string }).status === 'execution_uncertain',
  );
}

function normalizeRun(run: CreRun): CreRun {
  const status = run.status || (run.finishedAt ? (run.ok ? 'completed' : 'failed') : 'running');
  const retryCount = run.retryCount ?? 0;
  const approvalState = run.approvalState || 'not_required';
  const stepCount = run.steps.length;
  const artifactCount = run.artifacts.length;
  const latencyMs =
    run.metrics?.latencyMs ??
    (run.finishedAt
      ? Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
      : undefined);
  const estimate = estimateTokenAndCost(stepCount, artifactCount);
  const executionUncertain = hasExecutionUncertainty(run);
  const defaultPlan = {
    version: 1,
    updatedAt: new Date().toISOString(),
    summary: 'Execution plan generated from workflow steps.',
    steps: run.steps.map((step, idx) => ({
      id: `plan-${idx + 1}`,
      title: step.name,
      description: step.summary || `${step.kind} step`,
      enabled: true,
      status: step.ok ? ('approved' as const) : ('pending' as const),
    })),
  };

  return enrichCreRunEvidence({
    ...run,
    status,
    retryCount,
    approvalState,
    plan: run.plan || defaultPlan,
    controls: {
      canCancel: !executionUncertain && (status === 'running' || status === 'queued'),
      canRetry:
        !executionUncertain &&
        (status === 'failed' || status === 'cancelled' || status === 'completed'),
      canApprove: !executionUncertain && (status === 'paused_for_approval' || run.requiresApproval === true),
    },
    metrics: {
      latencyMs,
      stepCount,
      artifactCount,
      estimatedTokens: run.metrics?.estimatedTokens ?? estimate.estimatedTokens,
      estimatedCostUsd: run.metrics?.estimatedCostUsd ?? estimate.estimatedCostUsd,
    },
    provenance: {
      source: run.provenance?.source || 'cognivern',
      workflowVersion: run.provenance?.workflowVersion || 'v1',
      model: run.provenance?.model || 'unknown',
      citations: run.provenance?.citations || [],
    },
    events: run.events || [],
  });
}

async function pushRunEvent(
  run: CreRun,
  event: {
    type:
      | 'run_cancel_requested'
      | 'run_cancelled'
      | 'run_retry_requested'
      | 'run_paused_for_approval'
      | 'run_finished'
      | 'run_failed';
    payload?: Record<string, unknown>;
    stepName?: string;
  },
) {
  const events = run.events || [];
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const eventData = {
    id: eventId,
    runId: run.runId,
    type: event.type,
    timestamp,
    payload: event.payload,
  };

  const evidence = await signManualEvent(run.runId, eventData);

  events.push({
    ...eventData,
    stepName: event.stepName,
    evidence,
  });

  const enriched = enrichCreRunEvidence({
    ...run,
    events,
  });
  run.events = enriched.events;
  run.artifacts = enriched.artifacts;
  run.evidence = enriched.evidence;
}

export class CreController {
  private static readonly IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

  private makeIdempotencyKey(req: Request, scope: string): string | null {
    const rawHeader = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');
    if (!rawHeader) return null;
    const header = rawHeader.trim().slice(0, 120);
    if (!header) return null;
    return `${scope}:${header}`;
  }

  private async cleanupIdempotencyStore() {
    // BaseStore now handles TTL cleanup automatically via cleanupExpired()
    await idempotencyStore.cleanupExpired();
  }

  private async getCachedIdempotentResponse(key: string): Promise<IdempotencyRecord | null> {
    return await idempotencyStore.getRecord(key);
  }

  private async setCachedIdempotentResponse(
    key: string,
    statusCode: number,
    body: Record<string, unknown>,
  ) {
    await idempotencyStore.setRecord(key, {
      statusCode,
      body,
      createdAtMs: Date.now(),
    });
  }

  /**
   * Verify that a run belongs to the requesting workspace. Returns the run
   * if it passes, or sends a 404 and returns null. Using 404 (not 403) to
   * avoid disclosing the existence of foreign runs.
   */
  private async verifyRunOwnership(
    req: Request,
    res: Response,
    runId: string,
  ): Promise<import('@backend/cre/types.js').CreRun | null> {
    if (!req.workspaceId) {
      res.status(401).json({ success: false, error: 'Workspace authentication required' });
      return null;
    }
    const run = await creRunStore.get(runId);
    if (!run || run.projectId !== req.workspaceId) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return null;
    }
    return run;
  }

  private async verifyLocalTransfer(
    transactionHash: string,
    expectedSender?: string,
    expectedRecipient?: string,
    expectedValueWei?: string,
    expectedChainId?: number,
  ): Promise<{ matched: boolean; reason?: string; chainId?: number; from?: string; to?: string; valueWei?: string; receiptStatus?: string; blockNumber?: number }> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return { matched: false, reason: 'Local transfer hash is malformed' };
    try {
      const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      const receipt = await provider.waitForTransaction(transactionHash, 1, 10_000);
      if (!receipt) return { matched: false, reason: 'No local receipt was available' };
      const transaction = await provider.getTransaction(transactionHash);
      const network = await provider.getNetwork();
      const actualChainId = Number(network.chainId);
      const expectedChainIdValue = expectedChainId ?? blockchainConfig.chainId;
      const matched =
        actualChainId === expectedChainIdValue &&
        receipt.status === 1 &&
        Boolean(transaction?.from && expectedSender && transaction.from.toLowerCase() === expectedSender.toLowerCase()) &&
        Boolean(transaction?.to && expectedRecipient && transaction.to.toLowerCase() === expectedRecipient.toLowerCase()) &&
        Boolean(transaction && expectedValueWei && transaction.value === BigInt(expectedValueWei));
      return {
        matched,
        reason: matched ? undefined : 'Local receipt did not match the expected chain, status, recipient, or value',
        chainId: actualChainId,
        from: transaction?.from ?? undefined,
        to: transaction?.to ?? undefined,
        valueWei: transaction?.value.toString(),
        receiptStatus: receipt.status === 1 ? 'success' : 'reverted',
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      return { matched: false, reason: `Local receipt verification failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async resolveSpendLifecycle(params: {
    run: CreRun;
    intentId: string;
    resolvedAt: string;
    transactionHash?: string;
    transactionLink?: string;
    executionId?: string;
  }): Promise<CreRun | undefined> {
    const runs = await creRunStore.list();
    const candidates = runs.filter((candidate) => {
      if (candidate.projectId !== params.run.projectId) return false;
      const attribution = getRunSpendAttribution(candidate);
      if (attribution?.workspaceId && attribution.workspaceId !== params.run.projectId) return false;
      const intentArtifact = candidate.artifacts.find((artifact) => artifact.type === 'spend_intent');
      const candidateIntentId =
        typeof intentArtifact?.data === 'object' && intentArtifact.data !== null
          ? (intentArtifact.data as { id?: unknown }).id
          : undefined;
      return candidateIntentId === params.intentId;
    });

    // A spend intent may be retried, but an intent id is not a license to
    // resolve every historical run that happens to reuse it. Follow only the
    // explicit parent/child retry chain containing the requesting run.
    const lifecycleIds = new Set<string>([params.run.runId]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const candidate of candidates) {
        if (
          (candidate.parentRunId && lifecycleIds.has(candidate.parentRunId)) ||
          [...lifecycleIds].some((runId) => runId === candidate.runId && candidate.parentRunId)
        ) {
          if (!lifecycleIds.has(candidate.runId)) {
            lifecycleIds.add(candidate.runId);
            expanded = true;
          }
          if (candidate.parentRunId && !lifecycleIds.has(candidate.parentRunId)) {
            lifecycleIds.add(candidate.parentRunId);
            expanded = true;
          }
        }
      }
    }

    const resolved: CreRun[] = [];
    for (const candidate of candidates) {
      if (!lifecycleIds.has(candidate.runId)) continue;
      const next = normalizeRun(candidate);
      for (const artifact of next.artifacts) {
        if (artifact.type === 'error' && typeof artifact.data === 'object' && artifact.data !== null) {
          const data = artifact.data as Record<string, unknown>;
          if (data.status === 'execution_uncertain') {
            artifact.data = { ...data, status: 'execution_reconciled', recoveryRequired: false, resolvedAt: params.resolvedAt };
          }
        }
        if (artifact.type === 'capital_attribution' && typeof artifact.data === 'object' && artifact.data !== null) {
          const data = artifact.data as Record<string, unknown>;
          artifact.data = { ...data, status: 'consumed', consumedAmount: data.allocatedAmount, ...(params.executionId ? { executionId: params.executionId } : {}), ...(params.transactionHash ? { transactionHash: params.transactionHash } : {}), ...(params.transactionLink ? { transactionLink: params.transactionLink } : {}), outcome: 'value_transfer_reconciled', recordedAt: params.resolvedAt };
        }
      }
      next.status = 'completed';
      next.ok = true;
      next.finishedAt = params.resolvedAt;
      next.requiresApproval = false;
      next.approvalState = 'approved';
      resolved.push(normalizeRun(next));
    }
    const requesting = resolved.find((candidate) => candidate.runId === params.run.runId);
    if (!requesting) return undefined;
    await Promise.all(resolved.map((candidate) => creRunStore.replace(candidate)));
    return requesting;
  }

  async getSpendAttribution(req: Request, res: Response) {
    try {
      if (!req.userId || !req.workspaceId) {
        res.status(403).json({ success: false, error: 'Operator authentication and workspace context are required.' });
        return;
      }
      const mandateId = typeof req.query.mandateId === 'string' ? req.query.mandateId.trim() : undefined;
      if (mandateId && !FundedMandateService.get(req.workspaceId, mandateId)) {
        res.status(404).json({ success: false, error: 'Mandate not found' });
        return;
      }
      const runs = await creRunStore.list();
      const workspaceRuns = runs.filter((run) => {
        if (run.projectId !== req.workspaceId) return false;
        const attribution = getRunSpendAttribution(run);
        return attribution?.workspaceId === req.workspaceId;
      });
      res.json({ success: true, data: buildSpendAttributionReport(workspaceRuns, mandateId), timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to build spend attribution report' });
    }
  }

  async listRuns(req: Request, res: Response) {
    try {
      if (!req.workspaceId) {
        res.status(401).json({
          success: false,
          error: 'Workspace authentication is required to list runs.',
        });
        return;
      }
      const projectId = req.workspaceId;
      const runs = await WorkspaceDataService.getRuns(projectId);
      res.json({
        success: true,
        projectId,
        runs,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to list runs' });
    }
  }

  /**
   * Verify the append-only mutation ledger and cross-check the run store
   * against it. A run whose current content hash differs from the last
   * chained mutation was edited outside the store — i.e. tampered.
   */
  async verifyLedger(req: Request, res: Response) {
    try {
      const chain = await creLedgerChain.verify();
      const latestHashes = await creLedgerChain.latestRunHashes();
      const runs = await creRunStore.list();

      const tamperedRuns: string[] = [];
      const unchainedRuns: string[] = [];
      for (const run of runs) {
        const chained = latestHashes.get(run.runId);
        if (!chained) {
          // Predates the ledger (or was written outside the store).
          unchainedRuns.push(run.runId);
        } else if (chained !== hashRun(run)) {
          tamperedRuns.push(run.runId);
        }
      }

      // Opt-in deep pass: turn the storage anchors from self-reported claims
      // into checked proofs by re-fetching the anchored record and comparing
      // hashes. This makes live network calls to the 0G indexer and the
      // Filecoin RPC, so it is off by default. A network miss is reported as
      // "unavailable"/"skipped" and never counts as tampering — only a real
      // content "mismatch" fails the ledger.
      const deep = req.query.deep === 'true' || req.query.deep === '1';
      let anchors:
        | Array<{
            runId: string;
            zeroG?: string;
            filecoin?: string;
          }>
        | undefined;
      let anchorSummary:
        | {
            checked: number;
            verified: number;
            mismatch: number;
            unavailable: number;
            skipped: number;
          }
        | undefined;
      let anchorMismatch = false;

      if (deep) {
        anchors = [];
        const summary = {
          checked: 0,
          verified: 0,
          mismatch: 0,
          unavailable: 0,
          skipped: 0,
        };

        const tally = (status: string) => {
          if (status === 'verified') summary.verified += 1;
          else if (status === 'mismatch') {
            summary.mismatch += 1;
            anchorMismatch = true;
          } else if (status === 'unavailable' || status === 'disabled') summary.unavailable += 1;
          else summary.skipped += 1;
        };

        for (const run of runs) {
          const ev = run.evidence;
          if (!ev) continue;
          const entry: { runId: string; zeroG?: string; filecoin?: string } = {
            runId: run.runId,
          };

          if (ev.zeroGRootHash) {
            if (ev.zeroGLocalHash) {
              const r = await zeroGStorageService.verifyDetailed(
                ev.zeroGRootHash,
                ev.zeroGLocalHash,
              );
              entry.zeroG = r.status;
            } else {
              // Anchored before we persisted the expected hash — can't verify.
              entry.zeroG = 'no_expected_hash';
            }
            summary.checked += 1;
            tally(entry.zeroG);
          }

          if (ev.filecoinCid) {
            if (ev.filecoinActionId) {
              const expected = ev.filecoinCid.replace(/^sha256:/, '');
              const r = await filecoinStorageService.verifyDetailed(ev.filecoinActionId, expected);
              entry.filecoin = r.status;
            } else {
              // Anchored before we persisted the retrieval key — can't verify.
              entry.filecoin = 'no_retrieval_key';
            }
            summary.checked += 1;
            tally(entry.filecoin);
          }

          if (entry.zeroG || entry.filecoin) anchors.push(entry);
        }

        anchorSummary = summary;
      }

      res.json({
        success: true,
        chain,
        store: {
          runs: runs.length,
          tamperedRuns,
          unchainedRuns,
        },
        ...(deep ? { anchors, anchorSummary } : {}),
        valid: chain.valid && tamperedRuns.length === 0 && !anchorMismatch,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to verify ledger' });
    }
  }

  async getRun(req: Request, res: Response) {
    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      const normalized = normalizeRun(run);
      normalized.events = (normalized.events || []).map(translateCreEventToAgUi);
      const detailData = {
        id: normalized.runId,
        workflow: normalized.workflow,
        status: normalized.status,
        mode: normalized.mode,
        steps: normalized.steps.length,
        duration:
          normalized.metrics?.latencyMs !== undefined ? `${normalized.metrics.latencyMs}ms` : '--',
        artifacts: normalized.artifacts.length,
        timestamp: normalized.startedAt,
        events: normalized.events,
        evidence: normalized.evidence?.traceId
          ? { traceId: normalized.evidence.traceId }
          : undefined,
        // The shared Run type exposes an artifact count for list rendering.
        // Keep full artifacts on this detail-only field for approval context.
        artifactData: normalized.artifacts,
      };
      // `run` is retained for existing callers; `data` makes this endpoint
      // conform to the shared API response shape used by the frontend client.
      res.json({ success: true, data: detailData, run: normalized });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to get run' });
    }
  }

  async reconcileRun(req: Request, res: Response) {
    try {
      if (!req.userId || !req.workspaceId) {
        res.status(403).json({
          success: false,
          error: 'Operator authentication and workspace context are required.',
        });
        return;
      }

      const reconciliationIdemKey =
        req.method === 'POST'
          ? this.makeIdempotencyKey(req, `cre:reconcileRun:${req.params.runId}`)
          : null;
      if (reconciliationIdemKey) {
        const cached = await this.getCachedIdempotentResponse(reconciliationIdemKey);
        if (cached) {
          res.status(cached.statusCode).json(cached.body);
          return;
        }
      }

      const run = await creRunStore.get(req.params.runId);
      if (!run) {
        res.status(404).json({ success: false, error: 'Run not found' });
        return;
      }

      if (run.projectId !== req.workspaceId) {
        res.status(403).json({ success: false, error: 'Run does not belong to this workspace' });
        return;
      }

      if (run.status === 'completed' && run.ok === true) {
        const responseBody = {
          success: true,
          statusFetched: false,
          run: normalizeRun(run),
          execution: null,
          matched: true,
          readOnly: true,
          recoveryRequired: false,
          resolved: true,
        };
        if (reconciliationIdemKey) {
          await this.setCachedIdempotentResponse(
            reconciliationIdemKey,
            200,
            responseBody as unknown as Record<string, unknown>,
          );
        }
        res.json(responseBody);
        return;
      }

      const uncertainArtifact = run.artifacts.find(
        (artifact) =>
          artifact.type === 'error' &&
          (artifact.data as { status?: string }).status === 'execution_uncertain',
      );
      if (!uncertainArtifact) {
        res.status(409).json({
          success: false,
          error: 'Run does not require execution reconciliation',
        });
        return;
      }

      if (run.workflow !== 'spend') {
        res.status(409).json({
          success: false,
          error: 'Only spend runs can require execution reconciliation',
        });
        return;
      }
      if (!run.projectId) {
        res.status(403).json({ success: false, error: 'Run does not belong to this workspace' });
        return;
      }

      const data = uncertainArtifact.data as {
        transferExecutionId?: string;
        transferIdempotencyKey?: string;
        expectedSender?: string;
        transferTxHash?: string;
        expectedRecipient?: string;
        expectedValueWei?: string;
        chainId?: number;
        status?: string;
        recoveryRequired?: boolean;
      };
      if (!data.transferExecutionId && data.transferTxHash) {
        const local = await this.verifyLocalTransfer(data.transferTxHash, data.expectedSender, data.expectedRecipient, data.expectedValueWei, data.chainId);
        if (local.matched && req.method === 'POST') {
          const spendIntentArtifact = run.artifacts.find((artifact) => artifact.type === 'spend_intent');
          const spendIntentId =
            typeof spendIntentArtifact?.data === 'object' && spendIntentArtifact.data !== null
              ? (spendIntentArtifact.data as { id?: unknown }).id
              : undefined;
          if (typeof spendIntentId !== 'string' || !spendIntentId) {
            res.status(409).json({ success: false, error: 'Cannot reconcile a spend run without a valid spend intent id', recoveryRequired: true });
            return;
          }
          const resolvedAt = new Date().toISOString();
          const resolvedRun = await this.resolveSpendLifecycle({
            run,
            intentId: spendIntentId,
            resolvedAt,
            transactionHash: data.transferTxHash,
          });
          if (!resolvedRun) {
            res.status(500).json({ success: false, error: 'Reconciliation could not persist the requesting lifecycle', recoveryRequired: true });
            return;
          }
          const responseBody = {
            success: true,
            statusFetched: true,
            run: resolvedRun,
            execution: local,
            matched: true,
            readOnly: false,
            recoveryRequired: false,
            resolved: true,
          };
          if (reconciliationIdemKey) {
            await this.setCachedIdempotentResponse(
              reconciliationIdemKey,
              200,
              responseBody as unknown as Record<string, unknown>,
            );
          }
          res.json(responseBody);
          return;
        }
        res.json({ success: false, run: normalizeRun(run), execution: local, readOnly: true, recoveryRequired: true, message: local.reason || 'Local transfer still requires receipt reconciliation' });
        return;
      }

      if (!data.transferExecutionId) {
        res.json({ success: false, run: normalizeRun(run), execution: null, idempotencyKey: data.transferIdempotencyKey, readOnly: true, recoveryRequired: true, message: 'No execution id or transaction hash was returned. Preserve the idempotency key and reconcile through the provider or support before retrying.' });
        return;
      }

      const execution = await keeperHubExecutionProvider.getExecutionStatus(
        data.transferExecutionId,
      );
      const executionData =
        'error' in execution || execution.executionId !== data.transferExecutionId
          ? undefined
          : execution;
      const expectedChainId = data.chainId;
      const expectedSender = data.expectedSender?.toLowerCase();
      const transactionHash = executionData?.transactionHash;
      const receipt = executionData?.receipts?.find(
        (candidate) =>
          typeof candidate.hash === 'string' &&
          typeof transactionHash === 'string' &&
          candidate.hash.toLowerCase() === transactionHash.toLowerCase(),
      );
      let valueMatches = false;
      if (receipt?.value !== undefined && data.expectedValueWei !== undefined) {
        try {
          // KeeperHub receipt values are ETH-denominated strings; compare the
          // canonical wei values so equivalent formats ("1", "1.0", or a
          // precise decimal) cannot produce a false mismatch.
          valueMatches = ethers.parseEther(receipt.value) === BigInt(data.expectedValueWei);
        } catch {
          valueMatches = false;
        }
      }
      const receiptFrom = receipt?.from?.toLowerCase() || executionData?.from?.toLowerCase();
      const senderMatches =
        executionData?.sponsored === true
          ? Boolean(receiptFrom && /^0x[0-9a-fA-F]{40}$/.test(receiptFrom))
          : Boolean(expectedSender && receiptFrom === expectedSender);
      const matched = Boolean(
        executionData &&
          receipt &&
          transactionHash &&
          /^0x[0-9a-fA-F]{64}$/.test(transactionHash) &&
          (executionData.status?.toLowerCase() === 'completed' ||
            executionData.status?.toLowerCase() === 'success') &&
          typeof expectedChainId === 'number' &&
          executionData.chainId === expectedChainId &&
          receipt.chainId === expectedChainId &&
          senderMatches &&
          receipt.to?.toLowerCase() === data.expectedRecipient?.toLowerCase() &&
          valueMatches &&
          receipt.verified === true &&
          receipt.receiptStatus?.toLowerCase() === 'success',
      );
      if (matched && req.method === 'POST') {
        const spendIntentArtifact = run.artifacts.find((artifact) => artifact.type === 'spend_intent');
        const spendIntentId = typeof spendIntentArtifact?.data === 'object' && spendIntentArtifact.data !== null ? (spendIntentArtifact.data as { id?: unknown }).id : undefined;
        if (typeof spendIntentId !== 'string' || !spendIntentId) {
          res.status(409).json({ success: false, error: 'Cannot reconcile a spend run without a valid spend intent id', recoveryRequired: true });
          return;
        }
        const resolvedAt = new Date().toISOString();
        uncertainArtifact.data = {
          ...(typeof uncertainArtifact.data === 'object' && uncertainArtifact.data !== null
            ? uncertainArtifact.data
            : {}),
          status: 'execution_reconciled',
          recoveryRequired: false,
          resolvedAt,
          resolvedBy: req.userId,
          resolvedExecutionId: executionData?.executionId,
          resolvedTransactionHash: transactionHash,
          resolvedSender: receiptFrom,
          resolvedRecipient: receipt?.to,
          resolvedValue: receipt?.value,
          resolvedChainId: receipt?.chainId,
          resolvedSponsored: executionData?.sponsored === true,
          resolvedVerified: receipt?.verified === true,
          resolvedReceiptStatus: receipt?.receiptStatus,
          resolvedReceipt: receipt,
        };
        run.status = 'completed';
        run.ok = true;
        run.finishedAt = resolvedAt;
        run.requiresApproval = false;
        run.approvalState = 'approved';
        await pushRunEvent(run, {
          type: 'run_finished',
          payload: {
            reason: 'execution_reconciled',
            executionId: executionData?.executionId,
            transactionHash,
          },
        });
        const resolvedWithAttribution = await this.resolveSpendLifecycle({
          run,
          intentId: spendIntentId,
          resolvedAt,
          executionId: executionData?.executionId,
          transactionHash,
          transactionLink: executionData?.transactionLink,
        });
        if (!resolvedWithAttribution) {
          res.status(500).json({ success: false, error: 'Reconciliation could not persist the requesting lifecycle', recoveryRequired: true });
          return;
        }
        const responseBody = {
          success: true,
          statusFetched: true,
          run: resolvedWithAttribution,
          execution,
          matched: true,
          readOnly: false,
          recoveryRequired: false,
          resolved: true,
        };
        if (reconciliationIdemKey) {
          await this.setCachedIdempotentResponse(
            reconciliationIdemKey,
            200,
            responseBody as unknown as Record<string, unknown>,
          );
        }
        res.json(responseBody);
        return;
      }

      res.json({
        // `success` means the reconciliation proves the requested transfer;
        // a reachable but pending/mismatched status is not a successful
        // reconciliation and must remain recovery-required.
        success: matched,
        statusFetched: !('error' in execution),
        run: normalizeRun(run),
        execution,
        matched,
        readOnly: true,
        recoveryRequired: !matched,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to reconcile run' });
    }
  }

  async getRunEvents(req: Request, res: Response) {
    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      const sinceParsed = req.query.since ? Number(req.query.since) : undefined;
      const since =
        typeof sinceParsed === 'number' && !Number.isNaN(sinceParsed) ? sinceParsed : undefined;
      const normalized = normalizeRun(run);
      const events = (normalized.events || [])
        .filter((event) => {
          if (!since) return true;
          return new Date(event.timestamp).getTime() > since;
        })
        .map(translateCreEventToAgUi);
      res.json({
        success: true,
        runId: run.runId,
        events,
        cursor: events.length
          ? new Date(events[events.length - 1].timestamp).getTime()
          : since || Date.now(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to get run events' });
    }
  }

  async streamRunEvents(req: Request, res: Response) {
    const runId = req.params.runId;
    const run = await this.verifyRunOwnership(req, res, runId);
    if (!run) return;

    const sinceParsed = req.query.since ? Number(req.query.since) : undefined;
    const lastEventIdHeader = req.header('Last-Event-ID');
    const lastEventIdParsed = lastEventIdHeader ? Number(lastEventIdHeader) : undefined;
    let cursor = 0;
    if (typeof lastEventIdParsed === 'number' && !Number.isNaN(lastEventIdParsed)) {
      cursor = lastEventIdParsed;
    } else if (typeof sinceParsed === 'number' && !Number.isNaN(sinceParsed)) {
      cursor = sinceParsed;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (eventName: string, payload: Record<string, unknown>, id?: string) => {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent('ready', { runId, cursor, timestamp: new Date().toISOString() });

    const sendNewEvents = async () => {
      const currentRun = await creRunStore.get(runId);
      if (!currentRun) {
        sendEvent('error', { message: 'Run not found' });
        return;
      }
      const normalized = normalizeRun(currentRun);
      const newEvents = (normalized.events || []).filter(
        (event) => new Date(event.timestamp).getTime() > cursor,
      );

      for (const event of newEvents) {
        const ts = new Date(event.timestamp).getTime();
        const eventIdForResume = Number.isNaN(ts) ? undefined : String(ts);
        sendEvent(
          'run_event',
          translateCreEventToAgUi(event) as unknown as Record<string, unknown>,
          eventIdForResume,
        );
        if (!Number.isNaN(ts)) {
          cursor = ts;
        }
      }

      if (!newEvents.length) {
        res.write(': heartbeat\n\n');
      }
    };

    // Send initial batch immediately.
    await sendNewEvents();

    const intervalId = setInterval(() => {
      void sendNewEvents();
    }, 2000);

    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
  }

  async triggerForecast(req: Request, res: Response) {
    if (!req.workspaceId) {
      res.status(401).json({
        success: false,
        error: 'Workspace authentication is required to trigger forecasts.',
      });
      return;
    }

    const parse = triggerForecastSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid trigger payload' });
      return;
    }
    const { writeAttestation = false, requireApproval = false } = parse.data;

    const idemKey = this.makeIdempotencyKey(req, 'cre:triggerForecast');
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    try {
      const run = await runForecastingWorkflow({
        mode: 'local',
        projectId: req.workspaceId,
        // If approval is required, hold before any attestation side effects.
        writeAttestation: requireApproval ? false : writeAttestation,
        arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
        signer: getCreSigner(),
      });

      const normalized = normalizeRun(run);
      if (requireApproval) {
        normalized.status = 'paused_for_approval';
        normalized.requiresApproval = true;
        normalized.approvalState = 'pending';
        normalized.ok = false;
        normalized.finishedAt = undefined;
        normalized.controls = {
          canCancel: true,
          canRetry: false,
          canApprove: true,
        };
        await pushRunEvent(normalized, {
          type: 'run_paused_for_approval',
          payload: {
            reason: 'manual_approval_required',
            pendingAction: writeAttestation ? 'attestation' : 'run_finalize',
          },
        });
      }
      const storedRun = normalizeRun(normalized);
      await creRunStore.add(storedRun);

      const responseBody = {
        success: storedRun.ok,
        runId: storedRun.runId,
        run: storedRun,
      };
      if (idemKey) {
        await this.setCachedIdempotentResponse(
          idemKey,
          200,
          responseBody as Record<string, unknown>,
        );
      }
      res.json(responseBody);
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to trigger forecast' });
    }
  }

  async cancelRun(req: Request, res: Response) {
    const idemKey = this.makeIdempotencyKey(req, `cre:cancelRun:${req.params.runId}`);
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      const normalized = normalizeRun(run);
      if (hasExecutionUncertainty(run)) {
        res.status(409).json({
          success: false,
          error: 'Run requires execution reconciliation before it can be cancelled',
          run: normalized,
        });
        return;
      }
      if (!(normalized.status === 'running' || normalized.status === 'queued')) {
        res.status(409).json({
          success: false,
          error: `Run cannot be cancelled from status '${normalized.status}'`,
        });
        return;
      }

      await pushRunEvent(normalized, {
        type: 'run_cancel_requested',
        payload: { requestedBy: 'user' },
      });
      normalized.status = 'cancelled';
      normalized.finishedAt = new Date().toISOString();
      normalized.ok = false;
      normalized.controls = {
        canCancel: false,
        canRetry: true,
        canApprove: false,
      };
      await pushRunEvent(normalized, {
        type: 'run_cancelled',
        payload: { source: 'api' },
      });

      const storedRun = normalizeRun(normalized);
      await creRunStore.replace(storedRun);
      const responseBody = { success: true, run: storedRun };
      if (idemKey) {
        await this.setCachedIdempotentResponse(
          idemKey,
          200,
          responseBody as Record<string, unknown>,
        );
      }
      res.json(responseBody);
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to cancel run' });
    }
  }

  async retryRun(req: Request, res: Response) {
    const parse = retryRunSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid retry payload' });
      return;
    }
    const { writeAttestation = false, fromStep = 0 } = parse.data;

    const idemKey = this.makeIdempotencyKey(req, `cre:retryRun:${req.params.runId}`);
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      if (hasExecutionUncertainty(run)) {
        res.status(409).json({
          success: false,
          error: 'Run requires execution reconciliation before it can be retried',
          run: normalizeRun(run),
        });
        return;
      }
      const original = normalizeRun(run);
      await pushRunEvent(original, {
        type: 'run_retry_requested',
        payload: { requestedBy: 'user' },
      });
      await creRunStore.replace(normalizeRun(original));

      const newRun = normalizeRun(
        await runForecastingWorkflow({
          mode: 'local',
          projectId: run.projectId ?? req.workspaceId ?? '',
          writeAttestation,
          arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
          signer: getCreSigner(),
        }),
      );
      newRun.parentRunId = original.runId;
      newRun.retryCount = (original.retryCount || 0) + 1;
      if (fromStep > 0) {
        newRun.provenance = {
          ...(newRun.provenance || { source: 'cognivern' }),
          citations: [
            ...((newRun.provenance?.citations || []) as Array<{
              label: string;
              value: string;
            }>),
            { label: 'retry_from_step', value: String(fromStep) },
          ],
        };
        await pushRunEvent(newRun, {
          type: 'run_retry_requested',
          payload: { retriedFromRunId: original.runId, fromStep },
        });
      }
      const storedRun = normalizeRun(newRun);
      await creRunStore.add(storedRun);
      const responseBody = {
        success: true,
        runId: newRun.runId,
        run: storedRun,
        retriedFrom: original.runId,
      };
      if (idemKey) {
        await this.setCachedIdempotentResponse(
          idemKey,
          200,
          responseBody as Record<string, unknown>,
        );
      }
      res.json(responseBody);
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to retry run' });
    }
  }

  async submitApproval(req: Request, res: Response) {
    const parse = submitApprovalSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid approval payload' });
      return;
    }
    const { approve, reason = '' } = parse.data;

    const idemKey = this.makeIdempotencyKey(req, `cre:submitApproval:${req.params.runId}`);
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      if (hasExecutionUncertainty(run)) {
        res.status(409).json({
          success: false,
          error: 'Run requires execution reconciliation before approval can change',
          run: normalizeRun(run),
        });
        return;
      }
      const normalized = normalizeRun(run);
      const safeReason = reason.trim().slice(0, 500);

      normalized.approvalState = approve ? 'approved' : 'rejected';
      normalized.approvalReason = safeReason || undefined;
      normalized.requiresApproval = false;

      // A held spend run carries real money: operator approval must actually
      // broadcast the native transfer (operator JWT substitutes for the scoped
      // key). If the broadcast fails we surface it as a failed run rather than
      // reporting a completed approval that moved nothing.
      if (
        approve &&
        normalized.status === 'paused_for_approval' &&
        normalized.workflow === 'spend'
      ) {
        // Per-resource auth check: spend approvals must come from an
        // authenticated operator (JWT → req.userId). The workspace middleware
        // also accepts x-api-key, but a workspace key alone is not sufficient
        // to release real funds — there is no operator identity to attribute
        // the action to in the audit trail. The endpoint is also no longer in
        // PUBLIC_API_PATHS, so unauthenticated callers are rejected before
        // reaching this point.
        if (!req.userId) {
          res.status(403).json({
            success: false,
            error: 'Operator authentication required. Sign in and retry.',
          });
          return;
        }
        const operatorId = req.userId;
        const transfer = await owsWalletService.resumeHeldSpend(req.params.runId, operatorId);
        if (transfer.transferStatus !== 'sent') {
          // A returned failure was rolled back to the held state. An uncertain
          // result is different: the provider execution may already have
          // moved funds, so never reopen it or offer a blind retry.
          const current = await creRunStore.get(req.params.runId);
          const currentRun = current ? normalizeRun(current) : normalized;
          if (transfer.transferStatus === 'uncertain') {
            res.status(409).json({
              success: false,
              error: transfer.transferError || transfer.error || 'Execution requires reconciliation',
              run: currentRun,
              transfer,
            });
            return;
          }

          await pushRunEvent(currentRun, {
            type: 'run_failed',
            payload: {
              reason: 'transfer_failed',
              note: transfer.transferError || transfer.error || null,
            },
          });
          const retryableRun = normalizeRun(currentRun);
          await creRunStore.replace(retryableRun);
          res.json({
            success: false,
            error: transfer.transferError || transfer.error || 'Native transfer failed',
            run: retryableRun,
            transfer,
          });
          return;
        }
        normalized.status = 'completed';
        normalized.ok = true;
        normalized.finishedAt = new Date().toISOString();
        if (normalized.plan) {
          normalized.plan.steps = normalized.plan.steps.map((step) => ({
            ...step,
            status: step.enabled ? 'approved' : 'rejected',
          }));
        }
        await pushRunEvent(normalized, {
          type: 'run_finished',
          payload: {
            reason: 'approval_granted',
            note: safeReason || null,
            transferTxHash: transfer.transferTxHash,
            transferExecutionId: transfer.transferExecutionId,
            transferChainId: transfer.transferChainId,
            transferFrom: transfer.transferFrom,
            transferTransactionLink: transfer.transferTransactionLink,
            transferSponsored: transfer.transferSponsored,
            transferVerified: transfer.transferVerified,
            transferReceiptStatus: transfer.transferReceiptStatus,
            transferReceipts: transfer.transferReceipts,
          },
        });

        normalized.controls = {
          canCancel: false,
          canRetry: false,
          canApprove: false,
        };
        const storedRun = normalizeRun(normalized);
        await creRunStore.replace(storedRun);
        const responseBody = { success: true, run: storedRun, transfer };
        if (idemKey) {
          await this.setCachedIdempotentResponse(
            idemKey,
            200,
            responseBody as unknown as Record<string, unknown>,
          );
        }
        res.json(responseBody);
        return;
      }

      if (approve && normalized.status === 'paused_for_approval') {
        normalized.status = 'completed';
        normalized.ok = true;
        normalized.finishedAt = new Date().toISOString();
        if (normalized.plan) {
          normalized.plan.steps = normalized.plan.steps.map((step) => ({
            ...step,
            status: step.enabled ? 'approved' : 'rejected',
          }));
        }
        await pushRunEvent(normalized, {
          type: 'run_finished',
          payload: {
            reason: 'approval_granted',
            note: safeReason || null,
          },
        });
      }
      if (!approve) {
        normalized.status = 'failed';
        normalized.ok = false;
        normalized.finishedAt = normalized.finishedAt || new Date().toISOString();
        if (normalized.plan) {
          normalized.plan.steps = normalized.plan.steps.map((step) => ({
            ...step,
            status: 'rejected',
          }));
        }
        await pushRunEvent(normalized, {
          type: 'run_failed',
          payload: { reason: 'approval_rejected', note: safeReason || null },
        });
      }

      normalized.controls = {
        canCancel: normalized.status === 'running',
        canRetry: normalized.status === 'failed' || normalized.status === 'cancelled',
        canApprove: false,
      };

      const storedRun = normalizeRun(normalized);
      await creRunStore.replace(storedRun);
      const responseBody = { success: true, run: storedRun };
      if (idemKey) {
        await this.setCachedIdempotentResponse(
          idemKey,
          200,
          responseBody as Record<string, unknown>,
        );
      }
      res.json(responseBody);
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to submit approval' });
    }
  }

  async updateRunPlan(req: Request, res: Response) {
    const parse = updatePlanSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid plan payload' });
      return;
    }
    const { plan } = parse.data;

    const idemKey = this.makeIdempotencyKey(req, `cre:updateRunPlan:${req.params.runId}`);
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    try {
      const run = await this.verifyRunOwnership(req, res, req.params.runId);
      if (!run) return;
      if (hasExecutionUncertainty(run)) {
        res.status(409).json({
          success: false,
          error: 'Run requires execution reconciliation before its plan can be changed',
          run: normalizeRun(run),
        });
        return;
      }
      const normalized = normalizeRun(run);

      normalized.plan = {
        version: plan.version,
        updatedAt: new Date().toISOString(),
        summary: plan.summary,
        steps: plan.steps.map((step) => ({
          id: step.id,
          title: step.title,
          description: step.description,
          enabled: step.enabled,
          status: step.status || 'pending',
        })),
      };

      if (normalized.status === 'running') {
        normalized.status = 'paused_for_approval';
        normalized.requiresApproval = true;
        normalized.approvalState = 'pending';
        normalized.controls = {
          canCancel: true,
          canRetry: false,
          canApprove: true,
        };
        await pushRunEvent(normalized, {
          type: 'run_paused_for_approval',
          payload: { reason: 'plan_updated_requires_approval' },
        });
      }

      const storedRun = normalizeRun(normalized);
      await creRunStore.replace(storedRun);
      const responseBody = { success: true, run: storedRun };
      if (idemKey) {
        await this.setCachedIdempotentResponse(
          idemKey,
          200,
          responseBody as Record<string, unknown>,
        );
      }
      res.json(responseBody);
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update run plan' });
    }
  }
}
