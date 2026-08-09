import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CreRun } from "@backend/cre/types.js";

export type CreLedgerOp = "add" | "replace" | "truncate";

export interface CreLedgerEntry {
  seq: number;
  timestamp: string;
  op: CreLedgerOp;
  runId: string;
  /** sha256 of the run JSON at the time of the mutation ("-" for truncate). */
  runHash: string;
  prevHash: string;
  entryHash: string;
}

export interface CreLedgerVerification {
  valid: boolean;
  entries: number;
  headHash: string;
  /** First entry whose chain linkage or hash does not recompute. */
  brokenAtSeq?: number;
  reason?: string;
}

const GENESIS_HASH = `0x${"0".repeat(64)}`;

function sha256Hex(input: string): string {
  return `0x${crypto.createHash("sha256").update(input).digest("hex")}`;
}

function computeEntryHash(
  entry: Omit<CreLedgerEntry, "entryHash">,
): string {
  return sha256Hex(
    `${entry.prevHash}|${entry.seq}|${entry.op}|${entry.runId}|${entry.runHash}|${entry.timestamp}`,
  );
}

export function hashRun(run: CreRun): string {
  return sha256Hex(JSON.stringify(run));
}

/**
 * Append-only, hash-chained mutation ledger for CRE runs.
 *
 * The run store legitimately mutates runs (status transitions, approvals),
 * so the run file itself cannot be append-only. This sidecar records every
 * mutation as a chained entry: each entry hashes the previous entry, so
 * rewriting or deleting history breaks the chain and is detectable by
 * verify(). It makes tampering evident, not impossible — an attacker with
 * disk access can rebuild the whole chain, but cannot silently edit one run.
 */
export class CreLedgerChain {
  private filePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(params: { filePath?: string } = {}) {
    // Default next to the runs file so isolated test/dev stores get an
    // isolated ledger too.
    const runsFile = process.env.CRE_RUNS_FILE;
    this.filePath =
      params.filePath ||
      process.env.CRE_LEDGER_FILE ||
      (runsFile
        ? path.join(path.dirname(runsFile), "cre-ledger.jsonl")
        : path.join(process.cwd(), "data", "cre-ledger.jsonl"));
  }

  /** Serialize appends so seq/prevHash reads are never interleaved. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async readEntries(): Promise<CreLedgerEntry[]> {
    try {
      const data = await fs.promises.readFile(this.filePath, "utf8");
      return data
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l) as CreLedgerEntry);
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
  }

  private async loadTail(): Promise<{ seq: number; hash: string }> {
    // Always read the true tail from disk: the in-memory cache went stale the
    // moment another process appended (the pm2 server and ops scripts share
    // this file), which caused duplicate seq numbers and broken prevHash
    // chains. The file is tiny, so re-reading per append is cheap. The
    // per-instance queue still serializes appends within this process.
    const entries = await this.readEntries();
    const last = entries[entries.length - 1];
    return last
      ? { seq: last.seq, hash: last.entryHash }
      : { seq: 0, hash: GENESIS_HASH };
  }

  async record(op: CreLedgerOp, run?: CreRun): Promise<CreLedgerEntry> {
    return this.enqueue(async () => {
      const tail = await this.loadTail();
      const withoutHash: Omit<CreLedgerEntry, "entryHash"> = {
        seq: tail.seq + 1,
        timestamp: new Date().toISOString(),
        op,
        runId: run?.runId ?? "-",
        runHash: run ? hashRun(run) : "-",
        prevHash: tail.hash,
      };
      const entry: CreLedgerEntry = {
        ...withoutHash,
        entryHash: computeEntryHash(withoutHash),
      };
      await fs.promises.mkdir(path.dirname(this.filePath), {
        recursive: true,
      });
      await fs.promises.appendFile(
        this.filePath,
        `${JSON.stringify(entry)}\n`,
        "utf8",
      );
      return entry;
    });
  }

  async verify(): Promise<CreLedgerVerification> {
    const entries = await this.readEntries();
    let prevHash = GENESIS_HASH;
    let prevSeq = 0;
    for (const entry of entries) {
      if (entry.seq !== prevSeq + 1) {
        return {
          valid: false,
          entries: entries.length,
          headHash: prevHash,
          brokenAtSeq: entry.seq,
          reason: `sequence gap: expected ${prevSeq + 1}, found ${entry.seq}`,
        };
      }
      if (entry.prevHash !== prevHash) {
        return {
          valid: false,
          entries: entries.length,
          headHash: prevHash,
          brokenAtSeq: entry.seq,
          reason: "prevHash does not match the preceding entry",
        };
      }
      const { entryHash, ...rest } = entry;
      if (computeEntryHash(rest) !== entryHash) {
        return {
          valid: false,
          entries: entries.length,
          headHash: prevHash,
          brokenAtSeq: entry.seq,
          reason: "entryHash does not recompute from entry fields",
        };
      }
      prevHash = entryHash;
      prevSeq = entry.seq;
    }
    return { valid: true, entries: entries.length, headHash: prevHash };
  }

  /**
   * Latest recorded content hash per runId, for cross-checking the run
   * store against the chain.
   */
  async latestRunHashes(): Promise<Map<string, string>> {
    const entries = await this.readEntries();
    const map = new Map<string, string>();
    for (const entry of entries) {
      if (entry.op === "truncate") {
        map.clear();
      } else {
        map.set(entry.runId, entry.runHash);
      }
    }
    return map;
  }
}

export const creLedgerChain = new CreLedgerChain();
