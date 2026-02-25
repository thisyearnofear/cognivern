/**
 * Centralized Configuration Management
 *
 * Single source of truth for all configuration across the platform.
 * Eliminates duplication and ensures consistency.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Base configuration schema
const baseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  PORT: z.coerce.number().default(3000),
  AGENTS_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v || "").toLowerCase() === "true"),
});

// Sapience configuration
const sapienceConfigSchema = z.object({
  ARBITRUM_RPC_URL: z.string().default('https://arb1.arbitrum.io/rpc'),
  ETHEREAL_RPC_URL: z.string().default('https://mainnet.ethereal.xyz/rpc'),
  SAPIENCE_PRIVATE_KEY: z.string().optional(),
  EAS_CONTRACT_ADDRESS: z.string().default('0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458'),
});

// API configuration
const apiConfigSchema = z.object({
  API_KEY: z.string().default('development-api-key'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
});

// AI configuration
const aiConfigSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  MODEL_NAME: z.string().default('gpt-4'),
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
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));

      if (missingFields.length > 0) {
        console.warn(`Warning: Some environment variables are missing: ${missingFields.join(', ')}`);
      }
    }
    // Return a partial object or default if it fails, to prevent crash
    return (process.env as any);
  }
};

// Export validated configuration
export const config = parseConfig();

// Modular access objects (keeping same structure for DRY but pointing to new variables)
export const apiConfig = {
  port: config.PORT || 3000,
  apiKey: config.API_KEY || 'development-api-key',
  corsOrigin: config.CORS_ORIGIN || '*',
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
export const databaseConfig = { url: '', maxConnections: 0, connectionTimeout: 0, queryTimeout: 0 };
export const cacheConfig = { url: '', ttl: 0, maxSize: '' };
export const tradingConfig = {
  enabled: Boolean((config as any).AGENTS_ENABLED),
  recallApiKeys: { direct: '', vincent: '' },
  maxRiskPerTrade: 0.02,
};
export const blockchainConfig = { privateKey: '', rpcUrl: '', network: 'calibration', contracts: { governance: '', storage: '' } };
export const monitoringConfig = { enabled: false, healthCheckInterval: 30000, retentionDays: { audit: 90, logs: 30 } };

export const aiConfig = {
  openaiApiKey: config.OPENAI_API_KEY,
  modelName: config.MODEL_NAME,
  geminiApiKey: config.GEMINI_API_KEY,
};

// Environment helpers
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
