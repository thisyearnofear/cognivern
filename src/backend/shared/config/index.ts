/**
 * Centralized Configuration Management
 *
 * Single source of truth for all configuration across the platform.
 * Eliminates duplication and ensures consistency.
 */

import { z } from "zod";
import dotenv from "dotenv";

const dotenvPath = process.env.DOTENV_CONFIG_PATH;

if (dotenvPath) {
  dotenv.config({ path: dotenvPath });
} else {
  dotenv.config();
}

// Base configuration schema
const baseConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  PORT: z.coerce.number().default(3001),
  AGENTS_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v || "").toLowerCase() === "true"),
});

// API configuration
const apiConfigSchema = z.object({
  // Scoped cvn_ key used by backend-internal HTTP callers (agents, copilot)
  // to authenticate against the public API. The old global COGNIVERN_API_KEY
  // was retired: external callers use workspace keys, JWT, or per-resource auth.
  COGNIVERN_SERVICE_API_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
});

// AI configuration
const aiConfigSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  MODEL_NAME: z.string().default("gpt-4"),
  GEMINI_API_KEY: z.string().optional(),
});

// Canton (Daml Ledger) configuration. All optional — if CANTON_JSON_API_URL
// is unset the canton sealed-bid backend is simply not registered and the
// server behaves exactly as it did before.
const cantonConfigSchema = z.object({
  CANTON_JSON_API_URL: z.string().optional(),
  CANTON_APPLICATION_ID: z.string().default("cognivern"),
  CANTON_LEDGER_ID: z.string().default("sandbox"),
  CANTON_LEDGER_USER_ID: z.string().optional(),
  CANTON_JWT_SECRET: z.string().default(""),
  CANTON_BEARER_TOKEN: z.string().optional(),
  CANTON_OIDC_TOKEN_URL: z.string().optional(),
  CANTON_OIDC_CLIENT_ID: z.string().optional(),
  CANTON_OIDC_CLIENT_SECRET: z.string().optional(),
  CANTON_OIDC_USERNAME: z.string().optional(),
  CANTON_OIDC_PASSWORD: z.string().optional(),
  CANTON_OIDC_AUDIENCE: z.string().optional(),
  CANTON_OIDC_SCOPE: z.string().default("openid daml_ledger_api offline_access"),
  CANTON_TEMPLATE_AUCTION: z.string().optional(),
  CANTON_TEMPLATE_BID: z.string().optional(),
  CANTON_TEMPLATE_RESULT: z.string().optional(),
  CANTON_TEMPLATE_DEPOSIT: z.string().optional(),
});

// KeeperHub configuration
const keeperHubConfigSchema = z.object({
  KEEPERHUB_API_KEY: z.string().optional(),
  KEEPERHUB_BASE_URL: z.string().default("https://app.keeperhub.com"),
});

// Cleanverse (CVI / CVA) configuration — Track 2 verified agent capital rail
const cleanverseConfigSchema = z.object({
  CLEANVERSE_API_ID: z.string().optional(),
  CLEANVERSE_API_KEY: z.string().optional(),
  CLEANVERSE_API_URL: z
    .string()
    .default("https://uatapi.cleanverse.com/api/cooperate"),
  CLEANVERSE_CHAIN: z.string().default("monad"),
  CLEANVERSE_ATOKEN_ADDRESS: z
    .string()
    .default("0xaC0893567D43C3E7e6e35a72803df05416C1f20D"),
  CLEANVERSE_ATOKEN_SYMBOL: z.string().default("aUSDC"),
  CLEANVERSE_ATOKEN_DECIMALS: z.coerce.number().default(6),
  CLEANVERSE_DEPOSIT_ADDRESS: z.string().optional(),
  CLEANVERSE_DEPOSIT_FOR_ADDRESS: z.string().optional(),
  MONAD_RPC_URL: z.string().default("https://testnet-rpc.monad.xyz"),
  MONAD_CHAIN_ID: z.coerce.number().default(10143),
  CLEANVERSE_GATE_ALL_SPENDS: z
    .string()
    .optional()
    .transform((v) => (v || "").toLowerCase() === "true"),
  // Institutional country rule (Cleanverse A-Pass country tags, ISO 3166-1
  // alpha-2, comma-separated). Set an allow list to whitelist, or a block
  // list to deny. If both are set, the block list wins (fail-closed).
  CLEANVERSE_ALLOW_COUNTRIES: z.string().optional(),
  CLEANVERSE_BLOCK_COUNTRIES: z.string().optional(),
});

