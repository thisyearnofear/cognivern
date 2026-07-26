import { ethers } from "ethers";
import { logger } from "@backend/shared/logging/Logger.js";
import { keeperHubConfig } from "@backend/shared/config/index.js";

export interface KeeperHubTransferRequest {
  intentId: string;
  from: string;
  to: string;
  valueWei: bigint;
  chainId: number;
}

export interface KeeperHubTransferResult {
  txHash: string;
  from: string;
}

interface KeeperHubExecuteResponse {
  executionId: string;
  txHash?: string;
  status?: string;
  error?: string;
}

interface KeeperHubStatusResponse {
  executionId: string;
  status: string;
  txHash?: string;
  error?: string;
}

export interface KeeperHubExecutionProviderOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/**
 * KeeperHub-backed execution provider.
 *
 * Routes the native value-transfer broadcast to KeeperHub's Direct Execution
 * API instead of a local RPC node. The envelope is still signed by the chosen
 * signing provider (local/ledger/etc.); KeeperHub takes care of gas, nonces,
 * retries, and multi-RPC failover.
 */
export class KeeperHubExecutionProvider {
  public readonly name = "keeperhub";
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: KeeperHubExecutionProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  async executeTransfer(
    params: KeeperHubTransferRequest,
  ): Promise<KeeperHubTransferResult | { error: string }> {
    if (!keeperHubConfig.apiKey) {
      return { error: "KeeperHub API key is not configured" };
    }

    const execution = await this.requestExecution(params);
    if ("error" in execution) {
      return execution;
    }

    return this.pollForCompletion(execution.executionId, params);
  }

  private async requestExecution(
    params: KeeperHubTransferRequest,
  ): Promise<{ executionId: string } | { error: string }> {
    // KeeperHub expects amounts in native token units (ETH), not wei.
    const amount = ethers.formatEther(params.valueWei);

    const body = {
      chainId: params.chainId,
      recipientAddress: params.to,
      amount,
    };

    try {
      const res = await fetch(`${keeperHubConfig.baseUrl}/api/execute/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keeperHubConfig.apiKey}`,
          "Idempotency-Key": params.intentId,
        },
        body: JSON.stringify(body),
      });

      let data: KeeperHubExecuteResponse;
      try {
        data = (await res.json()) as KeeperHubExecuteResponse;
      } catch {
        return { error: `KeeperHub returned non-JSON response (status ${res.status})` };
      }

      if (!res.ok) {
        return {
          error: `KeeperHub execution request failed: ${data.error || res.statusText} (${res.status})`,
        };
      }

      if (!data.executionId) {
        return { error: "KeeperHub response missing executionId" };
      }

      logger.info(`KeeperHub execution created: ${data.executionId}`);
      return { executionId: data.executionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `KeeperHub execution request failed: ${message}` };
    }
  }

  private async pollForCompletion(
    executionId: string,
    params: KeeperHubTransferRequest,
  ): Promise<KeeperHubTransferResult | { error: string }> {
    const start = Date.now();

    while (Date.now() - start < this.timeoutMs) {
      try {
        const res = await fetch(
          `${keeperHubConfig.baseUrl}/api/execute/${executionId}/status`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${keeperHubConfig.apiKey}`,
            },
          },
        );

        let statusData: KeeperHubStatusResponse | undefined;
        try {
          statusData = (await res.json()) as KeeperHubStatusResponse;
        } catch {
          await this.sleep(this.pollIntervalMs);
          continue;
        }

        const status = statusData?.status?.toLowerCase?.() ?? "unknown";

        if (status === "completed" || status === "success") {
          if (statusData.txHash) {
            logger.info(`KeeperHub execution completed: ${statusData.txHash}`);
            return {
              txHash: statusData.txHash,
              from: params.from,
            };
          }
          return { error: "KeeperHub execution completed but no txHash was returned" };
        }

        if (status === "failed" || status === "reverted") {
          return {
            error: `KeeperHub execution failed: ${statusData.error || status}`,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`KeeperHub status poll failed: ${message}`);
      }

      await this.sleep(this.pollIntervalMs);
    }

    return {
      error: `KeeperHub execution ${executionId} did not complete within ${this.timeoutMs}ms`,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const keeperHubExecutionProvider = new KeeperHubExecutionProvider();
