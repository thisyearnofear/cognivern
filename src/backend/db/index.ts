import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../../data/cognivern.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'demo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS nonces (
      nonce TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at);
    CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
