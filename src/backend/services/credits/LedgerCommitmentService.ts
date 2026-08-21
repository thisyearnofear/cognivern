/**
 * LedgerCommitmentService — periodic, anchored commitments over the credit
 * ledger, so balances are externally verifiable rather than merely asserted.
 *
 * Why this exists: the ledger is append-only and `reconcile()` can re-derive
 * every balance — but both of those facts live inside our DB. A user who
 * cannot read our DB has to trust us. Anchoring a commitment to 0G Storage and
 * Filecoin moves the evidence outside our walls: anyone can fetch the anchored
 * root, verify a participant's receipt against it, and confirm the books were
 * what we said they were at time T.
 *
 * Shape: for each participant, a leaf = sha256(canonical JSON of their balance
 * state). Leaves are sorted and built into a binary Merkle tree; the root and
 * the sorted leaf hashes are anchored. Leaf CONTENT (handles, balances) is
 * never anchored — it is served per-participant on demand, so a public anchor
 * can never leak someone else's balance.
 *
 * Anchoring is best-effort and fails open, exactly like the audit trail it
 * piggybacks on: a row is written with status 'anchored' when at least one
 * store accepted it, 'pending' otherwise. The receipt endpoint reports the
 * status honestly, so a 'pending' commitment is visible as not-yet-provable
 * rather than mistaken for proof.
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";
import logger from "@backend/utils/logger.js";
import { zeroGStorageService } from "@backend/services/blockchain/ZeroGStorageService.js";
import { filecoinStorageService } from "@backend/services/blockchain/FilecoinStorageService.js";
import {
  buildMerkleTree,
  canonicalJson,
  merkleProof,
  sha256Hex,
  stateLeafHash,
  type CommitmentState,
  type MerkleProof,
} from "./commitment.js";

/** Anchor results recorded on the commitment row. */
export interface CommitmentAnchors {
  zerogRootHash: string | null;
  zerogTxHash: string | null;
  filecoinCid: string | null;
  filecoinTxHash: string | null;
  filecoinActionId: string | null;
}

export interface CommitmentRow extends CommitmentAnchors {
  id: string;
  programId: string;
  status: "anchored" | "pending";
  commitmentRoot: string;
  payloadHash: string;
  participantCount: number;
  highWaterMark: string | null;
  createdAt: string;
}

export interface CommitmentReceipt {
  commitment: {
    id: string;
    programId: string;
    status: "anchored" | "pending";
    commitmentRoot: string;
    participantCount: number;
    highWaterMark: string | null;
    createdAt: string;
    anchors: CommitmentAnchors;
  };
  state: CommitmentState;
  proof: MerkleProof;
}

/** Injectable anchor sinks (defaults to the live services) for testability. */
export interface CommitmentAnchorSinks {
  zeroG: { anchorAuditRecord(record: Record<string, unknown>): Promise<{ rootHash: string; txHash?: string } | null> };
  filecoin: { anchorAuditRecord(record: Record<string, unknown>): Promise<{ cid: string; txHash?: string; actionId: string } | null> };
}

const defaultSinks: CommitmentAnchorSinks = {
  zeroG: zeroGStorageService,
  filecoin: filecoinStorageService,
};

const ANCHOR_TIMEOUT_MS = 45_000;

interface ParticipantStateRow {
  id: string;
  handle: string;
  allocated_nano: number;
  consumed_nano: number;
  held_nano: number;
  overdrawn_nano: number;
  request_count: number;
  base_allocation_nano: number;
  disclosure_tier: string;
  status: string;
  updated_at: string;
}

