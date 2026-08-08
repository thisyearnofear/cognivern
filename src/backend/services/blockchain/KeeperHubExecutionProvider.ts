import { ethers } from 'ethers';
import { logger } from '@backend/shared/logging/Logger.js';
import { keeperHubConfig } from '@backend/shared/config/index.js';

export interface KeeperHubTransferRequest {
  intentId: string;
  /** Local provenance only. KeeperHub resolves the actual org wallet. */
  from: string;
  to: string;
  valueWei: bigint;
  chainId: number;
}

export interface KeeperHubReceipt {
  hash: string;
  chainId?: number;
  from?: string;
  to?: string;
  value?: string;
  verified?: boolean;
  receiptStatus?: string;
  blockNumber?: number;
  gasUsed?: string;
  verifiedAt?: string;
}

export interface KeeperHubSimulationResult {
  status: 'simulated';
  success: boolean;
  wouldRevert: boolean;
  from?: string;
  to?: string;
  value?: string;
  chainId?: number;
  gasEstimate?: string;
  simulatedReturnValue?: unknown;
  error?: string;
  code?: string;
  revertReason?: string;
}

export interface KeeperHubExecutionStatus {
  executionId: string;
  status?: string;
  transactionHash?: string;
  /** Legacy status responses may call this field txHash. */
  txHash?: string;
  transactionLink?: string;
  sponsored?: boolean;
  from?: string;
  to?: string;
  value?: string;
  chainId?: number;
  receipts?: KeeperHubReceipt[];
  verified?: boolean;
  receiptStatus?: string;
}

export interface KeeperHubTransferResult {
  /** Backwards-compatible alias for transactionHash. */
  txHash: string;
  transactionHash: string;
  transactionLink?: string;
  executionId: string;
  /** Actual sender reported by KeeperHub, when available. */
  from?: string;
  chainId: number;
  sponsored?: boolean;
  receipts?: KeeperHubReceipt[];
  verified?: boolean;
  receiptStatus?: string;
  /** The provider only returns a successful result after these checks pass. */
  recipientMatches: boolean;
  valueMatches: boolean;
  simulation: KeeperHubSimulationResult;
}

interface KeeperHubExecuteResponse {
  executionId?: string;
  status?: string;
  transactionHash?: string;
  /** Legacy/mock compatibility; real KeeperHub docs call this transactionHash. */
  txHash?: string;
  transactionLink?: string;
  error?: string;
}

interface KeeperHubParseError {
  parseError: string;
}

interface KeeperHubWalletResponse {
  walletAddress?: string;
  data?: {
    walletAddress?: string;
  };
}

interface KeeperHubStatusResponse extends KeeperHubExecuteResponse {
  executionId: string;
  sponsored?: boolean;
  from?: string;
  to?: string;
  value?: string;
  chainId?: number;
  receipts?: KeeperHubReceipt[];
  verified?: boolean;
  receiptStatus?: string;
}

type KeeperHubExecutionError = {
  error: string;
  /** Present when an execution was created but completion is uncertain. */
  executionId?: string;
  /** Deterministic key used to make a lost broadcast response safe to investigate. */
  idempotencyKey?: string;
  uncertain?: boolean;
};

export interface KeeperHubExecutionProviderOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/**
 * KeeperHub-backed execution provider.
 *
 * Uses KeeperHub's documented safe first-write sequence:
 * simulation (no signing/broadcast) → one idempotent broadcast → status
 * polling with the server's poll hint. KeeperHub resolves the organization
 * wallet; `from` is retained as local provenance and is never sent as a
 * sender-selection parameter.
 */
