import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dotenvPath = process.env.DOTENV_CONFIG_PATH;

if (dotenvPath) {
  dotenv.config({ path: dotenvPath });
} else {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

// Get directory name for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load MCP configuration
const mcpConfigPath = path.join(__dirname, "..", "config", "mcp-config.json");
export const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));

// Environment schema
const envSchema = z.object({
  // MCP Configuration - Check this first to conditionally require other variables
  MCP_ENABLED: z.coerce.boolean().default(true),
  MCP_DEFAULT_SERVER: z.string().default("ows-governance"),
  MCP_API_KEY: z.string().optional(),

  // SpendOS / OWS Wallet Configuration
  OWS_API_KEY: z.string().optional(),
  OWS_EXTERNAL_WALLET_URL: z.string().url().optional(),
  OWS_EXTERNAL_WALLET_PRIVATE_KEY: z.string().optional(),

  // API Security and Authentication
  COGNIVERN_API_KEY: z.string().min(1),

  // Filecoin Configuration
  FILECOIN_ENABLED: z.coerce.boolean().default(false),
  FILECOIN_PRIVATE_KEY: z.string().optional(),
  FILECOIN_RPC_URL: z
    .string()
    .default("https://api.calibration.node.glif.io/rpc/v1"),
  GOVERNANCE_CONTRACT_ADDRESS: z.string().default(""),
  STORAGE_CONTRACT_ADDRESS: z.string().default(""),
  USDFC_TOKEN_ADDRESS: z
    .string()
    .default("0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"),
  SPARK_API_URL: z.string().default("https://api.filspark.com"),
  FILECOIN_NETWORK: z.enum(["mainnet", "calibration"]).default("calibration"),

  // Server Configuration
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Security
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

  // Provider Configuration
  OPENAI_API_KEY: z.string().default(""),
  MODEL_NAME: z.string().default("gpt-4"),
  GEMINI_API_KEY: z.string().optional(),

  // Governance Configuration
  DEFAULT_POLICY: z.string().default("standard"),

  // Mantle L2 (Agent Execution Layer)
  MANTLE_RPC_URL: z.string().default("https://rpc.mantle.xyz"),
  MANTLE_SEPOLIA_RPC_URL: z.string().default("https://rpc.sepolia.mantle.xyz"),
  MANTLE_PRIVATE_KEY: z.string().optional(),
  MANTLE_VAULT_ADDRESS: z.string().default(""),

  // Fhenix / CoFHE (Confidential Policy Evaluation)
  FHENIX_RPC_URL: z.string().default("https://sepolia-rollup.arbitrum.io/rpc"),
  FHENIX_SEPOLIA_RPC: z
    .string()
    .default("https://sepolia-rollup.arbitrum.io/rpc"),
  FHENIX_COFHE_URL: z.string().optional(),
  FHENIX_VERIFIER_URL: z.string().optional(),
  FHENIX_TN_URL: z.string().optional(),
  FHENIX_CHAIN_ID: z.coerce.number().default(421614),
  FHENIX_POLICY_CONTRACT: z.string().default(""),
  FHENIX_PRIVATE_KEY: z.string().optional(),
  FHENIX_EVALUATE_TIMEOUT_MS: z.coerce.number().default(30000),
  FHE_WATCHER_ENABLED: z.coerce.boolean().default(false),
  FHE_WATCHER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
});

// Parse and validate environment variables
const parseEnvVars = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`,
      );
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseEnvVars();

// Type for the configuration
export type Config = z.infer<typeof envSchema>;
