/**
 * Solana Settlement Service — governed SPL USDC transfers.
 *
 * The settlement leg of the compliance-on-payment rail: after a gate decides
 * an action may proceed, this service moves the USDC on Solana. Every
 * transfer is bounded by operator/mandate limits evaluated *before* broadcast.
 *
 * Safety model (all off-chain; no custom program is deployed):
 *   - Config is validated at construction and fails closed. A malformed env
 *     value (NaN cap, empty mint/RPC) never silently disables a guard.
 *   - Spend is reserved *before* the first await, so concurrent transfers
 *     cannot both pass the runway check.
 *   - An intent is journalled durably before broadcast. Replays of a
 *     confirmed intent return the recorded signature; replays of an
 *     in-flight/uncertain intent refuse to broadcast again.
 *   - A send we cannot classify is `uncertain`, never `failed` — the caller
 *     must reconcile, not retry blindly.
 *
 * Env:
 *   SOLANA_SETTLEMENT_ENABLED=true          — kill switch (default false)
 *   SOLANA_SETTLEMENT_PRIVATE_KEY=<base58>  — 64-byte ed25519 secret key
 *   SOLANA_RPC_URL=...                      — default per cluster
 *   SOLANA_CLUSTER=devnet|mainnet-beta|testnet — default devnet
 *   SOLANA_ALLOW_MAINNET=true               — required arming for mainnet-beta
 *   SOLANA_USDC_MINT=<base58>               — default per cluster
 *   SOLANA_SETTLEMENT_MAX_USD=0.05          — per-transfer cap
 *   SOLANA_SETTLEMENT_RUNWAY_USD=0.25       — cumulative cap per session
 *   SOLANA_SETTLEMENT_PAYEE_ALLOWLIST=a,b,c — empty = no transfers allowed
 *   SOLANA_SETTLEMENT_INTENT_FILE=...       — durable intent journal path
 *
 * Additive-only like the Telegraph rail: disabled ⇒ zero behavior change.
 */

import { createHash } from 'node:crypto';
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  type Signature,
  type TransactionSigner,
} from '@solana/kit';
import { base58 } from '@scure/base';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  SettlementIntentStore,
  settlementIntentStore,
  type SettlementIntentAttempt,
  type SettlementIntentRecord,
} from './SettlementIntentStore.js';

export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_DECIMALS = 6;
/**
 * SOL kept aside for transaction fees plus one payee ATA rent deposit
 * (~0.00204 SOL). The ATA rent is not recovered when the payee keeps the
 * account, so it is a real cost of the first transfer to a new payee.
 */
const FEE_RESERVE_SOL = 0.01;

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet';

const USDC_MINT_BY_CLUSTER: Record<SolanaCluster, string | null> = {
  'mainnet-beta': MAINNET_USDC_MINT,
  devnet: DEVNET_USDC_MINT,
  // Solana testnet has no canonical USDC mint; require an explicit override.
  testnet: null,
};

const DEFAULT_RPC_BY_CLUSTER: Record<SolanaCluster, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

export interface SolanaSettlementConfig {
  enabled?: boolean;
  rpcUrl?: string;
  privateKey?: string;
  usdcMint?: string;
  cluster?: SolanaCluster;
  /** Mainnet-beta refuses to arm without this being explicitly true. */
  allowMainnet?: boolean;
  maxTransferUsd?: number;
  payeeAllowlist?: string[];
  runwayUsd?: number;
}

export type SettlementErrorCode =
  | 'disabled'
  | 'not_ready'
  | 'policy'
  | 'insufficient_funds'
  | 'rpc'
  | 'invalid_input'
  | 'intent_conflict'
  | 'uncertain'
  | 'already_failed';

export class SolanaSettlementError extends Error {
  constructor(
    readonly code: SettlementErrorCode,
    message: string,
    readonly violations?: string[],
  ) {
    super(message);
    this.name = 'SolanaSettlementError';
  }
}

/**
 * The bounds a single intent is evaluated against. `env` is the default;
 * the controller replaces it with the workspace mandate's bounds when the
 * request names one.
 */
export interface SettlementLimits {
  maxTransferUsd: number;
  runwayUsd: number;
  payeeAllowlist: string[];
  policySource: 'env' | 'funded_mandate';
  mandateId?: string;
}

export interface SettlementRequest {
  intentId: string;
  workspaceId: string;
  payee: string;
  amountUsd: number;
  mandateId?: string;
}

export interface SettlementResult {
  rail: 'solana';
  status: 'settled';
  cluster: SolanaCluster;
  mint: string;
  payee: string;
  payer: string;
  amountUsd: number;
  amountBaseUnits: string;
  signature: string;
  explorerUrl: string;
  confirmationStatus: 'confirmed' | 'finalized';
  idempotentReplay?: boolean;
}

export interface SettlementGuardResult {
  allowed: boolean;
  violations: string[];
}

export interface SettlementStatus {
  enabled: boolean;
  ready: boolean;
  cluster: SolanaCluster;
  payer: string | null;
  mint: string;
  solBalance: number | null;
  usdcBalance: number | null;
  spentUsd: number;
  pendingUsd: number;
  runwayUsd: number;
  maxTransferUsd: number;
  payeeAllowlist: string[];
  configErrors: string[];
  warnings: string[];
}

