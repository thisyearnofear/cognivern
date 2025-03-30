import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema
const envSchema = z.object({
  // Recall Configuration
  RECALL_PRIVATE_KEY: z.string().min(1),
  RECALL_BUCKET_ALIAS: z.string().min(1),
  RECALL_NETWORK: z.enum(['mainnet', 'testnet']),

  // Server Configuration
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Security
  CORS_ORIGIN: z.string().default('*'),
  API_KEY: z.string().min(1),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Provider Configuration
  OPENAI_API_KEY: z.string().min(1),
  MODEL_NAME: z.string().default('gpt-4'),

  // Governance Configuration
  DEFAULT_POLICY: z.string().default('standard'),
  AUDIT_FREQUENCY: z.string().default('daily'),
});

// Parse and validate environment variables
const parseEnvVars = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
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
