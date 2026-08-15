/**
 * Backend registry — maps a program's configured `backend` id to a live
 * adapter and its pricing service.
 *
 * Why this exists: `credit_programs.backend` was being stored and recorded on
 * every inference record but never consulted, so a program configured for one
 * provider would still have been served by whichever backend the gateway was
 * constructed with. A column that is written but not honoured is worse than no
 * column — it makes the audit trail assert something untrue.
 *
 * Adding a provider is now: implement `InferenceBackend` (an id plus four
 * methods, plus an optional `fetchUpstreamBalance` for funding
 * reconciliation), call `registerBackend`, and set `backend` on the program.
 * Nothing in the credit ledger, disclosure model, or audit path changes —
 * those never learn which provider served a call beyond recording its id.
 *
 * Each backend gets its own `ModelPricingService` because pricing units are
 * provider-specific: 0G quotes neuron-per-token against an on-chain asset,
 * whereas a conventional API provider quotes USD directly.
 */

import logger from "@backend/utils/logger.js";
import type { InferenceBackend } from "./types.js";
import { ModelPricingService } from "./ModelPricingService.js";
import { sharedZeroGRouterBackend } from "./ZeroGRouterBackend.js";

export interface RegisteredBackend {
  backend: InferenceBackend;
  pricing: ModelPricingService;
}

const registry = new Map<string, RegisteredBackend>();

/**
 * Register a backend, optionally with a pre-built pricing service.
 *
 * Pass an explicit `pricing` when the provider's price units are not the
 * 0G-style native/decimals pair — for a USD-quoting provider you would supply a
 * ModelPricingService whose catalog already yields USD.
 */
export function registerBackend(
  backend: InferenceBackend,
  pricing?: ModelPricingService,
): void {
  registry.set(backend.id, {
    backend,
    pricing: pricing ?? new ModelPricingService(backend),
  });
  logger.info(`Registered inference backend '${backend.id}'`);
}

export function resolveBackend(id: string): RegisteredBackend | null {
  ensureDefaults();
  return registry.get(id) ?? null;
}

export function listBackends(): Array<{ id: string; configured: boolean }> {
  ensureDefaults();
  return [...registry.values()].map(({ backend }) => ({
    id: backend.id,
    configured: backend.isConfigured(),
  }));
}

/** Test seam — drops every registration including the defaults. */
export function resetBackendRegistry(): void {
  registry.clear();
  defaultsRegistered = false;
}

let defaultsRegistered = false;

/**
 * Lazily register built-in backends.
 *
 * Deferred rather than done at module load so env vars read by adapter
 * constructors are resolved at first use, which keeps tests able to set them
 * after import.
 */
function ensureDefaults(): void {
  if (defaultsRegistered) return;
  defaultsRegistered = true;
  if (!registry.has("zerog-router")) {
    registerBackend(sharedZeroGRouterBackend());
  }
}
