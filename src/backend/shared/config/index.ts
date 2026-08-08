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

// Sapience configuration
const sapienceConfigSchema = z.object({
  ARBITRUM_RPC_URL: z.string().default("https://arb1.arbitrum.io/rpc"),
  ETHEREAL_RPC_URL: z.string().default("https://mainnet.ethereal.xyz/rpc"),
  SAPIENCE_PRIVATE_KEY: z.string().optional(),
  EAS_CONTRACT_ADDRESS: z
    .string()
    .default("0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458"),
});

// API configuration
const apiConfigSchema = z.object({
  COGNIVERN_API_KEY: z.string().min(1),
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
    .default("0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892"),
  CLEANVERSE_ATOKEN_SYMBOL: z.string().default("aUSD-D"),
  CLEANVERSE_ATOKEN_DECIMALS: z.coerce.number().default(6),
  MONAD_RPC_URL: z.string().default("https://testnet-rpc.monad.xyz"),
  MONAD_CHAIN_ID: z.coerce.number().default(10143),
  CLEANVERSE_GATE_ALL_SPENDS: z
    .string()
    .optional()
    .transform((v) => (v || "").toLowerCase() === "true"),
});

// Combined configuration schema
const configSchema = baseConfigSchema
  .merge(sapienceConfigSchema)
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
  apiKey: config.COGNIVERN_API_KEY || "",
  corsOrigin: config.CORS_ORIGIN || "*",
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS || 900000,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS || 100,
  },
  requestTimeout: config.REQUEST_TIMEOUT || 30000,
};

export const sapienceConfig = {
  arbitrumRpcUrl: config.ARBITRUM_RPC_URL,
  etherealRpcUrl: config.ETHEREAL_RPC_URL,
  privateKey: config.SAPIENCE_PRIVATE_KEY,
  easAddress: config.EAS_CONTRACT_ADDRESS,
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
export const blockchainConfig = {
  privateKey: process.env.XLAYER_PRIVATE_KEY || "",
  rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech",
  network: "xlayerTestnet",
  // X Layer testnet chainId is 1952 (testrpc.xlayer.tech). Mainnet is 196.
  // The literal "195" we used previously did not correspond to any X Layer
  // chain — the broadcast failed with NETWORK_ERROR (network changed: 195 =>
  // 1952) when ethers detected the RPC's actual chainId.
  chainId: Number(process.env.XLAYER_CHAIN_ID || "1952"),
  contracts: {
    governance:
      process.env.XLAYER_GOVERNANCE_CONTRACT_ADDRESS ||
      "0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6",
    storage:
      process.env.XLAYER_STORAGE_CONTRACT_ADDRESS ||
      "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D",
  },
  gasLimits: {
    evaluateAction: Number(process.env.XLAYER_GAS_EVALUATE || "300000"),
    createPolicy: Number(process.env.XLAYER_GAS_CREATE_POLICY || "400000"),
    updateStatus: Number(process.env.XLAYER_GAS_UPDATE_STATUS || "100000"),
    registerAgent: Number(process.env.XLAYER_GAS_REGISTER_AGENT || "300000"),
    nativeTransfer: Number(process.env.XLAYER_GAS_TRANSFER || "21000"),
  },
};

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
      "0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892"
    );
  },
  get aTokenSymbol(): string {
    return (
      process.env.CLEANVERSE_ATOKEN_SYMBOL ||
      config.CLEANVERSE_ATOKEN_SYMBOL ||
      "aUSD-D"
    );
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
