// Shared type definitions for Cognivern frontend and backend

/**
 * Canonical JSON envelope for every HTTP / agent response.
 *
 * This is the single source of truth for the wire response shape. Backend
 * helpers (`sendSuccess` / `sendError`) always populate `timestamp` at runtime;
 * the field is optional on the type so demo-mode shims and inline literals that
 * omit it still satisfy the contract. Prefer `message` for human-readable
 * success context and `error` for the error string — never both at once.
 *
 * @see src/backend/modules/api/response.ts (re-exports this type)
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface AuditLog {
  id: string;
  agentId: string;
  agent?: string; // human-readable agent name
  action: string;
  actionType?: string; // alias for action (backward compat)
  description: string;
  desc?: string; // short alias for description
  decision: "approved" | "denied" | "held";
  outcome?: "allowed" | "denied" | "held"; // alias for decision
  complianceStatus?: "compliant" | "non-compliant" | "pending";
  chain: string;
  timestamp: string;
  time?: string; // human-readable time string
  latency?: string;
  responseTime?: string; // alias for latency
  policyChecks?: PolicyCheck[];
  signingProvider?: "local" | "ledger" | "speculos" | "ows_remote";
  walletAddress?: string;
}

export interface PolicyCheck {
  policyId: string;
  result: boolean;
  reason: string;
  metadata?: Record<string, unknown>;
}

/** On-chain GovernanceProofV2 anchor receipt persisted on a run's evidence. */
export interface ProofAnchorReceipt {
  proofId: string;
  runIdHash: string;
  evidenceHash: string;
  policySetHash: string;
  txHash: string;
  blockNumber: number | null;
  chainId: number;
  /** Rail the proof was posted to (e.g. "0g-mainnet", "xlayer-mainnet"). */
  network: string;
}

/**
 * Unified run lifecycle status. Superset of the backend `CreRunStatus` so the
 * frontend read model never has to map away a value. `queued` and `cancelled`
 * are valid terminal/pre-active states the UI should tolerate even if older
 * data never produced them.
 */
export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused_for_approval'
  | 'cancelled'
  | 'completed'
  | 'failed';

/** Known status strings — shared with backend CreRunStatus by construction. */
const RUN_STATUSES: readonly RunStatus[] = [
  'queued',
  'running',
  'paused_for_approval',
  'cancelled',
  'completed',
  'failed',
];

/**
 * Coerce an arbitrary status string (e.g. from a backend `CreRun.status` or a
 * stale API payload) into a valid `RunStatus`. Unknown values collapse to
 * `'failed'` so the UI can never render an undefined badge. Use this at the
 * API/normalizer boundary instead of re-deriving validity per component.
 */
export function normalizeRunStatus(
  value: unknown,
  fallback: RunStatus = 'failed',
): RunStatus {
  if (typeof value === 'string' && (RUN_STATUSES as readonly string[]).includes(value)) {
    return value as RunStatus;
  }
  return fallback;
}

export interface Run {
  id: string;
  workflow: string;
  status: RunStatus;
  mode: string;
  steps: number;
  duration: string;
  artifacts: number;
  timestamp: string;
  events?: RunEvent[];
  evidence?: {
    traceId?: string;
    zeroGProofV2?: ProofAnchorReceipt;
    xlayerProofV2?: ProofAnchorReceipt;
  };
}

export interface RunEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Policy {
  id: string;
  name: string;
  type: string;
  description: string;
  status: "active" | "draft" | "inactive";
  agents: number;
  violations: number;
  rules?: PolicyRule[];
  metadata?: Record<string, unknown>;
}

export interface PolicyRule {
  id?: string;
  condition: string;
  action: "allow" | "deny" | "flag";
  params?: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: "registered" | "connected" | "active" | "paused" | "inactive";
  trades: number;
  budget: string;
  chain: string;
  spendHistory?: SpendEntry[];
  source?: "managed" | "external" | "sample" | "demo";
  walletAddress?: string;
  webhookUrl?: string;
}

export interface SpendEntry {
  amount: number;
  currency: string;
  timestamp: string;
  decision: string;
}

