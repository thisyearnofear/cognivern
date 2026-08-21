/**
 * Rail registry — Cognivern control plane stays chain-agnostic; rails are
 * adapters for settlement, execution, evidence, and confidential decision.
 *
 * UI explorers, settings badges, and evidence copy should resolve through
 * these helpers instead of hardcoding "X Layer" or mismatched explorer URLs.
 *
 * @see docs/ARCHITECTURE_RAILS.md
 */

export type RailPlane = "settlement" | "execution" | "evidence" | "decision";

export type RailStatus = "live" | "configured" | "planned";

export interface RailDescriptor {
  /** Stable id used in config / evidence metadata (not a display string). */
  id: string;
  plane: RailPlane;
  displayName: string;
  /** EVM chain id when applicable. Canton and similar omit this. */
  chainId?: number;
  /** Base URL for tx pages, without trailing slash or `/tx`. */
  explorerTxBase?: string;
  /** Base URL for address pages, without trailing slash or `/address`. */
  explorerAddressBase?: string;
  capabilities: readonly string[];
  status: RailStatus;
  notes?: string;
}

/**
 * Canonical rails Cognivern knows about. Defaults and workspace settings
 * pick among these; product copy should use `displayName`, never inline L2 brands.
 */
export const RAILS: readonly RailDescriptor[] = [
  {
    id: "xlayer-testnet",
    plane: "execution",
    displayName: "X Layer Testnet",
    chainId: 1952,
    explorerTxBase: "https://www.oklink.com/xlayer-test",
    explorerAddressBase: "https://www.oklink.com/xlayer-test",
    capabilities: ["native_transfer", "governance_anchor"],
    status: "live",
    notes: "Default EVM execution / public governance anchor (testnet).",
  },
  {
    id: "xlayer-mainnet",
    plane: "execution",
    displayName: "X Layer",
    chainId: 196,
    explorerTxBase: "https://www.oklink.com/xlayer",
    explorerAddressBase: "https://www.oklink.com/xlayer",
    capabilities: ["native_transfer", "governance_anchor"],
    status: "configured",
    notes: "Mainnet execution rail (chainId 196).",
  },
  {
    id: "arbitrum-sepolia",
    plane: "decision",
    displayName: "Arbitrum Sepolia",
    chainId: 421614,
    explorerTxBase: "https://sepolia.arbiscan.io",
    explorerAddressBase: "https://sepolia.arbiscan.io",
    capabilities: ["fhe_policy", "governed_vault"],
    status: "live",
    notes: "Fhenix CoFHE + GovernanceContract / GovernedVault host.",
  },
  {
    id: "canton-devnet",
    plane: "settlement",
    displayName: "Canton DevNet",
    capabilities: ["sealed_bid", "atomic_reveal", "party_disclosure"],
    status: "live",
    notes: "Private sealed-bid settlement (Daml).",
  },
  {
    id: "fhe-sealed-bid",
    plane: "settlement",
    displayName: "FHE sealed-bid",
    capabilities: ["sealed_bid", "ciphertext_bids"],
    status: "configured",
    notes: "CoFHE bid handles; reveal needs manager decryption proof.",
  },
  {
    id: "filecoin-calibration",
    plane: "evidence",
    displayName: "Filecoin Calibration",
    chainId: 314159,
    explorerTxBase: "https://calibration.filfox.info/en",
    explorerAddressBase: "https://calibration.filfox.info/en",
    capabilities: ["audit_storage"],
    status: "live",
  },
  {
    id: "zerog-mainnet",
    plane: "evidence",
    displayName: "0G Chain",
    explorerTxBase: "https://chainscan.0g.ai",
    explorerAddressBase: "https://chainscan.0g.ai",
    capabilities: ["governance_proof"],
    status: "live",
  },
  {
    id: "zerog-galileo",
    plane: "evidence",
    displayName: "0G Galileo",
    explorerTxBase: "https://chainscan-galileo.0g.ai",
    explorerAddressBase: "https://chainscan-galileo.0g.ai",
    capabilities: ["governance_proof"],
    status: "configured",
  },
  {
    id: "mantle-sepolia",
    plane: "execution",
    displayName: "Mantle Sepolia",
    chainId: 5003,
    explorerTxBase: "https://sepolia.mantlescan.xyz",
    explorerAddressBase: "https://sepolia.mantlescan.xyz",
    capabilities: ["native_transfer", "governed_vault"],
    status: "configured",
    notes:
      "Second EVM execution rail (executionRails.secondary) — proof local transfers are not single-L2.",
  },
  {
    id: "ethereum-mainnet",
    plane: "execution",
    displayName: "Ethereum",
    chainId: 1,
    explorerTxBase: "https://etherscan.io",
    explorerAddressBase: "https://etherscan.io",
    capabilities: ["native_transfer"],
    status: "planned",
  },
  {
    id: "base-mainnet",
    plane: "execution",
    displayName: "Base",
    chainId: 8453,
    explorerTxBase: "https://basescan.org",
    explorerAddressBase: "https://basescan.org",
    capabilities: ["native_transfer"],
    status: "planned",
  },
  {
    id: "mantle-mainnet",
    plane: "execution",
    displayName: "Mantle",
    chainId: 5000,
    explorerTxBase: "https://mantlescan.xyz",
    explorerAddressBase: "https://mantlescan.xyz",
    capabilities: ["native_transfer"],
    status: "planned",
  },
] as const;

