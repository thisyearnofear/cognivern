import { getDb } from "@backend/db/index.js";

const TTL_MS = 86_400_000; // 24 hours

export class TokenBlacklistStore {
  async isBlacklisted(tokenHash: string): Promise<boolean> {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT 1 FROM token_blacklist WHERE token_hash = ? AND expires_at > ?",
      )
      .get(tokenHash, Date.now()) as Record<string, unknown> | undefined;
    return !!row;
  }

  async blacklist(tokenHash: string, ttlMs: number = TTL_MS): Promise<void> {
    const db = getDb();
    const now = Date.now();
    db.prepare(
      "INSERT OR REPLACE INTO token_blacklist (token_hash, revoked_at, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).run(tokenHash, now, now, now + ttlMs);
  }

  async cleanupExpired(): Promise<number> {
    const db = getDb();
    const result = db
      .prepare("DELETE FROM token_blacklist WHERE expires_at <= ?")
      .run(Date.now());
    return result.changes;
  }
}

export const tokenBlacklistStore = new TokenBlacklistStore();