// Combined configuration schema
const configSchema = baseConfigSchema
  .merge(apiConfigSchema)
  .merge(aiConfigSchema)
  .merge(cantonConfigSchema)
  .merge(keeperHubConfigSchema)
  .merge(cleanverseConfigSchema);

// Parse and validate configuration
const parseConfig = () => {
  try {
    // For legacy support, we use a more permissive parse that doesn't fail on missing legacy keys
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors
        .filter(
          (err) => err.code === "invalid_type" && err.received === "undefined",
        )
        .map((err) => err.path.join("."));

      if (missingFields.length > 0) {
        console.warn(
          `Warning: Some environment variables are missing: ${missingFields.join(", ")}`,
        );
      }
    }
    // Return a partial object or default if it fails, to prevent crash
    return process.env as unknown as z.infer<typeof configSchema>;
  }
};

// Export validated configuration
export const config = parseConfig();

// Modular access objects (keeping same structure for DRY but pointing to new variables)
export const apiConfig = {
  port: config.PORT || 3000,
  corsOrigin: config.CORS_ORIGIN || "*",
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS || 900000,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS || 100,
  },
  requestTimeout: config.REQUEST_TIMEOUT || 30000,
};

// Legacy stubs to prevent import errors in other modules
export const databaseConfig = {
  url: "",
  maxConnections: 0,
  connectionTimeout: 0,
  queryTimeout: 0,
};
export const cacheConfig = { url: "", ttl: 0, maxSize: "" };
export const tradingConfig = {
  enabled: Boolean(config.AGENTS_ENABLED),
  recallApiKeys: { direct: "", vincent: "" },
  maxRiskPerTrade: 0.02,
};
/**
 * Default EVM execution / public-governance-anchor rail.
 *
 * Prefer `EXECUTION_*` env names. Legacy `XLAYER_*` vars remain accepted as
 * aliases so existing deployments keep working without a cutover.
 *
 * Address this via `executionRails.default` / `executionRails.resolve(...)`
 * (and `@cognivern/shared` rail ids) — not as product identity.
 *
 * @see docs/ARCHITECTURE_RAILS.md
 */
export type EvmExecutionRailConfig = {
  railId: string;
  chainId: number;
  rpcUrl: string;
  network: string;
  privateKey: string;
  contracts: {
    governance: string;
    storage: string;
  };
  gasLimits: {
    evaluateAction: number;
    createPolicy: number;
    updateStatus: number;
    registerAgent: number;
    nativeTransfer: number;
  };
};