interface CommitmentRowSql {
  id: string;
  program_id: string;
  status: string;
  commitment_root: string;
  payload_hash: string;
  participant_count: number;
  high_water_mark: string | null;
  zerog_root_hash: string | null;
  zerog_tx_hash: string | null;
  filecoin_cid: string | null;
  filecoin_tx_hash: string | null;
  filecoin_action_id: string | null;
  proof_map: string;
  created_at: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`anchor timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export class LedgerCommitmentService {
  private db: Database.Database;
  private sinks: CommitmentAnchorSinks;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database.Database = getDb(), sinks: CommitmentAnchorSinks = defaultSinks) {
    this.db = db;
    this.sinks = sinks;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  list(programId: string): CommitmentRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, program_id, status, commitment_root, payload_hash, participant_count,
                high_water_mark, zerog_root_hash, zerog_tx_hash, filecoin_cid,
                filecoin_tx_hash, filecoin_action_id, proof_map, created_at
         FROM credit_ledger_commitments
         WHERE program_id = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(programId) as CommitmentRowSql[];
    return rows.map(toCommitmentRow);
  }

  latest(programId: string): CommitmentRow | null {
    const row = this.db
      .prepare(
        `SELECT id, program_id, status, commitment_root, payload_hash, participant_count,
                high_water_mark, zerog_root_hash, zerog_tx_hash, filecoin_cid,
                filecoin_tx_hash, filecoin_action_id, proof_map, created_at
         FROM credit_ledger_commitments
         WHERE program_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
      )
      .get(programId) as CommitmentRowSql | undefined;
    return row ? toCommitmentRow(row) : null;
  }

  /**
   * Fetch a single commitment by id. Powers the public verification page —
   * the aggregate metadata (root, timestamp, counts, anchors) is shareable
   * because it contains no per-participant content.
   */
  get(id: string): CommitmentRow | null {
    const row = this.db
      .prepare(
        `SELECT id, program_id, status, commitment_root, payload_hash, participant_count,
                high_water_mark, zerog_root_hash, zerog_tx_hash, filecoin_cid,
                filecoin_tx_hash, filecoin_action_id, proof_map, created_at
         FROM credit_ledger_commitments
         WHERE id = ?`,
      )
      .get(id) as CommitmentRowSql | undefined;
    return row ? toCommitmentRow(row) : null;
  }

  /**
   * The receipt a participant (or sponsor) can hand to a third party: their
   * own state, its leaf, the inclusion proof, and the anchored root. The
   * verifier recomputes root = f(leaf, index, path) and compares with the
   * root, which they can independently fetch from the anchor.
   */
  receipt(programId: string, participantId: string): CommitmentReceipt | null {
    const commitment = this.latest(programId);
    if (!commitment) return null;

    const row = this.db
      .prepare(
        `SELECT proof_map FROM credit_ledger_commitments WHERE id = ?`,
      )
      .get(commitment.id) as { proof_map: string } | undefined;
    if (!row) return null;

    const proofMap = JSON.parse(row.proof_map) as Record<string, MerkleProof>;
    const proof = proofMap[participantId];
    if (!proof) return null;

    const state = this.loadState(participantId);
    if (!state) return null;

    return {
      commitment: {
        id: commitment.id,
        programId: commitment.programId,
        status: commitment.status,
        commitmentRoot: commitment.commitmentRoot,
        participantCount: commitment.participantCount,
        highWaterMark: commitment.highWaterMark,
        createdAt: commitment.createdAt,
        anchors: {
          zerogRootHash: commitment.zerogRootHash,
          zerogTxHash: commitment.zerogTxHash,
          filecoinCid: commitment.filecoinCid,
          filecoinTxHash: commitment.filecoinTxHash,
          filecoinActionId: commitment.filecoinActionId,
        },
      },
      state,
      proof,
    };
  }

  // ── Anchoring ────────────────────────────────────────────────────────────

  /**
   * Build a commitment over the program's participants and anchor it to
   * 0G + Filecoin. Returns the stored row. Returns null when the program has
   * no participants (nothing to commit).
   */
  async anchor(programId: string): Promise<CommitmentRow | null> {
    const states = this.loadStates(programId);
    if (states.length === 0) return null;

    // Proof indices must correspond to the SORTED tree order, so pair each
    // state with its leaf and sort together.
    const entries = states
      .map((s) => ({ state: s, leaf: stateLeafHash(s) }))
      .sort((a, b) => (a.leaf < b.leaf ? -1 : a.leaf > b.leaf ? 1 : 0));
    const leaves = entries.map((e) => e.leaf);
    const tree = buildMerkleTree(leaves);
    const highWaterMark = this.highWaterMark(programId);
    const createdAt = new Date().toISOString();

    const payload = {
      type: "cognivern_credit_ledger_commitment",
      version: 1,
      program_id: programId,
      commitment_root: tree.root,
      participant_count: states.length,
      high_water_mark: highWaterMark,
      created_at: createdAt,
      leaves,
    };
    const payloadHash = sha256Hex(canonicalJson(payload));

    // Anchor in parallel with a bounded timeout; record whatever succeeded.
    const [zeroG, filecoin] = await Promise.all([
      this.tryAnchor("0g", () => withTimeout(this.sinks.zeroG.anchorAuditRecord(payload), ANCHOR_TIMEOUT_MS)),
      this.tryAnchor("filecoin", () => withTimeout(this.sinks.filecoin.anchorAuditRecord(payload), ANCHOR_TIMEOUT_MS)),
    ]);

    const anchors: CommitmentAnchors = {
      zerogRootHash: zeroG?.rootHash ?? null,
      zerogTxHash: zeroG?.txHash ?? null,
      filecoinCid: filecoin?.cid ?? null,
      filecoinTxHash: filecoin?.txHash ?? null,
      filecoinActionId: filecoin?.actionId ?? null,
    };
    const status: "anchored" | "pending" =
      anchors.zerogRootHash || anchors.filecoinCid ? "anchored" : "pending";

    // Per-participant inclusion proofs, keyed by participant id. The index in
    // the proof is the SORTED position, so a third party recomputing
    // root = f(leaf, index, path) reproduces the anchored root exactly.
    const proofMap: Record<string, MerkleProof> = {};
    entries.forEach((e, i) => {
      proofMap[e.state.participantId] = merkleProof(tree, i);
    });

    const id = `cmt_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO credit_ledger_commitments
           (id, program_id, status, commitment_root, payload_hash, participant_count,
            high_water_mark, zerog_root_hash, zerog_tx_hash, filecoin_cid,
            filecoin_tx_hash, filecoin_action_id, proof_map, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        programId,
        status,
        tree.root,
        payloadHash,
        states.length,
        highWaterMark,
        anchors.zerogRootHash,
        anchors.zerogTxHash,
        anchors.filecoinCid,
        anchors.filecoinTxHash,
        anchors.filecoinActionId,
        JSON.stringify(proofMap),
        createdAt,
      );

    logger.info(
      `[credits] anchored ${status} commitment ${id} for program ${programId}: ` +
        `${states.length} participants, root ${tree.root.slice(0, 12)}…`,
    );
    return this.latest(programId);
  }

  private async tryAnchor<T extends { rootHash?: string; txHash?: string; cid?: string; actionId?: string }>(
    label: string,
    run: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      logger.warn(`[credits] ${label} anchor failed: ${(error as Error).message}`);
      return null;
    }
  }

  // ── Background anchoring ─────────────────────────────────────────────────

  /**
   * Periodically anchor every active program. Mirrors the
   * HydraDbMandateContextService background worker pattern: interval owns
   * itself, stop() clears it, and each tick is independent (a slow anchor must
   * not delay the next tick's schedule start).
   */
  start(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.anchorActivePrograms().catch((error: unknown) => {
        logger.warn(`[credits] background commitment failed: ${(error as Error).message}`);
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async anchorActivePrograms(): Promise<number> {
    const rows = this.db
      .prepare(`SELECT id FROM credit_programs WHERE status = 'active'`)
      .all() as Array<{ id: string }>;
    let anchored = 0;
    for (const row of rows) {
      const result = await this.anchor(row.id);
      if (result) anchored += 1;
    }
    return anchored;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private loadStates(programId: string): CommitmentState[] {
    const rows = this.db
      .prepare(
        `SELECT id, handle, allocated_nano, consumed_nano, held_nano, overdrawn_nano,
                request_count, base_allocation_nano, disclosure_tier, status, updated_at
         FROM credit_participants
         WHERE program_id = ?
         ORDER BY id ASC`,
      )
      .all(programId) as ParticipantStateRow[];
    return rows.map((r) => ({
      participantId: r.id,
      handle: r.handle,
      allocatedNano: r.allocated_nano,
      consumedNano: r.consumed_nano,
      heldNano: r.held_nano,
      overdrawnNano: r.overdrawn_nano,
      requestCount: r.request_count,
      baseAllocationNano: r.base_allocation_nano,
      disclosureTier: r.disclosure_tier,
      status: r.status,
      updatedAt: r.updated_at,
    }));
  }

  private loadState(participantId: string): CommitmentState | null {
    const row = this.db
      .prepare(
        `SELECT id, handle, allocated_nano, consumed_nano, held_nano, overdrawn_nano,
                request_count, base_allocation_nano, disclosure_tier, status, updated_at
         FROM credit_participants
         WHERE id = ?`,
      )
      .get(participantId) as ParticipantStateRow | undefined;
    if (!row) return null;
    const states = [row].map((r) => ({
      participantId: r.id,
      handle: r.handle,
      allocatedNano: r.allocated_nano,
      consumedNano: r.consumed_nano,
      heldNano: r.held_nano,
      overdrawnNano: r.overdrawn_nano,
      requestCount: r.request_count,
      baseAllocationNano: r.base_allocation_nano,
      disclosureTier: r.disclosure_tier,
      status: r.status,
      updatedAt: r.updated_at,
    }));
    return states[0];
  }

  /** Latest ledger write across all of the program's participants. */
  private highWaterMark(programId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT MAX(created_at) AS latest
         FROM credit_ledger
         WHERE program_id = ?`,
      )
      .get(programId) as { latest: string | null } | undefined;
    return row?.latest ?? null;
  }
}

function toCommitmentRow(row: CommitmentRowSql): CommitmentRow {
  return {
    id: row.id,
    programId: row.program_id,
    status: row.status === "anchored" ? "anchored" : "pending",
    commitmentRoot: row.commitment_root,
    payloadHash: row.payload_hash,
    participantCount: row.participant_count,
    highWaterMark: row.high_water_mark,
    createdAt: row.created_at,
    zerogRootHash: row.zerog_root_hash,
    zerogTxHash: row.zerog_tx_hash,
    filecoinCid: row.filecoin_cid,
    filecoinTxHash: row.filecoin_tx_hash,
    filecoinActionId: row.filecoin_action_id,
  };
}

let shared: LedgerCommitmentService | null = null;
export function sharedLedgerCommitmentService(): LedgerCommitmentService {
  if (!shared) shared = new LedgerCommitmentService();
  return shared;
}