export interface FhenixConfidential {
  /** Preferred gate for confidential evaluation (FHE or TEE). */
  confidentialEvaluated?: boolean;
  fheEvaluated?: boolean;
  teeEvaluated?: boolean;
  evaluator?: 'flare' | 'fhenix' | string;
  mechanism?: 'tee' | 'fhe' | string;
  chain: string;
  chainId?: number;
  contractAddress?: string | null;
  explorerBase?: string;
  decisionIds?: string[];
  attestations?: string[];
  resolved?: boolean;
}

export interface GovernanceEvaluation {
  allowed: boolean;
  // The full three-outcome decision. "held" is between "approved" and
  // "denied": policy didn't block the action outright but flagged it for
  // operator review (the actual spend execution would pause). When omitted,
  // callers should fall back to `allowed` (legacy two-state contract).
  decision?: "approved" | "denied" | "held";
  reasoning: string;
  policyChecks: PolicyCheck[];
  auditLogId?: string;
  confidential?: FhenixConfidential;
  provider?: string;
  model?: string;
  timestamp: string;
  traceId?: string;
}

export interface IntentMetrics {
  totalIntents: number;
  successRate: number;
  averageLatency: number;
  topActions: ActionCount[];
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface AuditInsights {
  compliance: number;
  trends: Record<string, unknown>[];
}

// Spend request types
export interface SpendRequest {
  agentId: string;
  amount: number;
  currency: string;
  description: string;
}

export interface SpendPreviewRequest extends SpendRequest {}

export interface EncryptedSpendRequest {
  agentId: string;
  encryptedPayload: string;
  signature: string;
}

// Governance evaluation request
export interface GovernanceEvaluateRequest {
  agentId: string;
  action: {
    type: string;
    description: string;
    amount: number;
    currency: string;
  };
  policyId?: string;
}

// OWS types
export interface OwsWallet {
  id: string;
  name: string;
  chain: string;
  address: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OwsApiKey {
  id: string;
  walletId: string;
  key: string;
  scopes: string[];
  createdAt: string;
}

export interface BootstrapWalletRequest {
  name: string;
  chain: string;
}

export interface CreateApiKeyRequest {
  walletId: string;
  scopes: string[];
}

// Auth types
export interface AuthUser {
  id: string;
  walletAddress?: string;
  email?: string;
  emailVerified?: boolean;
  authMethod?: "wallet" | "email";
  createdAt: string;
  lastLoginAt: string;
}

export interface WorkspaceSettings {
  suspicionHoldThreshold?: number;
  webhookUrl?: string;
  /**
   * Preferred EVM execution rail id from the shared registry
   * (e.g. "xlayer-testnet"). Used when a wallet omits chainId.
   */
  defaultExecutionRail?: string;
  /**
   * Spend broadcast adapter when wallet metadata omits executionProvider.
   */
  defaultExecutionProvider?: "local" | "keeperhub" | "cleanverse";
  /**
   * Evidence sinks to fan out to. Omit / empty = platform defaults.
   * Ids: "zerog" | "filecoin".
   */
  evidenceSinks?: Array<"zerog" | "filecoin">;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  tier: "demo" | "live";
  role?: string;
  settings?: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyVersion {
  id: string;
  version: number;
  name: string;
  description: string;
  status: string;
  rules: PolicyRule[];
  snapshotAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  workspace: Workspace;
  expiresAt: string;
}

export interface NonceResponse {
  nonce: string;
}

export interface VerifyRequest {
  message: string;
  signature: string;
  address: string;
}

export interface VerifyResponse {
  token: string;
  user: AuthUser;
  workspace: Workspace;
}

// Email auth types
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
  email?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  workspace: Workspace;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface WalletConfig {
  address: string;
  chainId: number;
}

// API Key types
export type ApiKeyScope =
  | "agents:read"
  | "agents:write"
  | "governance:read"
  | "governance:write"
  | "audit:read"
  | "spend:execute";

/** TEE-sealed spend mandate attached to an API key ("key = sealed mandate"). */
export interface ApiKeyMandate {
  status: "pending" | "sealed" | "failed" | "unsupported";
  policyId: string;
  budgetUsd: string;
  perTxUsd: string;
  approvalThresholdUsd: string;
  sealedTxHash?: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  mandate?: ApiKeyMandate | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  /** Only present on mint; BYO import never returns the material back. */
  key?: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  imported?: boolean;
  mandate?: ApiKeyMandate | null;
}