/** Result of the pre-screen readiness probe — never throws. */
export interface SettlementPreflight {
  ready: boolean;
  violations: string[];
  warnings: string[];
  payer: string | null;
  solBalance: number | null;
  usdcBalance: number | null;
}

type ResolvedConfig = Required<Omit<SolanaSettlementConfig, 'privateKey'>> &
  Pick<SolanaSettlementConfig, 'privateKey'>;

/**
 * Injection points. Production uses the defaults; tests supply a fake RPC and
 * a locally generated signer so the broadcast path runs without a funded key.
 */
export interface SolanaSettlementDeps {
  store?: SettlementIntentStore;
  createRpc?: (url: string) => ReturnType<typeof createSolanaRpc>;
  signer?: TransactionSigner;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function envText(name: string): string | undefined {
  const raw = process.env[name];
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
}

function clusterOrDefault(value: string | undefined, errors: string[]): SolanaCluster {
  if (value === undefined) return 'devnet';
  if (value === 'mainnet-beta' || value === 'devnet' || value === 'testnet') {
    return value;
  }
  errors.push(`SOLANA_CLUSTER must be mainnet-beta | devnet | testnet (got "${value}")`);
  return 'devnet';
}

function positiveOrDefault(
  name: string,
  provided: number | undefined,
  raw: string | undefined,
  fallback: number,
  errors: string[],
): number {
  if (provided !== undefined) {
    if (!Number.isFinite(provided) || provided <= 0) {
      errors.push(`${name} must be a positive number (got "${provided}")`);
      return Number.NaN;
    }
    return provided;
  }
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive number (got "${raw}")`);
    return Number.NaN;
  }
  return parsed;
}

export function usdToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
}

/** Cheap base58/length check used by the controller before the paid screen. */
export function isValidSolanaAddress(value: string): boolean {
  try {
    address(value);
    return true;
  } catch {
    return false;
  }
}

export function explorerUrl(signature: string, cluster: SolanaCluster): string {
  const base = `https://solscan.io/tx/${signature}`;
  return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`;
}

/** Pure guard evaluation — the same checks run before every broadcast. */
export function evaluateSettlementGuards(opts: {
  intent: { payee: string; amountUsd: number };
  maxTransferUsd: number;
  payeeAllowlist: string[];
  runwayUsd: number;
  spentUsd: number;
  /** Reserved-but-not-yet-settled spend from concurrent attempts. */
  pendingUsd?: number;
  configErrors?: string[];
}): SettlementGuardResult {
  const violations: string[] = [];
  const {
    intent,
    maxTransferUsd,
    payeeAllowlist,
    runwayUsd,
    spentUsd,
    pendingUsd = 0,
    configErrors = [],
  } = opts;

  // A malformed limit disables comparisons (NaN compares false), so surface
  // it as an explicit violation instead of letting the guard pass.
  for (const error of configErrors) violations.push(`invalid settlement config: ${error}`);

  if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
    violations.push(`invalid amountUsd ${intent.amountUsd}`);
  }
  if (!Number.isFinite(maxTransferUsd)) {
    violations.push('per-transfer cap is not configured');
  } else if (intent.amountUsd > maxTransferUsd) {
    violations.push(`amount ${intent.amountUsd} exceeds per-transfer cap ${maxTransferUsd}`);
  }
  if (payeeAllowlist.length === 0) {
    violations.push('payee allowlist is empty — no payee permitted');
  } else if (!payeeAllowlist.includes(intent.payee)) {
    violations.push(`payee ${intent.payee} not in allowlist`);
  }
  if (!Number.isFinite(runwayUsd)) {
    violations.push('session runway is not configured');
  } else if (spentUsd + pendingUsd + intent.amountUsd > runwayUsd) {
    violations.push(
      `transfer would exceed session runway ${runwayUsd} ` +
        `(spent ${spentUsd}, pending ${pendingUsd})`,
    );
  }
  return { allowed: violations.length === 0, violations };
}

interface Reservation {
  scope: string;
  amountUsd: number;
}

interface ScopeSpend {
  spent: number;
  pending: number;
}

function requestHashOf(parts: {
  workspaceId: string;
  cluster: SolanaCluster;
  mint: string;
  payee: string;
  amountBaseUnits: bigint;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        parts.workspaceId,
        parts.cluster,
        parts.mint,
        parts.payee,
        parts.amountBaseUnits.toString(),
      ]),
    )
    .digest('hex');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Redact provider credentials from an RPC URL. Handles both the query form
 * (`?api-key=...`) and the path-token form (`/<long-opaque-token>/`).
 */
export function redactRpcUrl(url: string): string {
  return url
    .replace(/([?&](?:api[-_]?key|token|secret|auth|access[-_]?token)=)[^&#]+/gi, '$1[redacted]')
    .replace(/\/([A-Za-z0-9_-]{24,})(?=\/|$)/g, '/[redacted]');
}

function looksLikeInsufficientFunds(error: unknown): boolean {
  if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS)) {
    return true;
  }
  const context = (error as { context?: unknown } | null)?.context;
  const parts = [errorMessage(error), JSON.stringify(context ?? '')];
  // Token-program insufficiency and system-program "no prior credit" both
  // mean the payer cannot fund the transfer (USDC, SOL fees, or ATA rent).
  return parts.some((value) =>
    /insufficient (funds|lamports)|no record of a prior credit/i.test(value),
  );
}

export class SolanaSettlementService {
  private config: ResolvedConfig;
  private readonly configErrors: string[] = [];
  private readonly warnings: string[] = [];
  private readonly store: SettlementIntentStore;
  private readonly createRpc: (url: string) => ReturnType<typeof createSolanaRpc>;
  private readonly injectedSigner: TransactionSigner | null;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private signerPromise: Promise<TransactionSigner> | null = null;
  private readonly spendByScope = new Map<string, ScopeSpend>();
  private readonly inFlight = new Map<string, Promise<SettlementResult>>();
  /** Guards the controller's debit path against concurrent replays. */
  private readonly debitLocks = new Map<string, Promise<void>>();
  /** Set once runway totals have been rehydrated from the durable journal. */
  private runwayRehydrated = false;

  constructor(config?: SolanaSettlementConfig, deps: SolanaSettlementDeps = {}) {
    this.store = deps.store ?? settlementIntentStore;
    this.createRpc = deps.createRpc ?? createSolanaRpc;
    this.injectedSigner = deps.signer ?? null;
    this.now = deps.now ?? (() => Date.now());
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    const cluster = clusterOrDefault(
      config?.cluster ?? envText('SOLANA_CLUSTER'),
      this.configErrors,
    );
    const usdcMint =
      config?.usdcMint ?? envText('SOLANA_USDC_MINT') ?? USDC_MINT_BY_CLUSTER[cluster];
    if (!usdcMint) {
      this.configErrors.push(
        'SOLANA_USDC_MINT is required for cluster testnet (no canonical mint)',
      );
    }

    const maxTransferUsd = positiveOrDefault(
      'SOLANA_SETTLEMENT_MAX_USD',
      config?.maxTransferUsd,
      envText('SOLANA_SETTLEMENT_MAX_USD'),
      0.05,
      this.configErrors,
    );
    const runwayUsd = positiveOrDefault(
      'SOLANA_SETTLEMENT_RUNWAY_USD',
      config?.runwayUsd,
      envText('SOLANA_SETTLEMENT_RUNWAY_USD'),
      0.25,
      this.configErrors,
    );
    if (
      Number.isFinite(maxTransferUsd) &&
      Number.isFinite(runwayUsd) &&
      maxTransferUsd > runwayUsd
    ) {
      // A per-transfer cap above the cumulative runway is always a
      // misconfiguration: the first transfer could never fit.
      this.configErrors.push(
        `SOLANA_SETTLEMENT_MAX_USD (${maxTransferUsd}) exceeds SOLANA_SETTLEMENT_RUNWAY_USD (${runwayUsd})`,
      );
    }

    const enabled = config?.enabled ?? process.env.SOLANA_SETTLEMENT_ENABLED === 'true';
    const privateKey = config?.privateKey ?? envText('SOLANA_SETTLEMENT_PRIVATE_KEY');
    const allowMainnet = config?.allowMainnet ?? process.env.SOLANA_ALLOW_MAINNET === 'true';

    this.config = {
      enabled,
      cluster,
      privateKey,
      allowMainnet,
      rpcUrl: config?.rpcUrl ?? envText('SOLANA_RPC_URL') ?? DEFAULT_RPC_BY_CLUSTER[cluster],
      usdcMint: usdcMint ?? '',
      maxTransferUsd,
      payeeAllowlist:
        config?.payeeAllowlist ??
        (envText('SOLANA_SETTLEMENT_PAYEE_ALLOWLIST') ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      runwayUsd,
    };

    if (enabled && !privateKey && !this.injectedSigner) {
      this.configErrors.push('SOLANA_SETTLEMENT_PRIVATE_KEY is not configured');
    }
    if (enabled && this.config.payeeAllowlist.length === 0) {
      // Valid but inert: every intent is blocked. Surface the reason so an
      // operator does not debug a phantom "policy" denial.
      this.warnings.push('payee allowlist is empty — settlements are blocked');
    }
    if (enabled && this.config.rpcUrl.trim() === '') {
      this.configErrors.push('SOLANA_RPC_URL is empty');
    }
    if (cluster === 'mainnet-beta' && !allowMainnet) {
      // Real USDC is irreversible; require a second, explicit arming flag so a
      // stray SOLANA_CLUSTER change cannot move mainnet funds.
      this.configErrors.push('SOLANA_CLUSTER=mainnet-beta requires SOLANA_ALLOW_MAINNET=true');
    }
  }

  getEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): ResolvedConfig {
    return {
      ...this.config,
      privateKey: this.config.privateKey ? '[redacted]' : undefined,
      // RPC URLs often carry provider API keys in a query parameter or as a
      // path token (e.g. https://<org>.quiknode.pro/<token>/). Never hand
      // either form to a caller.
      rpcUrl: redactRpcUrl(this.config.rpcUrl),
    };
  }

  getConfigErrors(): string[] {
    return [...this.configErrors];
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  defaultLimits(): SettlementLimits {
    return {
      maxTransferUsd: this.config.maxTransferUsd,
      runwayUsd: this.config.runwayUsd,
      payeeAllowlist: this.config.payeeAllowlist,
      policySource: 'env',
    };
  }

  private getRpc() {
    return this.createRpc(this.config.rpcUrl);
  }

  private async getSigner(): Promise<TransactionSigner> {
    if (this.injectedSigner) return this.injectedSigner;
    if (!this.config.privateKey) {
      throw new SolanaSettlementError('not_ready', 'SOLANA_SETTLEMENT_PRIVATE_KEY not configured');
    }
    this.signerPromise ??= (async () => {
      const secretKey = base58.decode(this.config.privateKey!);
      if (secretKey.length !== 64) {
        throw new SolanaSettlementError(
          'not_ready',
          `settlement key must be a 64-byte secret key (got ${secretKey.length} bytes)`,
        );
      }
      return createKeyPairSignerFromBytes(secretKey);
    })().catch((error) => {
      // Never cache a rejected key: a fixed env value must be able to recover
      // without restarting the process.
      this.signerPromise = null;
      throw error;
    });
    return this.signerPromise;
  }

  /**
   * Pre-screen readiness probe. The Telegraph leg calls this *before* buying
   * intelligence: an unarmed rail, an unreadable key, or an unfunded payer
   * blocks the call with evidence instead of spending on a screen that can
   * never settle.
   */
  async preflight(
    intent: { payee: string; amountUsd: number },
    limits: SettlementLimits = this.defaultLimits(),
    workspaceId = 'public',
  ): Promise<SettlementPreflight> {
    const violations: string[] = [];
    const warnings = [...this.warnings];

    if (!this.config.enabled) {
      violations.push('SOLANA_SETTLEMENT_ENABLED is not true');
    }
    for (const error of this.configErrors) {
      violations.push(`invalid settlement config: ${error}`);
    }
    const guards = this.evaluateGuards(intent, limits, workspaceId);
    violations.push(...guards.violations);

    if (violations.length > 0) {
      return {
        ready: false,
        violations,
        warnings,
        payer: null,
        solBalance: null,
        usdcBalance: null,
      };
    }

    let payer: string | null = null;
    let solBalance: number | null = null;
    let usdcBalance: number | null = null;
    let tokenReadError: string | null = null;
    try {
      const signer = await this.getSigner();
      payer = signer.address;
      const rpc = this.getRpc();
      const [payerAta] = await findAssociatedTokenPda({
        mint: address(this.config.usdcMint),
        owner: signer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const [sol, token] = await Promise.allSettled([
        rpc.getBalance(signer.address).send(),
        rpc.getTokenAccountBalance(payerAta).send(),
      ]);
      if (sol.status === 'fulfilled') solBalance = Number(sol.value.value) / 1e9;
      if (token.status === 'fulfilled') {
        usdcBalance = token.value.value.uiAmount ?? null;
      } else {
        tokenReadError = errorMessage(token.reason);
      }
    } catch (error) {
      violations.push(`settlement payer unavailable: ${errorMessage(error)}`);
      return { ready: false, violations, warnings, payer, solBalance, usdcBalance };
    }

    if (solBalance === null) {
      violations.push('could not read the settlement payer SOL balance');
    } else if (solBalance < FEE_RESERVE_SOL) {
      violations.push(
        `payer SOL balance ${solBalance} is below the ${FEE_RESERVE_SOL} SOL fee/rent reserve`,
      );
    }
    if (usdcBalance === null) {
      // A missing ATA and an unreachable RPC are different problems: only the
      // first is expected for a wallet that has never held this mint.
      const missingAta =
        tokenReadError === null ||
        /could not find|not found|invalid param|account not found/i.test(tokenReadError);
      violations.push(
        missingAta
          ? 'settlement payer has no USDC token account for the configured mint'
          : `could not read the settlement payer USDC balance: ${tokenReadError}`,
      );
    } else if (usdcBalance + 1e-9 < intent.amountUsd) {
      violations.push(
        `payer USDC balance ${usdcBalance} is below the requested ${intent.amountUsd}`,
      );
    }

    return {
      ready: violations.length === 0,
      violations,
      warnings,
      payer,
      solBalance,
      usdcBalance,
    };
  }

  /** Recorded state for one intent — used by status/reconciliation paths. */
  async getIntentStatus(
    workspaceId: string,
    intentId: string,
  ): Promise<SettlementIntentRecord | null> {
    return this.store.getIntent(`${workspaceId}:${intentId}`);
  }

  /**
   * Reconcile an uncertain (or stuck sent/pending) intent against the chain.
   * The recorded signature is verified on-chain before any state change: an
   * operator's word is never the source of truth.
   *
   *   - confirmed on-chain  → record flips to confirmed (replayable, debitable)
   *   - failed on-chain     → record flips to failed/retryable (intent reusable)
   *   - not yet visible     → left untouched; the caller may retry later
   *   - no signature        → cannot verify; left untouched
   *
   * Returns the (possibly unchanged) record so callers can report the outcome.
   */
  async reconcileIntent(
    workspaceId: string,
    intentId: string,
  ): Promise<SettlementIntentRecord | null> {
    const key = `${workspaceId}:${intentId}`;
    const record = await this.store.getIntent(key);
    if (!record) return null;
    if (record.status === 'confirmed' || record.status === 'failed') return record;
    if (!record.signature) return record;

    try {
      const rpc = this.getRpc();
      const { value: statuses } = await rpc
        .getSignatureStatuses([record.signature as Signature])
        .send();
      const status = statuses[0];
      if (!status) return record; // not yet seen by the cluster — leave it
      if (status.err) {
        const reason = `reconciled: transaction ${record.signature} failed on-chain: ${JSON.stringify(status.err)}`;
        await this.store.setIntent(key, {
          ...record,
          status: 'failed',
          retryable: true,
          reason,
          attempts: [
            ...(record.attempts ?? []),
            { atMs: this.now(), status: 'failed', reason, signature: record.signature },
          ],
        });
      } else if (
        status.confirmationStatus === 'confirmed' ||
        status.confirmationStatus === 'finalized'
      ) {
        const confirmationStatus = status.confirmationStatus;
        await this.store.setIntent(key, {
          ...record,
          status: 'confirmed',
          confirmationStatus,
          explorerUrl: record.explorerUrl ?? explorerUrl(record.signature, this.config.cluster),
        });
      }
      // processed-but-unconfirmed: leave as-is and let a later pass decide.
      return this.store.getIntent(key);
    } catch (error) {
      // An RPC problem during reconciliation must not corrupt the record.
      throw new SolanaSettlementError(
        'rpc',
        `reconciliation failed: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Serialize the mandate-debit bookkeeping per intent. The controller's
   * read-flag → debit → mark-flag sequence is not atomic across concurrent
   * replays; this lock makes the whole sequence single-flight per intent.
   */
  async runMandateDebitExclusive(
    workspaceId: string,
    intentId: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const key = `${workspaceId}:${intentId}`;
    const prior = this.debitLocks.get(key) ?? Promise.resolve();
    const next = prior.then(fn, fn);
    this.debitLocks.set(
      key,
      next.catch(() => undefined),
    );
    await next.finally(() => {
      if (this.debitLocks.get(key) === next) this.debitLocks.delete(key);
    });
  }

  /**
   * Record that a confirmed transfer was debited against a funded mandate.
   * Replay paths read this flag so a replayed intentId never debits twice.
   */
  async markMandateDebited(workspaceId: string, intentId: string): Promise<void> {
    const key = `${workspaceId}:${intentId}`;
    const record = await this.store.getIntent(key);
    if (!record || record.mandateDebited) return;
    await this.store.setIntent(key, { ...record, mandateDebited: true });
  }

  private scopeKey(workspaceId: string, limits: SettlementLimits): string {
    return `${workspaceId}:${limits.mandateId ?? 'env'}`;
  }

  /**
   * Rebuild the in-memory runway counters from the durable journal. The
   * journal is the source of truth across process restarts; without this a
   * restarted process would start with a fresh runway and could exceed the
   * cumulative cap across restarts. Runs once, lazily, before any guard
   * evaluation that reads spend totals.
   */
  private async ensureRunwayRehydrated(): Promise<void> {
    if (this.runwayRehydrated) return;
    this.runwayRehydrated = true;
    try {
      const entries = await this.store.entries();
      for (const [key, stored] of entries) {
        const record = stored.data;
        // Scope by the mandate recorded on the intent itself — the key's
        // tail is the intentId, not the mandateId.
        const scope = `${record.workspaceId}:${record.mandateId ?? 'env'}`;
        const spend = this.spendFor(scope);
        if (record.status === 'confirmed') {
          this.spendByScope.set(scope, { spent: spend.spent + record.amountUsd, pending: spend.pending });
        } else if (record.status === 'pending' || record.status === 'sent' || record.status === 'uncertain') {
          // An unfinished intent from a previous process still holds its
          // reservation: it may have landed, so the runway must stay held.
          this.spendByScope.set(scope, { spent: spend.spent, pending: spend.pending + record.amountUsd });
        }
      }
    } catch {
      // Journal unreadable: leave counters at zero but re-arm so a later
      // call retries rather than silently trusting an empty runway forever.
      this.runwayRehydrated = false;
    }
  }

  private spendFor(scope: string): ScopeSpend {
    return this.spendByScope.get(scope) ?? { spent: 0, pending: 0 };
  }

  evaluateGuards(
    intent: { payee: string; amountUsd: number },
    limits: SettlementLimits = this.defaultLimits(),
    workspaceId = 'public',
  ): SettlementGuardResult {
    const spend = this.spendFor(this.scopeKey(workspaceId, limits));
    return evaluateSettlementGuards({
      intent,
      maxTransferUsd: limits.maxTransferUsd,
      payeeAllowlist: limits.payeeAllowlist,
      runwayUsd: limits.runwayUsd,
      spentUsd: spend.spent,
      pendingUsd: spend.pending,
      configErrors: this.configErrors,
    });
  }

  /**
   * Synchronous reservation: guard + pending increment happen in the same
   * tick, before any await, so two concurrent transfers cannot both pass the
   * runway check.
   */
  reserveSpend(
    intent: { payee: string; amountUsd: number },
    limits: SettlementLimits,
    workspaceId: string,
  ): { ok: true; reservation: Reservation } | { ok: false; violations: string[] } {
    const scope = this.scopeKey(workspaceId, limits);
    const spend = this.spendFor(scope);
    const guards = evaluateSettlementGuards({
      intent,
      maxTransferUsd: limits.maxTransferUsd,
      payeeAllowlist: limits.payeeAllowlist,
      runwayUsd: limits.runwayUsd,
      spentUsd: spend.spent,
      pendingUsd: spend.pending,
      configErrors: this.configErrors,
    });
    if (!guards.allowed) return { ok: false, violations: guards.violations };
    this.spendByScope.set(scope, {
      spent: spend.spent,
      pending: spend.pending + intent.amountUsd,
    });
    return { ok: true, reservation: { scope, amountUsd: intent.amountUsd } };
  }

  /**
   * Rehydrate the runway from the journal before a transfer reserves spend,
   * so a restarted process inherits the cumulative spend of its predecessors.
   * Must run before `reserveSpend` (which is synchronous and cannot await).
   */
  private async rehydrateBeforeReserve(): Promise<void> {
    await this.ensureRunwayRehydrated();
  }

  private async releaseReservation(reservation: Reservation): Promise<void> {
    await this.ensureRunwayRehydrated();
    const spend = this.spendFor(reservation.scope);
    this.spendByScope.set(reservation.scope, {
      spent: spend.spent,
      pending: Math.max(0, spend.pending - reservation.amountUsd),
    });
  }

  private async commitReservation(reservation: Reservation): Promise<void> {
    await this.ensureRunwayRehydrated();
    const spend = this.spendFor(reservation.scope);
    this.spendByScope.set(reservation.scope, {
      spent: spend.spent + reservation.amountUsd,
      pending: Math.max(0, spend.pending - reservation.amountUsd),
    });
  }

  async getStatus(): Promise<SettlementStatus> {
    const totals = Array.from(this.spendByScope.values()).reduce(
      (acc, value) => ({
        spent: acc.spent + value.spent,
        pending: acc.pending + value.pending,
      }),
      { spent: 0, pending: 0 },
    );
    const base: SettlementStatus = {
      enabled: this.config.enabled,
      ready: false,
      cluster: this.config.cluster,
      payer: null,
      mint: this.config.usdcMint,
      solBalance: null,
      usdcBalance: null,
      spentUsd: totals.spent,
      pendingUsd: totals.pending,
      runwayUsd: this.config.runwayUsd,
      maxTransferUsd: this.config.maxTransferUsd,
      payeeAllowlist: this.config.payeeAllowlist,
      configErrors: [...this.configErrors],
      warnings: [...this.warnings],
    };
    if (
      !this.config.enabled ||
      (!this.config.privateKey && !this.injectedSigner) ||
      this.configErrors.length > 0
    ) {
      return base;
    }

    try {
      const signer = await this.getSigner();
      base.payer = signer.address;
      const rpc = this.getRpc();
      const [payerAta] = await findAssociatedTokenPda({
        mint: address(this.config.usdcMint),
        owner: signer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const [sol, token] = await Promise.allSettled([
        rpc.getBalance(signer.address).send(),
        rpc.getTokenAccountBalance(payerAta).send(),
      ]);
      if (sol.status === 'fulfilled') base.solBalance = Number(sol.value.value) / 1e9;
      if (token.status === 'fulfilled') base.usdcBalance = token.value.value.uiAmount ?? null;
      // Balance readability is part of readiness; preflight remains the
      // authoritative gate and also enforces the fee reserve and amount.
      base.ready = base.solBalance !== null && base.usdcBalance !== null;
    } catch {
      base.ready = false;
    }
    return base;
  }

  /**
   * Build the transfer instructions (payee ATA create-if-missing + checked
   * transfer). Pure assembly — separated so the send path stays thin and the
   * instruction set is unit-testable without an RPC.
   *
   * Note: the first transfer to a *new* payee also pays ~0.00204 SOL of ATA
   * rent, which is not recoverable here and is not part of the USDC caps.
   */
  async buildTransferInstructions(opts: {
    payer: TransactionSigner;
    intent: { payee: string; amountUsd: number };
  }) {
    const mint = address(this.config.usdcMint);
    const [source] = await findAssociatedTokenPda({
      mint,
      owner: opts.payer.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [destination] = await findAssociatedTokenPda({
      mint,
      owner: address(opts.intent.payee),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const createAta = getCreateAssociatedTokenIdempotentInstruction({
      payer: opts.payer,
      ata: destination,
      owner: address(opts.intent.payee),
      mint,
    });
    const transfer = getTransferCheckedInstruction({
      source,
      mint,
      destination,
      authority: opts.payer,
      amount: usdToBaseUnits(opts.intent.amountUsd),
      decimals: USDC_DECIMALS,
    });
    return { instructions: [createAta, transfer], source, destination };
  }

  async executeTransfer(
    request: SettlementRequest,
    opts: { limits?: SettlementLimits } = {},
  ): Promise<SettlementResult> {
    if (!request.intentId || request.intentId.trim() === '') {
      throw new SolanaSettlementError(
        'invalid_input',
        'intentId is required for an idempotent settlement',
      );
    }
    if (!request.workspaceId || request.workspaceId.trim() === '') {
      throw new SolanaSettlementError('invalid_input', 'workspaceId is required');
    }

    const key = `${request.workspaceId}:${request.intentId}`;
    const running = this.inFlight.get(key);
    if (running) {
      const result = await running;
      return { ...result, idempotentReplay: true };
    }

    const promise = this.executeTransferInner(request, opts).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  private async executeTransferInner(
    request: SettlementRequest,
    opts: { limits?: SettlementLimits },
  ): Promise<SettlementResult> {
    const key = `${request.workspaceId}:${request.intentId}`;
    if (!this.config.enabled) {
      throw new SolanaSettlementError('disabled', 'Solana settlement is not enabled');
    }
    if (this.configErrors.length > 0) {
      throw new SolanaSettlementError(
        'not_ready',
        `Solana settlement config invalid: ${this.configErrors.join('; ')}`,
        this.configErrors,
      );
    }
    try {
      address(request.payee); // throws on malformed base58
    } catch {
      throw new SolanaSettlementError('invalid_input', 'invalid payee address');
    }

    const limits: SettlementLimits = {
      ...(opts.limits ?? this.defaultLimits()),
      ...(request.mandateId && !opts.limits?.mandateId ? { mandateId: request.mandateId } : {}),
    };
    // Runway counters must reflect prior processes before the synchronous
    // reservation runs: reserveSpend cannot await, so this happens first.
    await this.rehydrateBeforeReserve();
    const amountBaseUnits = usdToBaseUnits(request.amountUsd);
    const hash = requestHashOf({
      workspaceId: request.workspaceId,
      cluster: this.config.cluster,
      mint: this.config.usdcMint,
      payee: request.payee,
      amountBaseUnits,
    });

    const existing = await this.store.getIntent(key);
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new SolanaSettlementError(
          'intent_conflict',
          `intentId ${request.intentId} is already bound to a different transfer`,
        );
      }
      if (existing.status === 'confirmed' && existing.signature) {
        return {
          rail: 'solana',
          status: 'settled',
          cluster: this.config.cluster,
          mint: existing.mint,
          payee: existing.payee,
          payer: existing.payer ?? '',
          amountUsd: existing.amountUsd,
          amountBaseUnits: existing.amountBaseUnits,
          signature: existing.signature,
          explorerUrl: existing.explorerUrl ?? explorerUrl(existing.signature, this.config.cluster),
          confirmationStatus:
            existing.confirmationStatus === 'finalized' ? 'finalized' : 'confirmed',
          idempotentReplay: true,
        };
      }
      if (
        existing.status === 'pending' ||
        existing.status === 'sent' ||
        existing.status === 'uncertain'
      ) {
        throw new SolanaSettlementError(
          'uncertain',
          `intent ${request.intentId} is ${existing.status}; refusing to broadcast again` +
            (existing.signature ? ` (signature ${existing.signature})` : ''),
        );
      }
      if (existing.status === 'failed' && existing.retryable !== true) {
        throw new SolanaSettlementError(
          'already_failed',
          `intent ${request.intentId} already failed: ${existing.reason ?? 'unknown'}`,
        );
      }
      // failed + retryable: fall through and create a new attempt.
    }

    const reservationResult = this.reserveSpend(request, limits, request.workspaceId);
    if (!reservationResult.ok) {
      throw new SolanaSettlementError(
        'policy',
        `settlement blocked by guards: ${reservationResult.violations.join('; ')}`,
        reservationResult.violations,
      );
    }
    const reservation = reservationResult.reservation;
    const now = this.now();
    // Preserve the audit trail of prior failed attempts on this intentId:
    // the new pending record replaces the old one, so the history must ride
    // along or the retry erases what went wrong before.
    const priorAttempts: SettlementIntentAttempt[] = existing?.attempts ?? [];
    const baseRecord: SettlementIntentRecord = {
      intentId: request.intentId,
      workspaceId: request.workspaceId,
      status: 'pending',
      requestHash: hash,
      cluster: this.config.cluster,
      mint: this.config.usdcMint,
      payee: request.payee,
      amountUsd: request.amountUsd,
      amountBaseUnits: amountBaseUnits.toString(),
      mandateId: request.mandateId ?? null,
      attempts: priorAttempts,
      createdAtMs: now,
      updatedAtMs: now,
    };

    /**
     * Append this attempt's outcome to the record's history and write it.
     * Never throws into the caller: history loss must not mask the real
     * settlement error.
     */
    const recordAttempt = async (
      status: 'failed' | 'uncertain',
      detail: {
        reason: string;
        signature?: string | null;
        payer?: string | null;
      },
    ): Promise<void> => {
      const attempt: SettlementIntentAttempt = {
        atMs: this.now(),
        status,
        reason: detail.reason,
        signature: detail.signature ?? null,
      };
      await this.store
        .setIntent(key, {
          ...baseRecord,
          status,
          // failed = provably not moved (retryable); uncertain = may have
          // landed, so replay must not broadcast again.
          retryable: status === 'failed',
          payer: detail.payer ?? baseRecord.payer ?? null,
          signature: detail.signature ?? null,
          explorerUrl:
            detail.signature != null
              ? explorerUrl(detail.signature, this.config.cluster)
              : null,
          reason: detail.reason,
          attempts: [...(baseRecord.attempts ?? []), attempt],
        })
        .catch(() => undefined);
    };

    let committed = false;
    try {
      // Journal before broadcast. If the journal is unavailable we must not
      // move money — an untracked transfer is a double-pay waiting to happen.
      try {
        await this.store.setIntent(key, baseRecord);
      } catch (error) {
        throw new SolanaSettlementError(
          'not_ready',
          `settlement intent journal unavailable: ${errorMessage(error)}`,
        );
      }

      const signer = await this.getSigner();
      const rpc = this.getRpc();
      const { instructions } = await this.buildTransferInstructions({
        payer: signer,
        intent: request,
      });

      let signature: string;
      try {
        const { value: latestBlockhash } = await rpc
          .getLatestBlockhash({ commitment: 'confirmed' })
          .send();
        const message = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayerSigner(signer, tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions(instructions, tx),
        );
        const signed = await signTransactionMessageWithSigners(message);
        signature = getSignatureFromTransaction(signed);

        // Record the signature before handing the tx to the network: if the
        // response is lost, the next replay can still be reconciled.
        await this.store
          .setIntent(key, {
            ...baseRecord,
            status: 'sent',
            payer: signer.address,
            signature,
            explorerUrl: explorerUrl(signature, this.config.cluster),
          })
          .catch(() => undefined);

        try {
          await rpc
            .sendTransaction(getBase64EncodedWireTransaction(signed), {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
              maxRetries: BigInt(3),
            })
            .send();
        } catch (error) {
          if (
            isSolanaError(
              error,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
            )
          ) {
            // Preflight simulation failed: the transaction was never sent.
            const reason = errorMessage(error);
            await recordAttempt('failed', { reason, payer: signer.address });
            if (looksLikeInsufficientFunds(error)) {
              throw new SolanaSettlementError(
                'insufficient_funds',
                'payer lacks the USDC (or SOL for fees/ATA rent) to settle',
              );
            }
            throw new SolanaSettlementError('rpc', `settlement preflight failed: ${reason}`);
          }
          // We have a signed transaction and cannot prove it was not received.
          const reason = errorMessage(error);
          await recordAttempt('uncertain', { reason, signature });
          throw new SolanaSettlementError(
            'uncertain',
            `transaction ${signature} may have been sent (${reason}); check explorer before retrying`,
          );
        }

        // Confirm via signature status — bounded poll, no websocket dependency.
        const deadline = this.now() + 45_000;
        let confirmationStatus: 'confirmed' | 'finalized' | null = null;
        while (this.now() < deadline) {
          const { value: statuses } = await rpc
            .getSignatureStatuses([signature as Signature])
            .send();
          const status = statuses[0];
          if (status?.err) {
            const reason = `transaction ${signature} failed on-chain: ${JSON.stringify(status.err)}`;
            // The tx landed and failed: no USDC moved, so a new attempt with
            // the same intentId is safe.
            await recordAttempt('failed', { reason, signature });
            throw new SolanaSettlementError('rpc', reason);
          }
          if (
            status?.confirmationStatus === 'confirmed' ||
            status?.confirmationStatus === 'finalized'
          ) {
            confirmationStatus = status.confirmationStatus;
            break;
          }
          await this.sleep(1_500);
        }
        if (!confirmationStatus) {
          // Ambiguous: the signature may still land. Surface it rather than
          // retry — a blind retry double-pays.
          const reason = `transaction ${signature} sent but unconfirmed within 45s — check explorer before retrying`;
          await recordAttempt('uncertain', { reason, signature });
          throw new SolanaSettlementError('uncertain', reason);
        }

        const result: SettlementResult = {
          rail: 'solana',
          status: 'settled',
          cluster: this.config.cluster,
          mint: this.config.usdcMint,
          payee: request.payee,
          payer: signer.address,
          amountUsd: request.amountUsd,
          amountBaseUnits: amountBaseUnits.toString(),
          signature,
          explorerUrl: explorerUrl(signature, this.config.cluster),
          confirmationStatus,
        };
        await this.commitReservation(reservation);
        committed = true;
        // The USDC moved and the confirmation is on-chain. A journal write
        // failure here must not turn a settled transfer into a reported
        // failure: the record stays at `sent` (which blocks replay) and the
        // caller still gets the signature.
        await this.store
          .setIntent(key, {
            ...baseRecord,
            status: 'confirmed',
            payer: signer.address,
            signature,
            explorerUrl: result.explorerUrl,
            confirmationStatus,
          })
          .catch(() => undefined);
        return result;
      } catch (error) {
        if (error instanceof SolanaSettlementError) throw error;
        throw new SolanaSettlementError(
          'rpc',
          `settlement broadcast failed: ${errorMessage(error)}`,
        );
      }
    } catch (error) {
      if (error instanceof SolanaSettlementError) throw error;
      // Anything unexpected before a signature means nothing was broadcast.
      const reason = `settlement failed: ${errorMessage(error)}`;
      await recordAttempt('failed', { reason });
      throw new SolanaSettlementError('rpc', reason);
    } finally {
      if (!committed) await this.releaseReservation(reservation);
    }
  }
}

export const solanaSettlementService = new SolanaSettlementService();