export class KeeperHubExecutionProvider {
  public readonly name = 'keeperhub';
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: KeeperHubExecutionProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  async getExecutionStatus(
    executionId: string,
  ): Promise<KeeperHubExecutionStatus | KeeperHubExecutionError> {
    if (!keeperHubConfig.apiKey) {
      return { error: 'KeeperHub API key is not configured' };
    }
    if (!executionId.trim()) {
      return { error: 'KeeperHub executionId is required' };
    }

    try {
      const res = await fetch(`${keeperHubConfig.baseUrl}/api/execute/${encodeURIComponent(executionId)}/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${keeperHubConfig.apiKey}` },
      });
      const data = await this.parseJson<KeeperHubExecutionStatus>(res);
      if ('parseError' in data) return { error: data.parseError, uncertain: true };
      if (!res.ok) {
        return { error: `KeeperHub status request failed (${res.status})`, uncertain: true };
      }
      if (data.executionId !== executionId) {
        return { error: 'KeeperHub status response executionId does not match the request', uncertain: true };
      }
      return {
        ...data,
        transactionHash: data.transactionHash || data.txHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `KeeperHub status request failed: ${message}`, uncertain: true };
    }
  }

  async executeTransfer(
    params: KeeperHubTransferRequest,
  ): Promise<KeeperHubTransferResult | KeeperHubExecutionError> {
    if (!keeperHubConfig.apiKey) {
      return { error: 'KeeperHub API key is not configured' };
    }

    const body = {
      chainId: params.chainId,
      recipientAddress: params.to,
      amount: ethers.formatEther(params.valueWei),
    };

    const walletCheck = await this.verifyConfiguredWallet(params.from);
    if ('error' in walletCheck) {
      return walletCheck;
    }

    const simulation = await this.simulateTransfer(body, params.from);
    if (!('status' in simulation)) {
      return simulation;
    }

    const execution = await this.requestExecution(body, params);
    if ('error' in execution) {
      return execution;
    }

    return this.pollForCompletion(execution.executionId, params, simulation);
  }

  private async simulateTransfer(
    body: Record<string, unknown>,
    expectedFrom: string,
  ): Promise<KeeperHubSimulationResult | KeeperHubExecutionError> {
    try {
      const res = await fetch(`${keeperHubConfig.baseUrl}/api/execute/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keeperHubConfig.apiKey}`,
        },
        body: JSON.stringify({ ...body, simulate: true }),
      });

      const data = await this.parseJson<KeeperHubSimulationResult>(res);
      if ('parseError' in data) return { error: data.parseError };

      if (!res.ok || data.success !== true || data.wouldRevert !== false) {
        return {
          error: `KeeperHub simulation rejected the transfer: ${data.revertReason || data.error || res.statusText || `HTTP ${res.status}`}`,
        };
      }

      const expectedTo = String(body.recipientAddress).toLowerCase();
      const returnedFrom = data.from?.toLowerCase();
      const returnedTo = data.to?.toLowerCase();
      const returnedValue = data.value;
      const expectedAmount = String(body.amount);
      if (returnedFrom && returnedFrom !== expectedFrom.toLowerCase()) {
        return { error: 'KeeperHub simulation sender does not match the configured wallet' };
      }
      if (returnedTo && returnedTo !== expectedTo) {
        return { error: 'KeeperHub simulation recipient does not match the requested recipient' };
      }
      if (returnedValue !== undefined && !this.sameTransferAmount(returnedValue, expectedAmount)) {
        return { error: 'KeeperHub simulation amount does not match the requested amount' };
      }
      if (data.chainId !== undefined && data.chainId !== Number(body.chainId)) {
        return { error: 'KeeperHub simulation chain does not match the requested chain' };
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `KeeperHub simulation request failed: ${message}` };
    }
  }

  private async requestExecution(
    body: Record<string, unknown>,
    params: KeeperHubTransferRequest,
  ): Promise<{ executionId: string } | KeeperHubExecutionError> {
    const idempotencyKey = this.buildIdempotencyKey(params, String(body.amount));

    try {
      const res = await fetch(`${keeperHubConfig.baseUrl}/api/execute/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keeperHubConfig.apiKey}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const data = await this.parseJson<KeeperHubExecuteResponse>(res);
      if ('parseError' in data) {
        return { error: data.parseError, idempotencyKey, uncertain: true };
      }

      if (!res.ok) {
        return {
          error: `KeeperHub execution request failed: ${data.error || res.statusText} (${res.status})`,
          idempotencyKey,
          uncertain: true,
        };
      }

      if (!data.executionId) {
        return {
          error: 'KeeperHub response missing executionId; execution status is uncertain',
          idempotencyKey,
          uncertain: true,
        };
      }

      logger.info(`KeeperHub execution created: ${data.executionId}`);
      return { executionId: data.executionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: `KeeperHub execution request failed; execution status is uncertain: ${message}`,
        idempotencyKey,
        uncertain: true,
      };
    }
  }

  private async pollForCompletion(
    executionId: string,
    params: KeeperHubTransferRequest,
    simulation: KeeperHubSimulationResult,
  ): Promise<KeeperHubTransferResult | KeeperHubExecutionError> {
    const start = Date.now();
    let nextDelayMs = this.pollIntervalMs;

    while (Date.now() - start < this.timeoutMs) {
      try {
        const res = await fetch(`${keeperHubConfig.baseUrl}/api/execute/${executionId}/status`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${keeperHubConfig.apiKey}`,
          },
        });

        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            await this.sleep(nextDelayMs);
            continue;
          }
          return {
            error: `KeeperHub status request failed (${res.status})`,
            executionId,
            uncertain: true,
          };
        }

        const statusData = await this.parseJson<KeeperHubStatusResponse>(res);
        if ('parseError' in statusData) {
          return { error: statusData.parseError, executionId, uncertain: true };
        }

        if (statusData.executionId !== executionId) {
          return {
            error: 'KeeperHub status response executionId does not match the request',
            executionId,
            uncertain: true,
          };
        }

        const status = statusData.status?.toLowerCase?.() ?? 'unknown';
        if (status === 'completed' || status === 'success') {
          const transactionHash = statusData.transactionHash || statusData.txHash;
          if (!transactionHash || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
            return {
              error: 'KeeperHub execution completed without a valid 32-byte transactionHash',
              executionId,
              uncertain: true,
            };
          }

          const receipts = statusData.receipts;
          const authoritativeReceipt = receipts?.find(
            (receipt) => receipt.hash.toLowerCase() === transactionHash.toLowerCase(),
          );
          if (!authoritativeReceipt) {
            return {
              error: 'KeeperHub execution completed without a matching authoritative receipt',
              executionId,
              uncertain: true,
            };
          }

          const receiptStatus = authoritativeReceipt.receiptStatus || statusData.receiptStatus;
          const verified = authoritativeReceipt.verified ?? statusData.verified;
          const receiptChainId = authoritativeReceipt.chainId ?? statusData.chainId;
          if (receiptChainId !== params.chainId) {
            return {
              error: 'KeeperHub receipt chain does not match the requested chain',
              executionId,
              uncertain: true,
            };
          }
          if (receiptStatus?.toLowerCase() !== 'success' || verified !== true) {
            return {
              error: 'KeeperHub receipt is not verified as successful',
              executionId,
              uncertain: true,
            };
          }

          const expectedAmount = ethers.formatEther(params.valueWei);
          const receiptFrom = authoritativeReceipt.from || statusData.from || simulation.from;
          const sponsored = statusData.sponsored === true;
          // For direct executions, the on-chain sender must be the configured
          // wallet. Sponsored executions may report KeeperHub's relayer as
          // receipt.from; the read-only wallet binding above remains the
          // provenance check, while KeeperHub's verified receipt is the
          // authority for the relayed transaction.
          if (!sponsored && (!receiptFrom || receiptFrom.toLowerCase() !== params.from.toLowerCase())) {
            return {
              error: 'KeeperHub receipt sender does not match the configured wallet',
              executionId,
              uncertain: true,
            };
          }
          if (receiptFrom && !/^0x[0-9a-fA-F]{40}$/.test(receiptFrom)) {
            return {
              error: 'KeeperHub receipt sender is not a valid address',
              executionId,
              uncertain: true,
            };
          }
          const receiptTo = authoritativeReceipt.to || statusData.to;
          if (!receiptTo || receiptTo.toLowerCase() !== params.to.toLowerCase()) {
            return {
              error: 'KeeperHub receipt recipient does not match the request',
              executionId,
              uncertain: true,
            };
          }
          const receiptValue = authoritativeReceipt.value ?? statusData.value;
          if (
            receiptValue === undefined ||
            !this.sameTransferAmount(receiptValue, expectedAmount)
          ) {
            return {
              error: 'KeeperHub receipt amount does not match the request',
              executionId,
              uncertain: true,
            };
          }

          logger.info(`KeeperHub execution completed: ${transactionHash}`);
          return {
            txHash: transactionHash,
            transactionHash,
            transactionLink: statusData.transactionLink,
            executionId,
            from: receiptFrom,
            chainId: params.chainId,
            sponsored: statusData.sponsored,
            receipts,
            verified: true,
            receiptStatus,
            recipientMatches: true,
            valueMatches: true,
            simulation,
          };
        }

        if (status === 'failed' || status === 'reverted') {
          return {
            error: `KeeperHub execution failed: ${statusData.error || status}`,
          };
        }

        const hintSeconds = Number(res.headers.get('X-Poll-Interval-Hint'));
        if (Number.isFinite(hintSeconds) && hintSeconds > 0) {
          // KeeperHub documents this header in seconds. Clamp it so a bad
          // server hint cannot create a request storm or stall the timeout.
          nextDelayMs = Math.min(Math.max(hintSeconds * 1_000, 100), 30_000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`KeeperHub status poll failed: ${message}`);
      }

      await this.sleep(nextDelayMs);
    }

    return {
      error: `KeeperHub execution ${executionId} did not complete within ${this.timeoutMs}ms`,
      executionId,
      uncertain: true,
    };
  }

  private async parseJson<T>(res: Response): Promise<T | KeeperHubParseError> {
    try {
      return (await res.json()) as T;
    } catch {
      return { parseError: `KeeperHub returned non-JSON response (status ${res.status})` };
    }
  }

  private async verifyConfiguredWallet(
    expectedAddress: string,
  ): Promise<{ ok: true } | { error: string }> {
    try {
      const res = await fetch(`${keeperHubConfig.baseUrl}/api/user/wallet`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${keeperHubConfig.apiKey}`,
        },
      });
      const data = await this.parseJson<KeeperHubWalletResponse>(res);
      if ('parseError' in data) return { error: data.parseError };
      if (!res.ok) return { error: `KeeperHub wallet check failed (${res.status})` };
      const walletAddress = data.walletAddress || data.data?.walletAddress;
      if (!walletAddress) return { error: 'KeeperHub wallet check returned no wallet address' };
      if (walletAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        return { error: 'KeeperHub API key wallet does not match the configured Cognivern wallet' };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `KeeperHub wallet check failed: ${message}` };
    }
  }

  private sameTransferAmount(actual: string, expectedEth: string): boolean {
    try {
      return ethers.parseEther(actual) === ethers.parseEther(expectedEth);
    } catch {
      return actual === expectedEth;
    }
  }

  private buildIdempotencyKey(params: KeeperHubTransferRequest, amount: string): string {
    const canonicalWork = [
      params.intentId.trim(),
      String(params.chainId),
      params.to.toLowerCase(),
      amount,
      '',
    ].join('|');
    return ethers.sha256(ethers.toUtf8Bytes(canonicalWork));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const keeperHubExecutionProvider = new KeeperHubExecutionProvider();
