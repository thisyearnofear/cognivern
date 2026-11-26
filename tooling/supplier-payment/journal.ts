/**
 * Durable single-use journal for the supplier payment rail. One intent per
 * journal file (dedicated deployment lifetime cap); the signature is
 * committed BEFORE any broadcast so a lost send response is always
 * recoverable from the journal + chain.
 *
 * Every journal is stamped with an immutable deployment binding hash —
 * cluster, genesis, mint, workspace/mandate/case, payer, payee, amount —
 * computed by the factory. A journal that binds a different deployment (or
 * predates binding) fails closed at open; a different chain can never
 * reuse it.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export interface JournalRecord {
  intentId: string;
  proposalHash: string;
  status: 'claimed' | 'signed' | 'sent';
  signature: string | null;
  payer: string;
  payee: string;
  mint: string;
  amountBaseUnits: string;
  sourceAta: string | null;
  destAta: string | null;
  createdAt: string;
}

export type JournalClaim =
  | { status: 'claimed'; record: JournalRecord }
  | { status: 'conflict'; reason: string; record: JournalRecord | null };

/**
 * The journal must be a durable private file on disk: a real dedicated
 * directory (mode 0700, never a symlink), a real named file (never
 * ':memory:' or an anonymous path, never a symlink).
 */
function assertJournalPath(filePath: string): void {
  if (!filePath || filePath === ':memory:' || !path.isAbsolute(filePath)) {
    throw new Error('supplier journal rejected: path must be a real absolute file');
  }
  const dir = path.dirname(filePath);
  const dirStat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!dirStat?.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error('supplier journal rejected: parent directory missing or is a symlink');
  }
  if ((dirStat.mode & 0o777) !== 0o700) {
    throw new Error('supplier journal rejected: parent directory must be mode 0700');
  }
  const fileStat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (fileStat?.isSymbolicLink()) {
    throw new Error('supplier journal rejected: journal file must not be a symlink');
  }
}

export class SupplierJournal {
  private readonly db: Database.Database;

  /**
   * @param bindingHash Immutable deployment binding hash — opens fail if a
   *   journal on disk binds a different deployment or predates binding.
   */
  constructor(filePath: string, bindingHash: string) {
    assertJournalPath(filePath);
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_journal (
        intent_id TEXT PRIMARY KEY,
        proposal_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        signature TEXT UNIQUE,
        payer TEXT NOT NULL,
        payee TEXT NOT NULL,
        mint TEXT NOT NULL,
        amount_base_units TEXT NOT NULL,
        source_ata TEXT,
        dest_ata TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS journal_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const stored = this.db
      .prepare("SELECT value FROM journal_meta WHERE key = 'binding_hash'")
      .get() as { value: string } | undefined;
    const rowCount = (
      this.db.prepare('SELECT COUNT(*) AS n FROM supplier_journal').get() as { n: number }
    ).n;
    if (stored && stored.value !== bindingHash) {
      throw new Error('supplier journal rejected: bound to a different deployment');
    }
    if (!stored) {
      if (rowCount > 0) {
        throw new Error('supplier journal rejected: journal predates deployment binding');
      }
      this.db
        .prepare("INSERT INTO journal_meta (key, value) VALUES ('binding_hash', ?)")
        .run(bindingHash);
    }
  }

  get(intentId: string): JournalRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM supplier_journal WHERE intent_id = ?')
      .get(intentId) as Record<string, unknown> | undefined;
    return row ? toRecord(row) : undefined;
  }

  /**
   * Atomic first-and-only claim. A journal file is dedicated: a second
   * intent — same or different — conflicts after the first insert.
   */
  claim(input: {
    intentId: string;
    proposalHash: string;
    payer: string;
    payee: string;
    mint: string;
    amountBaseUnits: string;
  }): JournalClaim {
    const run = this.db.transaction((): JournalClaim => {
      const existing = this.get(input.intentId);
      if (existing) {
        if (existing.proposalHash !== input.proposalHash) {
          return { status: 'conflict', reason: 'intent bound to different terms', record: existing };
        }
        return { status: 'conflict', reason: 'intent already claimed', record: existing };
      }
      const count = this.db
        .prepare('SELECT COUNT(*) AS n FROM supplier_journal')
        .get() as { n: number };
      if (count.n > 0) {
        return {
          status: 'conflict',
          reason: 'journal lifetime cap reached — one intent per deployment',
          record: null,
        };
      }
      this.db
        .prepare(
          `INSERT INTO supplier_journal
            (intent_id, proposal_hash, status, signature, payer, payee, mint, amount_base_units, source_ata, dest_ata, created_at)
           VALUES (?, ?, 'claimed', NULL, ?, ?, ?, ?, NULL, NULL, ?)`,
        )
        .run(
          input.intentId,
          input.proposalHash,
          input.payer,
          input.payee,
          input.mint,
          input.amountBaseUnits,
          new Date().toISOString(),
        );
      return { status: 'claimed', record: this.get(input.intentId)! };
    });
    return run.immediate();
  }

  /**
   * Commit the signature and derived ATAs BEFORE broadcast — the journal,
   * not memory, owns recovery.
   */
  recordSigned(input: {
    intentId: string;
    proposalHash: string;
    signature: string;
    sourceAta: string;
    destAta: string;
  }): void {
    const run = this.db.transaction(() => {
      const existing = this.get(input.intentId);
      if (!existing || existing.proposalHash !== input.proposalHash) {
        throw new Error('journal claim is not the identical binding');
      }
      if (existing.signature && existing.signature !== input.signature) {
        throw new Error('journal already recorded a different signature');
      }
      this.db
        .prepare(
          `UPDATE supplier_journal
           SET status = 'signed', signature = ?, source_ata = ?, dest_ata = ?
           WHERE intent_id = ?`,
        )
        .run(input.signature, input.sourceAta, input.destAta, input.intentId);
    });
    run.immediate();
  }

  markSent(intentId: string): void {
    this.db
      .prepare("UPDATE supplier_journal SET status = 'sent' WHERE intent_id = ?")
      .run(intentId);
  }

  close(): void {
    this.db.close();
  }
}

function toRecord(row: Record<string, unknown>): JournalRecord {
  return {
    intentId: row.intent_id as string,
    proposalHash: row.proposal_hash as string,
    status: row.status as JournalRecord['status'],
    signature: (row.signature as string | null) ?? null,
    payer: row.payer as string,
    payee: row.payee as string,
    mint: row.mint as string,
    amountBaseUnits: row.amount_base_units as string,
    sourceAta: (row.source_ata as string | null) ?? null,
    destAta: (row.dest_ata as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
