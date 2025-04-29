import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get directory name for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load MCP configuration
const mcpConfigPath = path.join(__dirname, 'config', 'mcp-config.json');
export const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

// Environment schema
const envSchema = z.object({
  // MCP Configuration - Check this first to conditionally require other variables
  MCP_ENABLED: z.coerce.boolean().default(true),
  MCP_DEFAULT_SERVER: z.string().default('bitte-ai'),
  MCP_API_KEY: z.string().optional(),

  // Bitte Wallet Configuration
  BITTE_API_KEY: z.string().optional(),

  // API Security and Authentication
  API_KEY: z.string().default('escheat-api-key-123456'),

  // Recall Configuration - Only required if MCP is not enabled
  RECALL_PRIVATE_KEY: z.string().min(1).optional(),
  RECALL_BUCKET_ALIAS: z.string().min(1).optional(),
  RECALL_COT_LOG_PREFIX: z.string().min(1).optional(),
  RECALL_NETWORK: z.enum(['mainnet', 'testnet']).optional(),
  RECALL_ADDRESS: z.string().min(1).optional(),
  RECALL_BUCKET_ADDRESS: z.string().min(1).optional(),
  RECALL_API_URL: z.string().default('https://api.recall.ai'),
  RECALL_API_KEY: z.string().min(1).optional(),

  // Server Configuration
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Security
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Provider Configuration
  OPENAI_API_KEY: z.string().min(1),
  MODEL_NAME: z.string().default('gpt-4'),
  GEMINI_API_KEY: z.string().optional(),

  // Governance Configuration
  DEFAULT_POLICY: z.string().default('standard'),
  AUDIT_FREQUENCY: z.string().default('daily'),
});

// Parse and validate environment variables
const parseEnvVars = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseEnvVars();

// Type for the configuration
export type Config = z.infer<typeof envSchema>;
