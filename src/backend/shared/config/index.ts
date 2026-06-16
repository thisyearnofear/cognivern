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

// Combined configuration schema
const configSchema = baseConfigSchema
  .merge(sapienceConfigSchema)
  .merge(apiConfigSchema)
  .merge(aiConfigSchema);

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

// Environment helpers
export const isDevelopment = config.NODE_ENV === "development";
export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
