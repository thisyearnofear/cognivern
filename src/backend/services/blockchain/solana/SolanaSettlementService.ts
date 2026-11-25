/**
 * Solana Settlement Service — governed SPL USDC transfers.
 *
 * The settlement leg of the compliance-on-payment rail: after a gate decides
 * an action may proceed, this service moves the USDC on Solana. Every
 * transfer is bounded by operator-declared guards evaluated *before*
 * broadcast (per-transfer cap, payee allowlist, cumulative session runway,
 * kill switch) so an approval can never exceed the mandate the operator set.
 *
 * Env:
 *   SOLANA_SETTLEMENT_ENABLED=true          — kill switch (default false)
 *   SOLANA_SETTLEMENT_PRIVATE_KEY=<base58>  — 64-byte ed25519 secret key
 *   SOLANA_RPC_URL=...                      — default https://api.mainnet-beta.solana.com
 *   SOLANA_CLUSTER=mainnet-beta|devnet      — explorer links + default mint
 *   SOLANA_USDC_MINT=<base58>               — default per cluster
 *   SOLANA_SETTLEMENT_MAX_USD=0.05          — per-transfer cap
 *   SOLANA_SETTLEMENT_RUNWAY_USD=0.25       — cumulative session cap
 *   SOLANA_SETTLEMENT_PAYEE_ALLOWLIST=a,b,c — empty = no transfers allowed
 *
 * Additive-only like the Telegraph rail: disabled ⇒ zero behavior change.
 */

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
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import { base58 } from "@scure/base";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

export const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_DECIMALS = 6;

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export interface SolanaSettlementConfig {
  enabled?: boolean;
  rpcUrl?: string;
  privateKey?: string;
  usdcMint?: string;
  cluster?: SolanaCluster;
  maxTransferUsd?: number;
  payeeAllowlist?: string[];
  runwayUsd?: number;
}

export type SettlementErrorCode =
  | "disabled"
  | "not_ready"
  | "policy"
  | "insufficient_funds"
  | "rpc"
  | "invalid_input";

export class SolanaSettlementError extends Error {
  constructor(
    readonly code: SettlementErrorCode,
    message: string,
    readonly violations?: string[],
  ) {
    super(message);
    this.name = "SolanaSettlementError";
  }
}

export interface SettlementIntent {
  payee: string;
  amountUsd: number;
}

export interface SettlementResult {
  rail: "solana";
  status: "settled";
  cluster: SolanaCluster;
  mint: string;
  payee: string;
  payer: string;
  amountUsd: number;
  amountBaseUnits: string;
  signature: string;
  explorerUrl: string;
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
  runwayUsd: number;
  maxTransferUsd: number;
  payeeAllowlist: string[];
}

type ResolvedConfig = Required<Omit<SolanaSettlementConfig, "privateKey">> &
  Pick<SolanaSettlementConfig, "privateKey">;

export function usdToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
}

export function explorerUrl(signature: string, cluster: SolanaCluster): string {
  const base = `https://solscan.io/tx/${signature}`;
  return cluster === "mainnet-beta" ? base : `${base}?cluster=${cluster}`;
}

/** Pure guard evaluation — the same checks run before every broadcast. */
export function evaluateSettlementGuards(opts: {
  intent: SettlementIntent;
  maxTransferUsd: number;
  payeeAllowlist: string[];
  runwayUsd: number;
  spentUsd: number;
}): SettlementGuardResult {
  const violations: string[] = [];
  const { intent, maxTransferUsd, payeeAllowlist, runwayUsd, spentUsd } = opts;

  if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
    violations.push(`invalid amountUsd ${intent.amountUsd}`);
  }
  if (intent.amountUsd > maxTransferUsd) {
    violations.push(
      `amount ${intent.amountUsd} exceeds per-transfer cap ${maxTransferUsd}`,
    );
  }
  if (payeeAllowlist.length === 0) {
    violations.push("payee allowlist is empty — no payee permitted");
  } else if (!payeeAllowlist.includes(intent.payee)) {
    violations.push(`payee ${intent.payee} not in allowlist`);
  }
  if (spentUsd + intent.amountUsd > runwayUsd) {
    violations.push(
      `transfer would exceed session runway ${runwayUsd} (spent ${spentUsd})`,
    );
  }
  return { allowed: violations.length === 0, violations };
}

export class SolanaSettlementService {
  private config: ResolvedConfig;
  private signerPromise: Promise<TransactionSigner> | null = null;
  private spentUsd = 0;

  constructor(config?: SolanaSettlementConfig) {
    const cluster = (config?.cluster ??
      (process.env.SOLANA_CLUSTER as SolanaCluster) ??
      "mainnet-beta") as SolanaCluster;
    this.config = {
      enabled:
        config?.enabled ?? process.env.SOLANA_SETTLEMENT_ENABLED === "true",
      rpcUrl:
        config?.rpcUrl ??
        process.env.SOLANA_RPC_URL ??
        "https://api.mainnet-beta.solana.com",
      privateKey:
        config?.privateKey ?? process.env.SOLANA_SETTLEMENT_PRIVATE_KEY,
      usdcMint:
        config?.usdcMint ??
        process.env.SOLANA_USDC_MINT ??
        (cluster === "mainnet-beta" ? MAINNET_USDC_MINT : DEVNET_USDC_MINT),
      cluster,
      maxTransferUsd:
        config?.maxTransferUsd ??
        Number(process.env.SOLANA_SETTLEMENT_MAX_USD ?? 0.05),
      payeeAllowlist:
        config?.payeeAllowlist ??
        (process.env.SOLANA_SETTLEMENT_PAYEE_ALLOWLIST ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      runwayUsd:
        config?.runwayUsd ?? Number(process.env.SOLANA_SETTLEMENT_RUNWAY_USD ?? 0.25),
    };
  }

  getEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): ResolvedConfig {
    return { ...this.config, privateKey: this.config.privateKey ? "[redacted]" : undefined };
  }

