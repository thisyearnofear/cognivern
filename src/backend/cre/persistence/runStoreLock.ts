import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export interface RunStoreLockOptions {
  /** A lock older than this is considered abandoned and is stolen. */
  staleMs?: number;
  /** Hard ceiling on how long to wait before giving up. */
  acquireTimeoutMs?: number;
  /** Pause between acquisition attempts. */
  retryMs?: number;
}

const DEFAULT_STALE_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_MS = 50;

/**
 * Cross-process mutual exclusion for the shared CRE run store files.
 *
 * The pm2 server and ad-hoc ops scripts (ledger repair, demo seeding, CI)
 * each keep their own in-memory run snapshot and write to the same JSONL.
 * Without a lock, a read-modify-write cycle in one process can interleave
 * with another's and silently evict runs. This lock serializes those cycles
 * so the store's merge-based writeAll() is safe even when writers share one
 * backing file.
 *
 * The lock is a plain advisory lockfile (atomic `wx` create). A holder that
 * crashes leaves a stale file behind; any other writer steals it once it is
 * older than `staleMs`.
 */
export async function withRunStoreLock<T>(
  lockPath: string,
  task: () => Promise<T>,
  options: RunStoreLockOptions = {},
): Promise<T> {
  const {
    staleMs = DEFAULT_STALE_MS,
    acquireTimeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS,
    retryMs = DEFAULT_RETRY_MS,
  } = options;

  await fs.promises.mkdir(path.dirname(lockPath), { recursive: true });
  const startedAt = Date.now();

  for (;;) {
    try {
      const handle = await fs.promises.open(lockPath, "wx");
      try {
        await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      } finally {
        await handle.close().catch(() => undefined);
      }
      // Refresh the lock's mtime while holding it so a slow-but-alive holder
      // (e.g. a large writeAll at a high maxRuns) is never mistaken for a
      // crashed one and stolen by a waiter.
      const refreshMs = Math.max(250, Math.min(staleMs / 3, 2000));
      const refresh = setInterval(() => {
        const now = new Date();
        fs.promises.utimes(lockPath, now, now).catch(() => undefined);
      }, refreshMs);
      refresh.unref?.();
      try {
        return await task();
      } finally {
        clearInterval(refresh);
        await fs.promises.unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") throw error;

      // The lock is held by someone else. Steal it if it looks abandoned,
      // otherwise retry until the acquisition timeout.
      try {
        const stat = await fs.promises.stat(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.promises.unlink(lockPath).catch(() => undefined);
          continue;
        }
      } catch {
        continue; // the lock vanished while we looked — retry immediately
      }

      if (Date.now() - startedAt > acquireTimeoutMs) {
        throw new Error(`Timed out acquiring CRE run store lock at ${lockPath}`);
      }
      await sleep(retryMs);
    }
  }
}
