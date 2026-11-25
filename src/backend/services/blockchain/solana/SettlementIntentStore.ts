/**
 * SettlementIntentStore — durable journal for Solana settlement attempts.
 *
 * The settlement rail must never rely on process memory for "did I already
 * pay this intentId": the backend restarts (pm2 memory cap) and a lost cache
 * is a double-pay. This store records an intent *before* broadcast and is
 * the source of truth for replay decisions.
 *
 * States:
 *   pending   — reserved, not yet broadcast
 *   sent      — broadcast, signature known, not yet confirmed
 *   confirmed — confirmed on-chain (terminal, replayable)
 *   failed    — provably not moved (preflight/on-chain error); `retryable`
 *               says whether a new attempt may reuse the intentId
 *   uncertain — we lost track (timeout/transport error); may have landed,
 *               so replay must NOT broadcast again
 */

import { BaseStore, type TtlRecord } from '@backend/shared/storage/BaseStore.js';
import type { SolanaCluster } from './SolanaSettlementService.js';

export type SettlementIntentStatus = 'pending' | 'sent' | 'confirmed' | 'failed' | 'uncertain';

export interface SettlementIntentRecord {
  intentId: string;
  workspaceId: string;
  status: SettlementIntentStatus;
  /** Binds the record to the exact transfer it authorised. */
  requestHash: string;
  cluster: SolanaCluster;
  mint: string;
  payee: string;
  amountUsd: number;
  amountBaseUnits: string;
  payer?: string | null;
  signature?: string | null;
  explorerUrl?: string | null;
  confirmationStatus?: string | null;
  /** Set when the record was produced by the ledger replay path. */
  idempotentReplay?: boolean;
  /**
   * True once the confirmed transfer has been debited against its funded
   * mandate. Replays must not debit a second time. The debit itself is not
   * atomic with this flag, so a crash in between can over-count (the
   * conservative direction) but never free up budget twice.
   */
  mandateDebited?: boolean;
  /** Only meaningful for `failed`: a new attempt may reuse the intentId. */
  retryable?: boolean;
  reason?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

type StoredIntent = TtlRecord<SettlementIntentRecord>;

export class SettlementIntentStore extends BaseStore<SettlementIntentRecord, StoredIntent> {
  constructor(params: { filePath?: string } = {}) {
    super({
      filePath: params.filePath,
      envVar: 'SOLANA_SETTLEMENT_INTENT_FILE',
      defaultFilename: 'solana-settlement-intents.json',
      maxRecords: 5000,
      enableTtl: true,
      // A settlement intent stays auditable for a week. Replays after that
      // need a fresh intentId; the on-chain signature is still in the report.
      defaultTtlMs: 7 * 24 * 60 * 60 * 1000,
    });
  }

  protected parseLine(line: string): { key: string; record: StoredIntent } | null {
    try {
      const parsed = JSON.parse(line) as { key?: string; record?: StoredIntent };
      if (parsed.key && parsed.record) return { key: parsed.key, record: parsed.record };
      return null;
    } catch {
      return null;
    }
  }

  protected serializeRecord(key: string, record: StoredIntent): string {
    return JSON.stringify({ key, record });
  }

  async getIntent(key: string): Promise<SettlementIntentRecord | null> {
    const stored = await this.get(key);
    return stored?.data ?? null;
  }

  async setIntent(key: string, intent: SettlementIntentRecord): Promise<void> {
    const now = Date.now();
    await this.set(key, {
      data: { ...intent, updatedAtMs: now },
      // Keep the original created time so a hot record cannot live forever.
      createdAt: intent.createdAtMs || now,
      ttlMs: this.defaultTtlMs,
    });
  }
}

export const settlementIntentStore = new SettlementIntentStore();
