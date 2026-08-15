/**
 * CreditLedgerService — the atomic credit accounting for sponsored inference.
 *
 * Money model, per participant, all in integer nano-USD:
 *
 *     allocated  = what the sponsor has granted (base x disclosure multiplier)
 *     held       = reserved for in-flight requests, not yet billed
 *     consumed   = actually billed against completed requests
 *     available  = allocated - held - consumed
 *
 * The two-phase shape exists because the true cost of an inference call is
 * unknowable until the response arrives. So:
 *
 *     hold(upperBound)  ->  [upstream HTTP call]  ->  settle(actualCost)
 *
 * `hold` reserves a deliberate over-estimate and rejects immediately if the
 * participant cannot cover it. `settle` releases the hold and books the real
 * cost derived from the provider's own token counts. If the upstream call
 * fails, `release` returns the hold untouched.
 *
 * Concurrency: every mutation runs inside a `better-sqlite3` transaction, which
 * is synchronous and serialised by SQLite. The read-check-write of a balance is
 * therefore atomic with respect to other requests in this process, and the
 * denormalised counters on `credit_participants` are always updated in the same
 * transaction as the matching append-only `credit_ledger` line. `reconcile()`
 * exists to prove the two agree.
 *
 * The ledger is append-only: corrections are new compensating lines, never
 * UPDATEs. That is what makes it evidence rather than a mutable balance.
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";
import logger from "@backend/utils/logger.js";
import { assertNonNegativeInteger } from "./money.js";
import {
  allocationForTier,
  type DisclosureTier,
} from "./disclosure.js";

export type LedgerKind =
  | "allocation"
  | "adjustment"
  | "hold"
  | "hold_release"
  | "debit"
  | "refund";

export interface ParticipantBalance {
  participantId: string;
  programId: string;
  allocatedNano: number;
  consumedNano: number;
  heldNano: number;
  overdrawnNano: number;
  availableNano: number;
  requestCount: number;
}

export interface HoldReceipt {
  holdId: string;
  participantId: string;
  amountNano: number;
}

export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits";
  constructor(
    readonly requiredNano: number,
    readonly availableNano: number,
  ) {
    super(
      `Insufficient credits: request requires up to ${requiredNano} nano-USD but only ${availableNano} available`,
    );
    this.name = "InsufficientCreditsError";
  }
}

interface ParticipantRow {
  id: string;
  program_id: string;
  allocated_nano: number;
  consumed_nano: number;
  held_nano: number;
  overdrawn_nano: number;
  request_count: number;
  base_allocation_nano: number;
  disclosure_tier: string;
  status: string;
}

export class CreditLedgerService {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getBalance(participantId: string): ParticipantBalance | null {
    const row = this.db
      .prepare(
        `SELECT id, program_id, allocated_nano, consumed_nano, held_nano,
                overdrawn_nano, request_count, base_allocation_nano,
                disclosure_tier, status
         FROM credit_participants WHERE id = ?`,
      )
      .get(participantId) as ParticipantRow | undefined;

    return row ? toBalance(row) : null;
  }

  listEntries(
    participantId: string,
    options: { limit?: number; offset?: number } = {},
  ): Array<{
    id: string;
    kind: LedgerKind;
    amountNano: number;
    balanceAfterNano: number;
    refType: string | null;
    refId: string | null;
    note: string | null;
    createdAt: string;
  }> {
    const limit = clampLimit(options.limit);
    const offset = Math.max(0, Math.floor(options.offset ?? 0));

    const rows = this.db
      .prepare(
        `SELECT id, kind, amount_nano, balance_after_nano, ref_type, ref_id, note, created_at
         FROM credit_ledger
         WHERE participant_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(participantId, limit, offset) as Array<{
      id: string;
      kind: string;
      amount_nano: number;
      balance_after_nano: number;
      ref_type: string | null;
      ref_id: string | null;
      note: string | null;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as LedgerKind,
      amountNano: r.amount_nano,
      balanceAfterNano: r.balance_after_nano,
      refType: r.ref_type,
      refId: r.ref_id,
      note: r.note,
      createdAt: r.created_at,
    }));
  }

  // ── Allocation ───────────────────────────────────────────────────────────

  /**
   * Grant (or re-grant) a participant's allocation for their current tier.
   *
   * Idempotent in effect rather than in call count: it computes the target
   * allocation from base x multiplier and books only the delta, so calling it
   * twice with unchanged inputs writes no second line.
   */
  allocate(
    participantId: string,
    options: {
      baseAllocationNano?: number;
      tier?: DisclosureTier;
      multipliers?: Partial<Record<DisclosureTier, number>> | null;
      note?: string;
    } = {},
  ): ParticipantBalance {
    const run = this.db.transaction((): ParticipantBalance => {
      const row = this.requireParticipant(participantId);

      const base = options.baseAllocationNano ?? row.base_allocation_nano;
      assertNonNegativeInteger(base, "baseAllocationNano");
      const tier = (options.tier ?? row.disclosure_tier) as DisclosureTier;

      let target = allocationForTier(base, tier, options.multipliers);

      // Never claw back credits the participant has already spent. If a tier
      // downgrade would put allocated below consumed, floor it at consumed and
      // say so in the note — the alternative is a negative available balance
      // that looks like a bug.
      let flooredToConsumed = false;
      if (target < row.consumed_nano) {
        target = row.consumed_nano;
        flooredToConsumed = true;
      }

      const delta = target - row.allocated_nano;
      if (delta === 0) {
        return toBalance({ ...row, base_allocation_nano: base, disclosure_tier: tier });
      }

      this.db
        .prepare(
          `UPDATE credit_participants
           SET allocated_nano = ?, base_allocation_nano = ?, disclosure_tier = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(target, base, tier, nowIso(), participantId);

      const note =
        options.note ??
        (flooredToConsumed
          ? `allocation for tier '${tier}' floored to already-consumed amount`
          : `allocation for tier '${tier}'`);

      this.appendEntry({
        programId: row.program_id,
        participantId,
        kind: row.allocated_nano === 0 ? "allocation" : "adjustment",
        amountNano: delta,
        balanceAfterNano: target - row.held_nano - row.consumed_nano,
        note,
      });

      return toBalance({
        ...row,
        allocated_nano: target,
        base_allocation_nano: base,
        disclosure_tier: tier,
      });
    });

    return run();
  }

  // ── Two-phase spend ──────────────────────────────────────────────────────

  /**
   * Reserve an upper bound on a request's cost.
   *
   * Throws `InsufficientCreditsError` if the participant cannot cover it. The
   * caller must eventually `settle` or `release` the returned hold — an
   * abandoned hold permanently reduces available credit, so gateway code puts
   * the release in a `finally`.
   */
  hold(
    participantId: string,
    amountNano: number,
    options: { refType?: string; refId?: string; note?: string } = {},
  ): HoldReceipt {
    assertNonNegativeInteger(amountNano, "hold amount");

    const run = this.db.transaction((): HoldReceipt => {
      const row = this.requireParticipant(participantId);

      if (row.status !== "active") {
        throw new Error(`Participant ${participantId} is ${row.status}, not active`);
      }

      const available = row.allocated_nano - row.held_nano - row.consumed_nano;
      if (amountNano > available) {
        throw new InsufficientCreditsError(amountNano, Math.max(0, available));
      }

      const held = row.held_nano + amountNano;
      this.db
        .prepare(
          `UPDATE credit_participants SET held_nano = ?, updated_at = ? WHERE id = ?`,
        )
        .run(held, nowIso(), participantId);

      const holdId = this.appendEntry({
        programId: row.program_id,
        participantId,
        kind: "hold",
        // A hold is not a spend, so it does not move the signed running total.
        // It is recorded for traceability and to make an orphaned hold visible.
        amountNano: 0,
        balanceAfterNano: row.allocated_nano - held - row.consumed_nano,
        refType: options.refType ?? "inference",
        refId: options.refId,
        note: options.note ?? `hold ${amountNano} nano-USD`,
      });

      return { holdId, participantId, amountNano };
    });

    return run();
  }

  /**
   * Convert a hold into a real charge using the provider's actual token counts.
   *
   * `actualCostNano` may legitimately exceed the hold — token estimation is
   * approximate and a provider can return more than `max_tokens` worth of
   * billable context. Rather than silently under-billing the sponsor, the
   * overage is booked and, if it pushes past the allocation, recorded in
   * `overdrawn_nano` so the next pre-flight check rejects the participant.
   */
  settle(
    hold: HoldReceipt,
    actualCostNano: number,
    options: { refType?: string; refId?: string; note?: string } = {},
  ): ParticipantBalance {
    assertNonNegativeInteger(actualCostNano, "settle amount");

    const run = this.db.transaction((): ParticipantBalance => {
      const row = this.requireParticipant(hold.participantId);

      // Releasing more than is held would corrupt the counter if a caller
      // double-settled; clamp defensively.
      const heldAfterRelease = Math.max(0, row.held_nano - hold.amountNano);
      const consumed = row.consumed_nano + actualCostNano;

      const overshoot = consumed - row.allocated_nano;
      const overdrawn = overshoot > 0 ? row.overdrawn_nano + overshoot : row.overdrawn_nano;

      this.db
        .prepare(
          `UPDATE credit_participants
           SET held_nano = ?, consumed_nano = ?, overdrawn_nano = ?,
               request_count = request_count + 1, updated_at = ?
           WHERE id = ?`,
        )
        .run(heldAfterRelease, consumed, overdrawn, nowIso(), hold.participantId);

      this.appendEntry({
        programId: row.program_id,
        participantId: hold.participantId,
        kind: "hold_release",
        amountNano: 0,
        balanceAfterNano: row.allocated_nano - heldAfterRelease - row.consumed_nano,
        refType: options.refType ?? "inference",
        refId: options.refId,
        note: `release hold ${hold.amountNano} nano-USD`,
      });

      this.appendEntry({
        programId: row.program_id,
        participantId: hold.participantId,
        kind: "debit",
        amountNano: -actualCostNano,
        balanceAfterNano: row.allocated_nano - heldAfterRelease - consumed,
        refType: options.refType ?? "inference",
        refId: options.refId,
        note: options.note ?? `inference charge`,
      });

      if (overshoot > 0) {
        logger.warn(
          `Participant ${hold.participantId} overdrew allocation by ${overshoot} nano-USD ` +
            `(hold ${hold.amountNano}, actual ${actualCostNano}) — further requests will be rejected`,
        );
      }

      return toBalance({
        ...row,
        held_nano: heldAfterRelease,
        consumed_nano: consumed,
        overdrawn_nano: overdrawn,
        request_count: row.request_count + 1,
      });
    });

    return run();
  }

  /**
   * Return a hold without charging — used when the upstream call failed and no
   * tokens were billed. A participant is never charged for our or the
   * provider's errors.
   */
  release(
    hold: HoldReceipt,
    options: { refType?: string; refId?: string; note?: string } = {},
  ): ParticipantBalance {
    const run = this.db.transaction((): ParticipantBalance => {
      const row = this.requireParticipant(hold.participantId);
      const heldAfter = Math.max(0, row.held_nano - hold.amountNano);

      this.db
        .prepare(`UPDATE credit_participants SET held_nano = ?, updated_at = ? WHERE id = ?`)
        .run(heldAfter, nowIso(), hold.participantId);

      this.appendEntry({
        programId: row.program_id,
        participantId: hold.participantId,
        kind: "hold_release",
        amountNano: 0,
        balanceAfterNano: row.allocated_nano - heldAfter - row.consumed_nano,
        refType: options.refType ?? "inference",
        refId: options.refId,
        note: options.note ?? `release unused hold ${hold.amountNano} nano-USD`,
      });

      return toBalance({ ...row, held_nano: heldAfter });
    });

    return run();
  }

  /**
   * Credit an amount back to a participant (goodwill, mis-billing correction).
   * Recorded as a positive `refund` line; `consumed` is reduced but never below
   * zero, and the original debit line remains in the ledger.
   */
  refund(
    participantId: string,
    amountNano: number,
    options: { refType?: string; refId?: string; note?: string } = {},
  ): ParticipantBalance {
    assertNonNegativeInteger(amountNano, "refund amount");

    const run = this.db.transaction((): ParticipantBalance => {
      const row = this.requireParticipant(participantId);
      const consumed = Math.max(0, row.consumed_nano - amountNano);

      this.db
        .prepare(
          `UPDATE credit_participants SET consumed_nano = ?, updated_at = ? WHERE id = ?`,
        )
        .run(consumed, nowIso(), participantId);

      this.appendEntry({
        programId: row.program_id,
        participantId,
        kind: "refund",
        amountNano,
        balanceAfterNano: row.allocated_nano - row.held_nano - consumed,
        refType: options.refType,
        refId: options.refId,
        note: options.note ?? "refund",
      });

      return toBalance({ ...row, consumed_nano: consumed });
    });

    return run();
  }

  // ── Integrity ────────────────────────────────────────────────────────────

  /**
   * Verify the denormalised counters agree with the append-only ledger.
   *
   * The ledger's signed sum is (allocations + refunds - debits), which should
   * equal (allocated - consumed). Any drift means a mutation escaped a
   * transaction, which is a correctness bug worth surfacing loudly rather than
   * a number worth quietly fixing.
   */
  reconcile(participantId: string): {
    ok: boolean;
    counterNano: number;
    ledgerNano: number;
    driftNano: number;
  } {
    const row = this.requireParticipant(participantId);

    const { total } = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount_nano), 0) AS total FROM credit_ledger WHERE participant_id = ?`,
      )
      .get(participantId) as { total: number };

    const counterNano = row.allocated_nano - row.consumed_nano;
    const driftNano = counterNano - total;

    return { ok: driftNano === 0, counterNano, ledgerNano: total, driftNano };
  }

  /**
   * Sum of every participant's consumption in a program — what the sponsor has
   * actually spent out of the pool.
   */
  programTotals(programId: string): {
    participantCount: number;
    allocatedNano: number;
    consumedNano: number;
    heldNano: number;
    requestCount: number;
  } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS participant_count,
                COALESCE(SUM(allocated_nano), 0) AS allocated,
                COALESCE(SUM(consumed_nano), 0) AS consumed,
                COALESCE(SUM(held_nano), 0) AS held,
                COALESCE(SUM(request_count), 0) AS requests
         FROM credit_participants WHERE program_id = ?`,
      )
      .get(programId) as {
      participant_count: number;
      allocated: number;
      consumed: number;
      held: number;
      requests: number;
    };

    return {
      participantCount: row.participant_count,
      allocatedNano: row.allocated,
      consumedNano: row.consumed,
      heldNano: row.held,
      requestCount: row.requests,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private requireParticipant(participantId: string): ParticipantRow {
    const row = this.db
      .prepare(
        `SELECT id, program_id, allocated_nano, consumed_nano, held_nano,
                overdrawn_nano, request_count, base_allocation_nano,
                disclosure_tier, status
         FROM credit_participants WHERE id = ?`,
      )
      .get(participantId) as ParticipantRow | undefined;

    if (!row) throw new Error(`Unknown participant: ${participantId}`);
    return row;
  }

  private appendEntry(entry: {
    programId: string;
    participantId: string;
    kind: LedgerKind;
    amountNano: number;
    balanceAfterNano: number;
    refType?: string;
    refId?: string;
    note?: string;
  }): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO credit_ledger
           (id, program_id, participant_id, kind, amount_nano, balance_after_nano,
            ref_type, ref_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        entry.programId,
        entry.participantId,
        entry.kind,
        entry.amountNano,
        entry.balanceAfterNano,
        entry.refType ?? null,
        entry.refId ?? null,
        entry.note ?? null,
        nowIso(),
      );
    return id;
  }
}

function toBalance(row: ParticipantRow): ParticipantBalance {
  return {
    participantId: row.id,
    programId: row.program_id,
    allocatedNano: row.allocated_nano,
    consumedNano: row.consumed_nano,
    heldNano: row.held_nano,
    overdrawnNano: row.overdrawn_nano,
    availableNano: Math.max(0, row.allocated_nano - row.held_nano - row.consumed_nano),
    requestCount: row.request_count,
  };
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return 100;
  return Math.min(1000, Math.max(1, Math.floor(limit as number)));
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Lazily-constructed shared instance, matching the `shared*` convention. */
let shared: CreditLedgerService | null = null;
export function sharedCreditLedgerService(): CreditLedgerService {
  if (!shared) shared = new CreditLedgerService();
  return shared;
}