function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function buildDefaultEvmExecutionRail(): EvmExecutionRailConfig {
  const chainId = Number(
    envFirst("EXECUTION_CHAIN_ID", "XLAYER_CHAIN_ID") || "1952",
  );
  const railId =
    envFirst("EXECUTION_RAIL_ID") ||
    (chainId === 196 ? "xlayer-mainnet" : "xlayer-testnet");

  return {
    railId,
    privateKey: envFirst("EXECUTION_PRIVATE_KEY", "XLAYER_PRIVATE_KEY") || "",
    rpcUrl:
      envFirst("EXECUTION_RPC_URL", "XLAYER_TESTNET_RPC_URL") ||
      "https://testrpc.xlayer.tech",
    network: chainId === 196 ? "xlayerMainnet" : "xlayerTestnet",
    // X Layer testnet chainId is 1952 (testrpc.xlayer.tech). Mainnet is 196.
    // The literal "195" we used previously did not correspond to any X Layer
    // chain — the broadcast failed with NETWORK_ERROR (network changed: 195 =>
    // 1952) when ethers detected the RPC's actual chainId.
    chainId,
    contracts: {
      governance:
        envFirst(
          "EXECUTION_GOVERNANCE_CONTRACT_ADDRESS",
          "XLAYER_GOVERNANCE_CONTRACT_ADDRESS",
        ) || "0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6",
      storage:
        envFirst(
          "EXECUTION_STORAGE_CONTRACT_ADDRESS",
          "XLAYER_STORAGE_CONTRACT_ADDRESS",
        ) || "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D",
    },
    gasLimits: {
      evaluateAction: Number(
        envFirst("EXECUTION_GAS_EVALUATE", "XLAYER_GAS_EVALUATE") || "300000",
      ),
      createPolicy: Number(
        envFirst("EXECUTION_GAS_CREATE_POLICY", "XLAYER_GAS_CREATE_POLICY") ||
          "400000",
      ),
      updateStatus: Number(
        envFirst("EXECUTION_GAS_UPDATE_STATUS", "XLAYER_GAS_UPDATE_STATUS") ||
          "100000",
      ),
      registerAgent: Number(
        envFirst("EXECUTION_GAS_REGISTER_AGENT", "XLAYER_GAS_REGISTER_AGENT") ||
          "300000",
      ),
      nativeTransfer: Number(
        envFirst("EXECUTION_GAS_TRANSFER", "XLAYER_GAS_TRANSFER") || "21000",
      ),
    },
  };
}

/**
 * Second EVM execution rail (Mantle Sepolia) — proof that local vault
 * transfers are not hard-wired to a single L2. Uses Mantle env when set;
 * governance/storage contracts default empty (native transfer only).
 */
function buildMantleSepoliaExecutionRail(
  defaultRail: EvmExecutionRailConfig,
): EvmExecutionRailConfig {
  return {
    railId: "mantle-sepolia",
    chainId: Number(
      envFirst("EXECUTION_MANTLE_SEPOLIA_CHAIN_ID", "MANTLE_SEPOLIA_CHAIN_ID") ||
        "5003",
    ),
    rpcUrl:
      envFirst(
        "EXECUTION_MANTLE_SEPOLIA_RPC_URL",
        "MANTLE_SEPOLIA_RPC_URL",
      ) || "https://rpc.sepolia.mantle.xyz",
    network: "mantleSepolia",
    // Prefer a Mantle-specific key; fall back to the default execution key
    // so one funded ops key can smoke-test both rails in demo.
    privateKey:
      envFirst("EXECUTION_MANTLE_SEPOLIA_PRIVATE_KEY", "MANTLE_PRIVATE_KEY") ||
      defaultRail.privateKey,
    contracts: {
      governance:
        envFirst("EXECUTION_MANTLE_SEPOLIA_GOVERNANCE_CONTRACT_ADDRESS") || "",
      storage:
        envFirst("EXECUTION_MANTLE_SEPOLIA_STORAGE_CONTRACT_ADDRESS") || "",
    },
    gasLimits: {
      evaluateAction: defaultRail.gasLimits.evaluateAction,
      createPolicy: defaultRail.gasLimits.createPolicy,
      updateStatus: defaultRail.gasLimits.updateStatus,
      registerAgent: defaultRail.gasLimits.registerAgent,
      nativeTransfer: Number(
        envFirst("EXECUTION_MANTLE_SEPOLIA_GAS_TRANSFER") ||
          String(defaultRail.gasLimits.nativeTransfer),
      ),
    },
  };
}

const defaultEvmExecutionRail = buildDefaultEvmExecutionRail();
const mantleSepoliaExecutionRail = buildMantleSepoliaExecutionRail(
  defaultEvmExecutionRail,
);

const executionRailsById: Record<string, EvmExecutionRailConfig> = {
  [defaultEvmExecutionRail.railId]: defaultEvmExecutionRail,
  "mantle-sepolia": mantleSepoliaExecutionRail,
};

// Keep both registry ids reachable when the default rail is an X Layer chain.
if (defaultEvmExecutionRail.chainId === 1952) {
  executionRailsById["xlayer-testnet"] = defaultEvmExecutionRail;
} else if (defaultEvmExecutionRail.chainId === 196) {
  executionRailsById["xlayer-mainnet"] = defaultEvmExecutionRail;
}

