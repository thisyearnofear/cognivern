/**
 * Schema guards for sponsored credits.
 *
 * The static test in here exists because of a real deployment trap: the backend
 * artifact copies only `dist/`, and `.sql` files are never emitted there, so
 * `runFileMigrations()` finds no migrations directory and returns early in
 * production. A table declared ONLY in `src/backend/db/migrations/*.sql` exists
 * on every developer's machine and on none of the servers.
 *
 * Every production table is therefore created by the inline `migrate()` in
 * `db/index.ts`, with the `.sql` file kept in sync for drizzle-kit. These tests
 * assert both halves so the next person to add a table cannot silently ship a
 * feature whose storage does not exist.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-schema-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");

const CREDIT_TABLES = [
  "credit_programs",
  "credit_participants",
  "credit_ledger",
  "inference_records",
] as const;

beforeAll(() => {
  getDb();
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

describe("fresh database bootstrap", () => {
  it("creates every sponsored-credits table", () => {
    const db = getDb();
    const names = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
          name: string;
        }>
      ).map((r) => r.name),
    );

    for (const table of CREDIT_TABLES) {
      expect(names.has(table), `missing table: ${table}`).toBe(true);
    }
  });

  it("creates the indexes the gateway's hot paths depend on", () => {
    const db = getDb();
    const names = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{
          name: string;
        }>
      ).map((r) => r.name),
    );

    // Key lookup on every single gateway request.
    expect(names.has("idx_credit_participants_key_prefix")).toBe(true);
    // Handle uniqueness, which the provisioning transaction relies on.
    expect(names.has("credit_participants_handle_unique")).toBe(true);
    expect(names.has("idx_credit_ledger_participant")).toBe(true);
    expect(names.has("idx_inference_records_participant")).toBe(true);
  });

  it("stores money columns as INTEGER so balances stay exact", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(credit_participants)").all() as Array<{
      name: string;
      type: string;
    }>;

    const moneyColumns = columns.filter((c) => c.name.endsWith("_nano"));
    expect(moneyColumns.length).toBeGreaterThan(0);
    for (const column of moneyColumns) {
      expect(column.type.toUpperCase(), `${column.name} must be INTEGER`).toBe("INTEGER");
    }
  });

  it("re-opening an existing database is idempotent", () => {
    // migrate() runs again on every getDb() after closeDb(); a non-idempotent
    // statement would throw here rather than on some future deploy.
    closeDb();
    expect(() => getDb()).not.toThrow();

    const db = getDb();
    const count = db
      .prepare(
        `SELECT COUNT(*) AS c FROM sqlite_master
         WHERE type = 'table' AND name IN ('credit_programs','credit_participants','credit_ledger','inference_records')`,
      )
      .get() as { c: number };
    expect(count.c).toBe(4);
  });
});

describe("production migration path", () => {
  it("declares every credits table in the inline migrate(), not only in .sql", () => {
    // Guards the dist/ trap described at the top of this file.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/backend/db/index.ts"),
      "utf8",
    );

    for (const table of CREDIT_TABLES) {
      expect(
        source.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
        `${table} is missing from the inline migrate() in db/index.ts, so it will not exist in production`,
      ).toBe(true);
    }
  });

  it("keeps the .sql migration in sync for drizzle tooling", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "src/backend/db/migrations/0003_sponsored_credits.sql"),
      "utf8",
    );

    for (const table of CREDIT_TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});
