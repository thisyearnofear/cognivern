import type { ExecutionBackend } from "./ExecutionBackend.js";
import { evmExecutionBackend } from "./EvmExecutionBackend.js";
import { keeperHubExecutionBackend } from "./KeeperHubExecutionBackend.js";
import { cleanverseExecutionBackend } from "./CleanverseExecutionBackend.js";

export type {
  ExecutionBackend,
  ExecutionCapability,
  ExecutionTransferRequest,
  ExecutionTransferResult,
} from "./ExecutionBackend.js";
export { normalizeTxStatus } from "./ExecutionBackend.js";
export { EvmExecutionBackend, evmExecutionBackend } from "./EvmExecutionBackend.js";
export {
  KeeperHubExecutionBackend,
  keeperHubExecutionBackend,
} from "./KeeperHubExecutionBackend.js";
export {
  CleanverseExecutionBackend,
  cleanverseExecutionBackend,
} from "./CleanverseExecutionBackend.js";

const REGISTRY = new Map<string, ExecutionBackend>([
  ["local", evmExecutionBackend],
  ["evm", evmExecutionBackend],
  ["keeperhub", keeperHubExecutionBackend],
  ["cleanverse", cleanverseExecutionBackend],
]);

/**
 * Resolve a spend-execution adapter by wallet metadata `executionProvider`.
 * Unknown names fall back to the local EVM rail (default public execution).
 */
export function resolveExecutionBackend(
  providerName: string | undefined | null,
): ExecutionBackend {
  const key = (providerName || "local").trim().toLowerCase();
  return REGISTRY.get(key) ?? evmExecutionBackend;
}

export function listExecutionBackends(): ExecutionBackend[] {
  return [evmExecutionBackend, keeperHubExecutionBackend, cleanverseExecutionBackend];
}