export const executionRails = {
  /** Default public EVM execution + governance-anchor rail (env-selected). */
  default: defaultEvmExecutionRail,
  /** Optional second EVM rail for agnostic local transfers. */
  secondary: mantleSepoliaExecutionRail,
  byId: executionRailsById as Readonly<Record<string, EvmExecutionRailConfig>>,
  list(): EvmExecutionRailConfig[] {
    const seen = new Set<string>();
    const out: EvmExecutionRailConfig[] = [];
    for (const rail of Object.values(executionRailsById)) {
      if (seen.has(rail.railId)) continue;
      seen.add(rail.railId);
      out.push(rail);
    }
    return out;
  },
  /**
   * Resolve a configured EVM rail by registry id or chain id.
   * Falls back to `default` when unknown (preserves prior single-rail behavior).
   */
  resolve(chainIdOrRailId?: number | string | null): EvmExecutionRailConfig {
    if (typeof chainIdOrRailId === "string" && chainIdOrRailId.trim()) {
      const byId = executionRailsById[chainIdOrRailId.trim()];
      if (byId) return byId;
    }
    if (typeof chainIdOrRailId === "number" && Number.isFinite(chainIdOrRailId)) {
      const match = Object.values(executionRailsById).find(
        (r) => r.chainId === chainIdOrRailId,
      );
      if (match) return match;
    }
    return defaultEvmExecutionRail;
  },
};

/**
 * @deprecated Prefer `executionRails.default`. Kept as a stable alias for
 * existing imports and test mocks.
 */
export const blockchainConfig = executionRails.default;

export const filecoinConfig = {
  rpcUrl:
    process.env.FILECOIN_RPC_URL ||
    "https://api.calibration.node.glif.io/rpc/v1",
  chainId: 314159,
  network: "calibration" as const,
  privateKey: process.env.FILECOIN_PRIVATE_KEY || "",
  contracts: {
    governance: process.env.GOVERNANCE_CONTRACT_ADDRESS || "",
    storage: process.env.STORAGE_CONTRACT_ADDRESS || "",
  },
  explorerUrl: "https://calibration.filfox.info/en",
  get enabled(): boolean {
    return !!this.privateKey && !!this.contracts.storage;
  },
};

export const mantleConfig = {
  rpcUrl: process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz",
  sepoliaRpcUrl:
    process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
  privateKey: process.env.MANTLE_PRIVATE_KEY || "",
  vaultAddress: process.env.MANTLE_VAULT_ADDRESS || "",
  chainId: { mainnet: 5000, sepolia: 5003 },
};

export const fhenixConfig = {
  rpcUrl:
    process.env.FHENIX_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  chainId: Number(process.env.FHENIX_CHAIN_ID || "421614"),
  contractAddress: process.env.FHENIX_POLICY_CONTRACT || "",
  // Falls back to FILECOIN_PRIVATE_KEY as a shared EVM signing key for dev convenience.
  // In production, use a dedicated Fhenix key.
  privateKey:
    process.env.FHENIX_PRIVATE_KEY || process.env.FILECOIN_PRIVATE_KEY || "",
  cofheUrl:
    process.env.FHENIX_COFHE_URL ||
    process.env.FHENIX_RPC_URL ||
    "https://sepolia-rollup.arbitrum.io/rpc",
  verifierUrl:
    process.env.FHENIX_VERIFIER_URL ||
    process.env.FHENIX_RPC_URL ||
    "https://sepolia-rollup.arbitrum.io/rpc",
  thresholdNetworkUrl:
    process.env.FHENIX_TN_URL ||
    process.env.FHENIX_RPC_URL ||
    "https://sepolia-rollup.arbitrum.io/rpc",
};

export const monitoringConfig = {
  enabled: false,
  healthCheckInterval: 30000,
  retentionDays: { audit: 90, logs: 30 },
};

export const aiConfig = {
  openaiApiKey: config.OPENAI_API_KEY,
  modelName: config.MODEL_NAME,
  geminiApiKey: config.GEMINI_API_KEY,
};

