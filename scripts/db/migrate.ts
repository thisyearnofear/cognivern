/**
 * Database migration runner
 * Applies pending Drizzle migrations against the SQLite database.
 *
 * Usage: pnpm db:migrate
 *
 * For Cloudflare D1 (production), migrations are applied via:
 *   wrangler d1 execute cognivern-d1 --file=./src/backend/db/migrations/<timestamp>.sql
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_URL || path.resolve(__dirname, "../../data/cognivern.db");
const migrationsFolder = path.resolve(__dirname, "../../src/backend/db/migrations");

console.log(`[migrate] Database: ${dbPath}`);
console.log(`[migrate] Migrations folder: ${migrationsFolder}`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder });
  console.log("[migrate] All migrations applied successfully");
} catch (error) {
  console.error("[migrate] Migration failed:", error);
  process.exit(1);
} finally {
  sqlite.close();
}
