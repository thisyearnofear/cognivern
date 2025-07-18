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
});

// Database configuration
const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('cognivern'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().min(1),
  DB_MAX_CONNECTIONS: z.coerce.number().default(20),
  DB_CONNECTION_TIMEOUT: z.coerce.number().default(30000),
  DB_QUERY_TIMEOUT: z.coerce.number().default(10000),
});

// Cache configuration
const cacheConfigSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CACHE_TTL: z.coerce.number().default(300), // 5 minutes
  CACHE_MAX_SIZE: z.string().default('100mb'),
});

// API configuration
const apiConfigSchema = z.object({
  API_KEY: z.string().default('development-api-key'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
});

// Trading configuration
const tradingConfigSchema = z.object({
  RECALL_API_KEY_DIRECT: z.string().min(1),
  RECALL_API_KEY_VINCENT: z.string().min(1),
  RECALL_API_URL: z.string().default('https://api.competitions.recall.network'),
  RECALL_SANDBOX_URL: z.string().default('https://api.sandbox.competitions.recall.network'),
  TRADING_ENABLED: z.coerce.boolean().default(true),
  MIN_TRADES_PER_DAY: z.coerce.number().default(3),
  MAX_RISK_PER_TRADE: z.coerce.number().default(0.02), // 2%
  TRADING_HOURS_START: z.coerce.number().default(0), // 24/7 for crypto
  TRADING_HOURS_END: z.coerce.number().default(24),
});

// Blockchain configuration
const blockchainConfigSchema = z.object({
  FILECOIN_PRIVATE_KEY: z.string().min(1),
  FILECOIN_RPC_URL: z.string().default('https://api.calibration.node.glif.io/rpc/v1'),
  FILECOIN_NETWORK: z.enum(['mainnet', 'calibration']).default('calibration'),
  GOVERNANCE_CONTRACT_ADDRESS: z.string().min(1),
  STORAGE_CONTRACT_ADDRESS: z.string().min(1),
  WALLET_ADDRESS: z.string().min(1),
  ALCHEMY_API_KEY: z.string().min(1),
});

// AI configuration
const aiConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  MODEL_NAME: z.string().default('gpt-4'),
  GEMINI_API_KEY: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().default(0.7),
  AI_MAX_TOKENS: z.coerce.number().default(1000),
});

// Monitoring configuration
const monitoringConfigSchema = z.object({
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000), // 30 seconds
  AUDIT_RETENTION_DAYS: z.coerce.number().default(90),
  LOG_RETENTION_DAYS: z.coerce.number().default(30),
  PROMETHEUS_PORT: z.coerce.number().default(9090),
  GRAFANA_PORT: z.coerce.number().default(3001),
});

// Combined configuration schema
const configSchema = baseConfigSchema
  .merge(databaseConfigSchema)
  .merge(cacheConfigSchema)
  .merge(apiConfigSchema)
  .merge(tradingConfigSchema)
  .merge(blockchainConfigSchema)
  .merge(aiConfigSchema)
  .merge(monitoringConfigSchema);

// Parse and validate configuration
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
      }
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseConfig();

// Export individual config sections for modular access
export const databaseConfig = {
  url: config.DATABASE_URL || 
    `postgresql://${config.POSTGRES_USER}:${config.POSTGRES_PASSWORD}@${config.POSTGRES_HOST}:${config.POSTGRES_PORT}/${config.POSTGRES_DB}`,
  maxConnections: config.DB_MAX_CONNECTIONS,
  connectionTimeout: config.DB_CONNECTION_TIMEOUT,
  queryTimeout: config.DB_QUERY_TIMEOUT,
};

export const cacheConfig = {
  url: config.REDIS_URL,
  ttl: config.CACHE_TTL,
  maxSize: config.CACHE_MAX_SIZE,
};

export const apiConfig = {
  port: config.PORT,
  apiKey: config.API_KEY,
  corsOrigin: config.CORS_ORIGIN,
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  },
  requestTimeout: config.REQUEST_TIMEOUT,
};

export const tradingConfig = {
  recallApiKeys: {
    direct: config.RECALL_API_KEY_DIRECT,
    vincent: config.RECALL_API_KEY_VINCENT,
  },
  apiUrl: config.RECALL_API_URL,
  sandboxUrl: config.RECALL_SANDBOX_URL,
  enabled: config.TRADING_ENABLED,
  minTradesPerDay: config.MIN_TRADES_PER_DAY,
  maxRiskPerTrade: config.MAX_RISK_PER_TRADE,
  tradingHours: {
    start: config.TRADING_HOURS_START,
    end: config.TRADING_HOURS_END,
  },
};

export const blockchainConfig = {
  privateKey: config.FILECOIN_PRIVATE_KEY,
  rpcUrl: config.FILECOIN_RPC_URL,
  network: config.FILECOIN_NETWORK,
  contracts: {
    governance: config.GOVERNANCE_CONTRACT_ADDRESS,
    storage: config.STORAGE_CONTRACT_ADDRESS,
  },
  walletAddress: config.WALLET_ADDRESS,
  alchemyApiKey: config.ALCHEMY_API_KEY,
};

export const aiConfig = {
  openaiApiKey: config.OPENAI_API_KEY,
  modelName: config.MODEL_NAME,
  geminiApiKey: config.GEMINI_API_KEY,
  temperature: config.AI_TEMPERATURE,
  maxTokens: config.AI_MAX_TOKENS,
};

export const monitoringConfig = {
  enabled: config.METRICS_ENABLED,
  healthCheckInterval: config.HEALTH_CHECK_INTERVAL,
  retentionDays: {
    audit: config.AUDIT_RETENTION_DAYS,
    logs: config.LOG_RETENTION_DAYS,
  },
  ports: {
    prometheus: config.PROMETHEUS_PORT,
    grafana: config.GRAFANA_PORT,
  },
};

// Environment helpers
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