  private getRpc() {
    return createSolanaRpc(this.config.rpcUrl);
  }

  private async getSigner(): Promise<TransactionSigner> {
    if (!this.config.privateKey) {
      throw new SolanaSettlementError(
        "not_ready",
        "SOLANA_SETTLEMENT_PRIVATE_KEY not configured",
      );
    }
    this.signerPromise ??= (async () => {
      const secretKey = base58.decode(this.config.privateKey!);
      if (secretKey.length !== 64) {
        throw new SolanaSettlementError(
          "not_ready",
          `settlement key must be a 64-byte secret key (got ${secretKey.length} bytes)`,
        );
      }
      return createKeyPairSignerFromBytes(secretKey);
    })();
    return this.signerPromise;
  }

  evaluateGuards(intent: SettlementIntent): SettlementGuardResult {
    return evaluateSettlementGuards({
      intent,
      maxTransferUsd: this.config.maxTransferUsd,
      payeeAllowlist: this.config.payeeAllowlist,
      runwayUsd: this.config.runwayUsd,
      spentUsd: this.spentUsd,
    });
  }

  async getStatus(): Promise<SettlementStatus> {
    const base: SettlementStatus = {
      enabled: this.config.enabled,
      ready: false,
      cluster: this.config.cluster,
      payer: null,
      mint: this.config.usdcMint,
      solBalance: null,
      usdcBalance: null,
      spentUsd: this.spentUsd,
      runwayUsd: this.config.runwayUsd,
      maxTransferUsd: this.config.maxTransferUsd,
      payeeAllowlist: this.config.payeeAllowlist,
    };
    if (!this.config.enabled || !this.config.privateKey) return base;

    try {
      const signer = await this.getSigner();
      base.ready = true;
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
      if (sol.status === "fulfilled") base.solBalance = Number(sol.value.value) / 1e9;
      if (token.status === "fulfilled")
        base.usdcBalance = token.value.value.uiAmount ?? null;
    } catch {
      base.ready = false;
    }
    return base;
  }

  /**
   * Build the transfer instructions (payee ATA create-if-missing + checked
   * transfer). Pure assembly — separated so the send path stays thin and the
   * instruction set is unit-testable without an RPC.
   */
  async buildTransferInstructions(opts: {
    payer: TransactionSigner;
    intent: SettlementIntent;
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

  async executeTransfer(intent: SettlementIntent): Promise<SettlementResult> {
    if (!this.config.enabled) {
      throw new SolanaSettlementError("disabled", "Solana settlement is not enabled");
    }
    try {
      address(intent.payee); // throws on malformed base58
    } catch {
      throw new SolanaSettlementError("invalid_input", `invalid payee address`);
    }

    const guards = this.evaluateGuards(intent);
    if (!guards.allowed) {
      throw new SolanaSettlementError(
        "policy",
        `settlement blocked by guards: ${guards.violations.join("; ")}`,
        guards.violations,
      );
    }

    const signer = await this.getSigner();
    const rpc = this.getRpc();
    const { instructions } = await this.buildTransferInstructions({
      payer: signer,
      intent,
    });

    try {
      const { value: latestBlockhash } = await rpc
        .getLatestBlockhash({ commitment: "confirmed" })
        .send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx),
      );
      const signed = await signTransactionMessageWithSigners(message);
      const signature = getSignatureFromTransaction(signed);

      await rpc
        .sendTransaction(getBase64EncodedWireTransaction(signed), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: BigInt(3),
        })
        .send();

      // Confirm via signature status — bounded poll, no websocket dependency.
      const deadline = Date.now() + 45_000;
      let confirmed = false;
      while (Date.now() < deadline) {
        const { value: statuses } = await rpc
          .getSignatureStatuses([signature])
          .send();
        const status = statuses[0];
        if (status?.err) {
          throw new SolanaSettlementError(
            "rpc",
            `transaction ${signature} failed on-chain: ${JSON.stringify(status.err)}`,
          );
        }
        if (
          status?.confirmationStatus === "confirmed" ||
          status?.confirmationStatus === "finalized"
        ) {
          confirmed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      if (!confirmed) {
        // Ambiguous: signature may still land. Surface it rather than retry —
        // a blind retry double-pays.
        throw new SolanaSettlementError(
          "rpc",
          `transaction ${signature} sent but unconfirmed within 45s — check explorer before retrying`,
        );
      }

      this.spentUsd += intent.amountUsd;
      return {
        rail: "solana",
        status: "settled",
        cluster: this.config.cluster,
        mint: this.config.usdcMint,
        payee: intent.payee,
        payer: signer.address,
        amountUsd: intent.amountUsd,
        amountBaseUnits: usdToBaseUnits(intent.amountUsd).toString(),
        signature,
        explorerUrl: explorerUrl(signature, this.config.cluster),
      };
    } catch (error) {
      if (error instanceof SolanaSettlementError) throw error;
      if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS)) {
        throw new SolanaSettlementError(
          "insufficient_funds",
          "payer lacks the USDC (or SOL for fees) to settle",
        );
      }
      throw new SolanaSettlementError(
        "rpc",
        `settlement broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const solanaSettlementService = new SolanaSettlementService();
