/**
 * Database migration runner
 * Applies pending Drizzle migrations against the configured database.
 *
 * Usage: pnpm db:migrate
 *
 * Supports:
 *  - SQLite (default, file at ./data/cognivern.db)
 *  - Postgres (via DATABASE_URL=postgres://...); used in production / CI
 *  - Cloudflare D1 (production) — applied separately via wrangler
 *
 * The driver is selected based on the DATABASE_URL scheme:
 *   - file:... or no scheme → better-sqlite3
 *   - postgres:// or postgresql:// → drizzle-orm/postgres-js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/backend/db/migrations");

function getDbConfig(): {
  driver: "sqlite" | "postgres";
  connectionString: string;
} {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return {
      driver: "sqlite",
      connectionString: path.resolve(__dirname, "../../data/cognivern.db"),
    };
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return { driver: "postgres", connectionString: url };
  }
  if (url.startsWith("file:")) {
    return { driver: "sqlite", connectionString: url.slice("file:".length) };
  }
  return { driver: "sqlite", connectionString: url };
}

async function runSqliteMigrate(dbPath: string): Promise<void> {
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  // Ensure parent directory exists for the SQLite file
  const dir = path.dirname(dbPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[migrate] Created directory: ${dir}`);
  }

  console.log(`[migrate] SQLite database: ${dbPath}`);
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  try {
    migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully");
  } finally {
    sqlite.close();
  }
}

async function runPostgresMigrate(connectionString: string): Promise<void> {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");

  console.log(`[migrate] Postgres database: ${maskConnectionString(connectionString)}`);
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully");
  } finally {
    await sql.end();
  }
}

function maskConnectionString(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url;
  }
}

async function main() {
  const cfg = getDbConfig();
  console.log(`[migrate] Migrations folder: ${migrationsFolder}`);

  if (cfg.driver === "postgres") {
    await runPostgresMigrate(cfg.connectionString);
  } else {
    await runSqliteMigrate(cfg.connectionString);
  }
}

main().catch((error) => {
  console.error("[migrate] Migration failed:", error);
  process.exit(1);
});