/** Default public EVM execution / governance-anchor rail for demos and OWS. */
export const DEFAULT_EXECUTION_RAIL_ID = "xlayer-testnet";

const BY_ID = new Map(RAILS.map((r) => [r.id, r]));

export function getRailById(id: string): RailDescriptor | undefined {
  return BY_ID.get(id);
}

/**
 * Resolve a rail by EVM chain id. Prefer `plane` when several rails share a
 * chain (e.g. Arbitrum Sepolia hosts both decision compute and vaults).
 */
export function getRailByChainId(
  chainId: number,
  plane?: RailPlane,
): RailDescriptor | undefined {
  const matches = RAILS.filter((r) => r.chainId === chainId);
  if (matches.length === 0) return undefined;
  if (plane) {
    const preferred = matches.find((r) => r.plane === plane);
    if (preferred) return preferred;
  }
  // Prefer live > configured > planned
  const rank = (s: RailStatus) =>
    s === "live" ? 0 : s === "configured" ? 1 : 2;
  return [...matches].sort((a, b) => rank(a.status) - rank(b.status))[0];
}

export function railsForPlane(plane: RailPlane): RailDescriptor[] {
  return RAILS.filter((r) => r.plane === plane);
}

export function defaultExecutionRail(): RailDescriptor {
  return (
    getRailById(DEFAULT_EXECUTION_RAIL_ID) ??
    (RAILS.find((r) => r.plane === "execution" && r.status === "live") as RailDescriptor)
  );
}

/**
 * Map the legacy `blockchainConfig.chainId` (X Layer env) to a rail id.
 */
export function executionRailIdForChainId(chainId: number): string {
  if (chainId === 196) return "xlayer-mainnet";
  if (chainId === 1952) return "xlayer-testnet";
  const rail = getRailByChainId(chainId, "execution");
  return rail?.id ?? DEFAULT_EXECUTION_RAIL_ID;
}

export function explorerTxUrl(
  chainIdOrRailId: number | string | undefined,
  txHash: string,
): string | undefined {
  if (!txHash) return undefined;
  const rail =
    typeof chainIdOrRailId === "number"
      ? getRailByChainId(chainIdOrRailId)
      : typeof chainIdOrRailId === "string"
        ? getRailById(chainIdOrRailId)
        : undefined;
  if (!rail?.explorerTxBase) return undefined;
  // Filfox uses /en/tx/… style under the base; others use /tx/…
  if (rail.id.startsWith("filecoin")) {
    return `${rail.explorerTxBase}/tx/${txHash}`;
  }
  return `${rail.explorerTxBase}/tx/${txHash}`;
}

export function explorerAddressUrl(
  chainIdOrRailId: number | string | undefined,
  address: string,
): string | undefined {
  if (!address) return undefined;
  const rail =
    typeof chainIdOrRailId === "number"
      ? getRailByChainId(chainIdOrRailId)
      : typeof chainIdOrRailId === "string"
        ? getRailById(chainIdOrRailId)
        : undefined;
  if (!rail?.explorerAddressBase) return undefined;
  if (rail.id.startsWith("filecoin")) {
    return `${rail.explorerAddressBase}/address/${address}`;
  }
  return `${rail.explorerAddressBase}/address/${address}`;
}