/**
 * Institutional country allow/deny rule applied to Cleanverse A-Pass country
 * tags (v5.5). Mirrors the A-Token rule object's `is_black_list` + `countries`
 * semantics: mode "allow" whitelists, "block" blacklists, "none" = no
 * country constraint (default).
 */
export interface CleanverseCountryRule {
  mode: "allow" | "block" | "none";
  countries: string[];
}

function parseCountryList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

export const keeperHubConfig = {
  apiKey: config.KEEPERHUB_API_KEY || "",
  baseUrl: config.KEEPERHUB_BASE_URL || "https://app.keeperhub.com",
  enabled: Boolean(config.KEEPERHUB_API_KEY),
};

export const cleanverseConfig = {
  get apiId(): string {
    return process.env.CLEANVERSE_API_ID || config.CLEANVERSE_API_ID || "";
  },
  get apiKey(): string {
    return process.env.CLEANVERSE_API_KEY || config.CLEANVERSE_API_KEY || "";
  },
  get apiUrl(): string {
    return (
      process.env.CLEANVERSE_API_URL ||
      config.CLEANVERSE_API_URL ||
      "https://uatapi.cleanverse.com/api/cooperate"
    );
  },
  get chain(): string {
    return process.env.CLEANVERSE_CHAIN || config.CLEANVERSE_CHAIN || "monad";
  },
  get aTokenAddress(): string {
    return (
      process.env.CLEANVERSE_ATOKEN_ADDRESS ||
      config.CLEANVERSE_ATOKEN_ADDRESS ||
      "0xaC0893567D43C3E7e6e35a72803df05416C1f20D"
    );
  },
  get aTokenSymbol(): string {
    return (
      process.env.CLEANVERSE_ATOKEN_SYMBOL ||
      config.CLEANVERSE_ATOKEN_SYMBOL ||
      "aUSDC"
    );
  },
  get depositAddress(): string {
    return process.env.CLEANVERSE_DEPOSIT_ADDRESS || config.CLEANVERSE_DEPOSIT_ADDRESS || "";
  },
  get depositForAddress(): string {
    return process.env.CLEANVERSE_DEPOSIT_FOR_ADDRESS || config.CLEANVERSE_DEPOSIT_FOR_ADDRESS || "";
  },
  get aTokenDecimals(): number {
    return Number(
      process.env.CLEANVERSE_ATOKEN_DECIMALS ||
        config.CLEANVERSE_ATOKEN_DECIMALS ||
        6,
    );
  },
  get monadRpcUrl(): string {
    return (
      process.env.MONAD_RPC_URL ||
      config.MONAD_RPC_URL ||
      "https://testnet-rpc.monad.xyz"
    );
  },
  get monadChainId(): number {
    return Number(
      process.env.MONAD_CHAIN_ID || config.MONAD_CHAIN_ID || 10143,
    );
  },
  get gateAllSpends(): boolean {
    return (
      (process.env.CLEANVERSE_GATE_ALL_SPENDS || "").toLowerCase() === "true" ||
      Boolean(config.CLEANVERSE_GATE_ALL_SPENDS)
    );
  },
  get allowCountries(): string[] {
    return parseCountryList(
      process.env.CLEANVERSE_ALLOW_COUNTRIES ||
        config.CLEANVERSE_ALLOW_COUNTRIES,
    );
  },
  get blockCountries(): string[] {
    return parseCountryList(
      process.env.CLEANVERSE_BLOCK_COUNTRIES ||
        config.CLEANVERSE_BLOCK_COUNTRIES,
    );
  },
  get countryRule(): CleanverseCountryRule {
    const block = this.blockCountries;
    if (block.length > 0) {
      return { mode: "block", countries: block };
    }
    const allow = this.allowCountries;
    if (allow.length > 0) {
      return { mode: "allow", countries: allow };
    }
    return { mode: "none", countries: [] };
  },
  get enabled(): boolean {
    return Boolean(this.apiId && this.apiKey);
  },
  explorerTxUrl(txHash: string): string {
    return `https://testnet.monadscan.com/tx/${txHash}`;
  },
};

// Environment helpers
export const isDevelopment = config.NODE_ENV === "development";
export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
