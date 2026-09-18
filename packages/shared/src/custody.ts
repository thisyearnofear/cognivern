/**
 * Custody — user-facing vocabulary for how an agent holds and moves capital.
 *
 * Cognivern stays provider-agnostic: operators choose a *custody mode* by need.
 * Modes map to wallet `executionProvider` + `signingProvider` under the hood.
 *
 * @see docs/DYNAMIC.md
 * @see docs/ADAPTIVE_UX.md
 */

import type { WalletSigningProviderId } from "./types/index.js";
import type { WorkspaceExecutionProviderId } from "./rails.js";

/** Primary custody modes shown in product UI (not vendor names). */
export const CUSTODY_MODES = [
  "vault",
  "managed_mpc",
  "hosted_execution",
  "verified_settlement",
  "custom",
] as const;

export type CustodyMode = (typeof CUSTODY_MODES)[number];

/** Modes offered in the simple picker (custom is derived, not chosen). */
export const PRIMARY_CUSTODY_MODES = [
  "vault",
  "managed_mpc",
] as const satisfies readonly CustodyMode[];

export const EXTENDED_CUSTODY_MODES = [
  "hosted_execution",
  "verified_settlement",
] as const satisfies readonly CustodyMode[];

export type ExecutionProviderId = WorkspaceExecutionProviderId;

export interface CustodyProviders {
  executionProvider: ExecutionProviderId;
  signingProvider: WalletSigningProviderId;
}

export interface CustodyModeMeta {
  id: CustodyMode;
  /** Short label for selects and badges. */
  label: string;
  /** One-line “when you need…” copy. */
  need: string;
  /** Optional provider footnote (never the headline). */
  poweredBy?: string;
}

export const CUSTODY_MODE_META: Record<CustodyMode, CustodyModeMeta> = {
  vault: {
    id: "vault",
    label: "Cognivern vault",
    need: "Default for demos and low-stakes spends — keys stay in this deployment.",
  },
  managed_mpc: {
    id: "managed_mpc",
    label: "Managed MPC",
    need: "You want agent wallets without raw private keys on this box.",
    poweredBy: "Dynamic server wallets",
  },
  hosted_execution: {
    id: "hosted_execution",
    label: "Hosted execution",
    need: "Gas sponsorship, retries, and ops-managed broadcast.",
    poweredBy: "KeeperHub",
  },
  verified_settlement: {
    id: "verified_settlement",
    label: "Verified settlement",
    need: "Identity-gated capital and attested settlement rails.",
    poweredBy: "Cleanverse",
  },
  custom: {
    id: "custom",
    label: "Custom",
    need: "Signing and broadcast providers are split (advanced).",
  },
};

/** Map a simple custody choice to provider pair (non-custom). */
export function custodyToProviders(mode: CustodyMode): CustodyProviders | null {
  switch (mode) {
    case "vault":
      return { executionProvider: "local", signingProvider: "local" };
    case "managed_mpc":
      return { executionProvider: "dynamic", signingProvider: "dynamic" };
    case "hosted_execution":
      return { executionProvider: "keeperhub", signingProvider: "local" };
    case "verified_settlement":
      return { executionProvider: "cleanverse", signingProvider: "local" };
    case "custom":
      return null;
  }
}

/**
 * Derive custody mode from wallet metadata.
 * Matched pairs → named mode; anything else → custom.
 */
export function deriveCustodyMode(input: {
  executionProvider?: string | null;
  signingProvider?: string | null;
}): CustodyMode {
  const execution = (input.executionProvider || "local").toLowerCase();
  const signing = (input.signingProvider || "local").toLowerCase();

  if (execution === "dynamic" && signing === "dynamic") return "managed_mpc";
  if (execution === "keeperhub") {
    return signing === "local" || signing === "ledger" || signing === "dynamic"
      ? "hosted_execution"
      : "custom";
  }
  if (execution === "cleanverse") {
    return signing === "local" || signing === "ledger" ? "verified_settlement" : "custom";
  }
  if (execution === "local" || execution === "evm") {
    if (
      signing === "local" ||
      signing === "ledger" ||
      signing === "speculos" ||
      signing === "ows_remote"
    ) {
      return "vault";
    }
  }
  return "custom";
}

export function custodyLabel(mode: CustodyMode): string {
  return CUSTODY_MODE_META[mode].label;
}

export function isCustodyMode(value: unknown): value is CustodyMode {
  return (
    typeof value === "string" &&
    (CUSTODY_MODES as readonly string[]).includes(value)
  );
}