/** Human line for security/architecture chips, e.g. "Immutable on 0G Chain + X Layer Testnet". */
export function formatEvidenceAnchorLine(
  sinkRailIds: readonly string[] = ["zerog-mainnet", DEFAULT_EXECUTION_RAIL_ID],
): string {
  const names = sinkRailIds
    .map((id) => getRailById(id)?.displayName)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return "Immutable on configured evidence rails";
  return `Immutable on ${names.join(" + ")}`;
}

/** Agent workshop / identity chain picker — execution + decision hosts. */
export function agentSelectableRails(): RailDescriptor[] {
  const ids = [
    "ethereum-mainnet",
    "arbitrum-sepolia",
    "base-mainnet",
    "xlayer-testnet",
    "xlayer-mainnet",
    "mantle-mainnet",
  ];
  return ids
    .map((id) => getRailById(id))
    .filter((r): r is RailDescriptor => Boolean(r));
}

/** Settings “supported chains” list for the control-plane UI. */
export function settingsRailRows(): Array<{
  name: string;
  role: string;
  note?: string;
  noteColor?: string;
  status: RailStatus;
}> {
  const roleFor = (r: RailDescriptor): string => {
    switch (r.plane) {
      case "execution":
        return "Execution";
      case "settlement":
        return "Settlement";
      case "evidence":
        return "Evidence";
      case "decision":
        return "Confidential Compute";
      default:
        return r.plane;
    }
  };
  const noteFor = (r: RailDescriptor): { note?: string; noteColor?: string } => {
    if (r.status === "live") {
      return { note: r.notes?.split("·")[0]?.trim() || "Live", noteColor: "text-emerald-500" };
    }
    if (r.status === "configured") {
      return { note: "Configured", noteColor: "text-amber-500" };
    }
    return { note: "Planned", noteColor: "text-muted-foreground" };
  };

  const preferred = [
    "arbitrum-sepolia",
    "xlayer-testnet",
    "canton-devnet",
    "filecoin-calibration",
    "zerog-mainnet",
    "ethereum-mainnet",
    "base-mainnet",
    "mantle-mainnet",
  ];

  return preferred
    .map((id) => getRailById(id))
    .filter((r): r is RailDescriptor => Boolean(r))
    .map((r) => {
      const { note, noteColor } = noteFor(r);
      return {
        name: r.displayName,
        role: roleFor(r),
        note,
        noteColor,
        status: r.status,
      };
    });
}

/** Evidence sink ids stored on workspace settings (map to EvidenceSink.name). */
export const WORKSPACE_EVIDENCE_SINK_IDS = ["zerog", "filecoin"] as const;
export type WorkspaceEvidenceSinkId = (typeof WORKSPACE_EVIDENCE_SINK_IDS)[number];

export const WORKSPACE_EXECUTION_PROVIDERS = [
  "local",
  "keeperhub",
  "cleanverse",
] as const;
export type WorkspaceExecutionProviderId =
  (typeof WORKSPACE_EXECUTION_PROVIDERS)[number];

/** Execution rails selectable as a workspace default (live or configured). */
export function workspaceSelectableExecutionRails(): RailDescriptor[] {
  return RAILS.filter(
    (r) =>
      r.plane === "execution" &&
      (r.status === "live" || r.status === "configured") &&
      typeof r.chainId === "number",
  );
}

export function isWorkspaceEvidenceSinkId(
  value: unknown,
): value is WorkspaceEvidenceSinkId {
  return (
    typeof value === "string" &&
    (WORKSPACE_EVIDENCE_SINK_IDS as readonly string[]).includes(value)
  );
}

export function isWorkspaceExecutionProviderId(
  value: unknown,
): value is WorkspaceExecutionProviderId {
  return (
    typeof value === "string" &&
    (WORKSPACE_EXECUTION_PROVIDERS as readonly string[]).includes(value)
  );
}

export function isSelectableExecutionRailId(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return workspaceSelectableExecutionRails().some((r) => r.id === value);
}

/**
 * Normalize workspace evidenceSinks. Returns undefined when unset/empty
 * (caller should use platform defaults).
 */
export function normalizeWorkspaceEvidenceSinks(
  sinks: unknown,
): WorkspaceEvidenceSinkId[] | undefined {
  if (!Array.isArray(sinks)) return undefined;
  const filtered = sinks.filter(isWorkspaceEvidenceSinkId);
  const unique = [...new Set(filtered)];
  return unique.length > 0 ? unique : undefined;
}
