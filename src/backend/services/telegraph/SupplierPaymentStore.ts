/**
 * SupplierPaymentStore — durable single-use claims for supplier payments.
 *
 * Shares the same SQLite database (and therefore the same connection and
 * transaction context) as FundedMandateService so a confirmed claim and the
 * mandate debit commit atomically. Schema creation is explicit — tests and
 * activation migrations call `initSupplierPaymentClaims`; the dev bootstrap
 * does not touch existing databases.
 *
 * States: `pending` (claimed, dispatch in flight or outcome unknown — never
 * redispatched, reconcile only) and `confirmed` (receipt validated and the
 * mandate debit committed). Claims are immutable once written: the store
 * never deletes or rewrites terms, and an operator-supplied receipt is never
 * trusted — finalization re-reads the claim inside the transaction.
 */
import type Database from 'better-sqlite3';
import { getDb } from '@backend/db/index.js';
import {
  FundedMandateService,
  findUsdcAsset,
} from '@backend/services/governance/FundedMandateService.js';

export interface SupplierPaymentClaim {
  workspaceId: string;
  intentId: string;
  mandateId: string;
  reportHash: string;
  caseId: string;
  bindingHash: string;
  state: 'pending' | 'confirmed';
  signature: string | null;
}

export function initSupplierPaymentClaims(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_payment_claims (
      workspace_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      mandate_id TEXT NOT NULL,
      report_hash TEXT NOT NULL,
      case_id TEXT NOT NULL,
      binding_hash TEXT NOT NULL,
      state TEXT NOT NULL,
      signature TEXT UNIQUE,
      PRIMARY KEY (workspace_id, intent_id),
      UNIQUE (workspace_id, mandate_id, report_hash, case_id)
    );
  `);
}

type ClaimRow = {
  workspace_id: string;
  intent_id: string;
  mandate_id: string;
  report_hash: string;
  case_id: string;
  binding_hash: string;
  state: string;
  signature: string | null;
};

function rowToClaim(row: ClaimRow): SupplierPaymentClaim {
  return {
    workspaceId: row.workspace_id,
    intentId: row.intent_id,
    mandateId: row.mandate_id,
    reportHash: row.report_hash,
    caseId: row.case_id,
    bindingHash: row.binding_hash,
    state: row.state === 'confirmed' ? 'confirmed' : 'pending',
    signature: row.signature,
  };
}

export type ClaimResult =
  | { status: 'claimed' }
  | { status: 'replay'; signature: string }
  | { status: 'pending' }
  | { status: 'conflict'; reason: string };

export const SupplierPaymentStore = {
  getClaim(workspaceId: string, intentId: string): SupplierPaymentClaim | undefined {
    const row = getDb()
      .prepare('SELECT * FROM supplier_payment_claims WHERE workspace_id = ? AND intent_id = ?')
      .get(workspaceId, intentId) as ClaimRow | undefined;
    return row ? rowToClaim(row) : undefined;
  },

  /**
   * Atomic single-use claim. One immediate transaction reads and inserts so
   * a concurrent claim cannot pass the same checks. A second call with an
   * identical confirmed body replays its stored signature; a pending claim
   * is never redispatched here; anything else about the same intent or the
   * same reviewed case conflicts.
   */
  claimIntent(input: {
    workspaceId: string;
    intentId: string;
    mandateId: string;
    reportHash: string;
    caseId: string;
    bindingHash: string;
    amountUsd: number;
  }): ClaimResult {
    const db = getDb();
    const run = db.transaction((): ClaimResult => {
      const existing = SupplierPaymentStore.getClaim(input.workspaceId, input.intentId);
      if (existing) {
        if (existing.bindingHash !== input.bindingHash) {
          return { status: 'conflict', reason: 'intent id already bound to different terms' };
        }
        if (existing.state === 'confirmed' && existing.signature) {
          return { status: 'replay', signature: existing.signature };
        }
        // Pending claims never redispatch — reconciliation is a separate,
        // receipt-verifying path.
        return { status: 'pending' };
      }
      // The reviewed case is single-use before any other limit: replaying
      // the same evidence under a new intent conflicts here, not at budget.
      const caseClaim = getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM supplier_payment_claims
           WHERE workspace_id = ? AND mandate_id = ? AND report_hash = ? AND case_id = ?`,
        )
        .get(input.workspaceId, input.mandateId, input.reportHash, input.caseId) as { n: number };
      if (caseClaim.n > 0) {
        return { status: 'conflict', reason: 'a claim already exists for this reviewed case' };
      }
      // The deployment mandate is dedicated to a single 0.01 transfer: any
      // prior claim — pending or confirmed — exhausts the durable ceiling.
      const priorClaims = getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM supplier_payment_claims
           WHERE workspace_id = ? AND mandate_id = ?`,
        )
        .get(input.workspaceId, input.mandateId) as { n: number };
      if (priorClaims.n > 0) {
        return {
          status: 'conflict',
          reason: 'the mandate is already claimed — one 0.01 transfer per deployment',
        };
      }
      // Live remaining is read inside the same transaction so the check and
      // the insert are atomic.
      const mandate = FundedMandateService.get(input.workspaceId, input.mandateId);
      const found = mandate ? findUsdcAsset(mandate) : null;
      if (!mandate || mandate.status !== 'active' || !found) {
        return { status: 'conflict', reason: 'mandate is not active with a USDC budget line' };
      }
      if (BigInt(found.budget.allocatedAmount) > 10000n) {
        return { status: 'conflict', reason: 'mandate allocation exceeds the 0.01 rehearsal cap' };
      }
      const remainingBase = BigInt(found.budget.allocatedAmount) - BigInt(found.budget.consumedAmount);
      const amountBase = BigInt(Math.round(input.amountUsd * 1_000_000));
      if (amountBase > remainingBase) {
        return { status: 'conflict', reason: 'mandate budget exhausted' };
      }
      try {
        db.prepare(
          `INSERT INTO supplier_payment_claims
            (workspace_id, intent_id, mandate_id, report_hash, case_id, binding_hash, state, signature)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL)`,
        ).run(
          input.workspaceId,
          input.intentId,
          input.mandateId,
          input.reportHash,
          input.caseId,
          input.bindingHash,
        );
      } catch {
        return {
          status: 'conflict',
          reason: 'a claim already exists for this reviewed case',
        };
      }
      return { status: 'claimed' };
    });
    return run.immediate();
  },

  /**
   * Atomic finalize: re-read the claim inside one immediate transaction,
   * require the identical pending binding, consume the mandate budget once
   * (nested transaction on the same connection), then mark confirmed with
   * the validated signature. Any failure throws and rolls the whole unit
   * back, leaving the claim pending for receipt reconciliation — never for
   * automatic redispatch.
   */
  finalizeClaim(input: {
    workspaceId: string;
    intentId: string;
    bindingHash: string;
    amountUsd: number;
    signature: string;
  }): void {
    const db = getDb();
    const run = db.transaction(() => {
      const claim = SupplierPaymentStore.getClaim(input.workspaceId, input.intentId);
      if (!claim || claim.bindingHash !== input.bindingHash) {
        throw new Error('claim is not the identical binding');
      }
      if (claim.state === 'confirmed') {
        // Same signature twice is an idempotent retry; a different signature
        // for a finalized claim is a conflict, not a replay.
        if (claim.signature === input.signature) return;
        throw new Error('claim already finalized with a different signature');
      }
      const consumed = FundedMandateService.consumeBudget(
        input.workspaceId,
        claim.mandateId,
        input.amountUsd,
      );
      if (!consumed.ok) {
        throw new Error(`mandate debit failed: ${consumed.reason}`);
      }
      db.prepare(
        `UPDATE supplier_payment_claims SET state = 'confirmed', signature = ?
         WHERE workspace_id = ? AND intent_id = ?`,
      ).run(input.signature, input.workspaceId, input.intentId);
    });
    run.immediate();
  },
};
