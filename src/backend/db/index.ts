import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "../../../data/cognivern.db");

let db: Database.Database | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

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

/**
 * Returns a Drizzle ORM instance for type-safe queries.
 * Uses the same underlying SQLite database as getDb().
 */
export function getDrizzleDb() {
  if (!drizzleDb) {
    const raw = getDb();
    drizzleDb = drizzle(raw);
  }
  return drizzleDb;
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
      activated_at TEXT,
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

    CREATE TABLE IF NOT EXISTS workspace_agents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      chain TEXT NOT NULL,
      wallet_address TEXT,
      budget TEXT,
      trades INTEGER NOT NULL DEFAULT 0,
      spend_history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS workspace_policies (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      rules TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at);
    CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_workspace_agents_workspace ON workspace_agents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_policies_workspace ON workspace_policies(workspace_id);
  `);

  // Migration: add source / webhook_url to workspace_agents (idempotent)
  try {
    db.exec(
      `ALTER TABLE workspace_agents ADD COLUMN source TEXT NOT NULL DEFAULT 'managed'`,
    );
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE workspace_agents ADD COLUMN webhook_url TEXT`);
  } catch {
    /* already exists */
  }

  // Migration: add email auth fields to users (idempotent)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT UNIQUE`);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires_at TEXT`);
  } catch {
    /* already exists */
  }

  // Migration: add auth method to users (idempotent)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'wallet'`);
  } catch {
    /* already exists */
  }

  // Migration: workspace_members (multi-workspace support)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  // Backfill existing owners into workspace_members
  db.exec(`
    INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at)
    SELECT id, owner_id, 'owner', created_at FROM workspaces;
  `);

  // Migration: policy_versions (policy versioning support)
  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_versions (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      rules TEXT NOT NULL DEFAULT '[]',
      snapshot_at TEXT NOT NULL,
      FOREIGN KEY (policy_id) REFERENCES workspace_policies(id),
      FOREIGN KEY (workspace_id) REFERENCES workspace_policies(workspace_id)
    );
    CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);
  `);

  // Migration: copilot_runs + copilot_events (live demo persistence)
  // Replaces the in-memory Map that lost runs on every pm2 restart.
  db.exec(`
    CREATE TABLE IF NOT EXISTS copilot_runs (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      error TEXT,
      preview TEXT,
      result TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS copilot_events (
      id INTEGER NOT NULL,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT,
      payload TEXT,
      timestamp TEXT NOT NULL,
      PRIMARY KEY (run_id, id),
      FOREIGN KEY (run_id) REFERENCES copilot_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_copilot_events_run ON copilot_events(run_id);
  `);

  // Migration: token_blacklist (survives restarts, replaces file-based store)
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      token_hash TEXT PRIMARY KEY,
      revoked_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
  `);

  // Run file-based migrations (supplements inline migrations above)
  runFileMigrations(db);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    drizzleDb = null;
  }
}

/**
 * Run file-based migrations from the migrations/ directory.
 * Tracks applied migrations in a _migrations table to avoid re-running.
 * Forward-only — no rollback support.
 */
function runFileMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const applied = new Set(
    (
      db
        .prepare("SELECT name FROM _migrations")
        .all() as { name: string }[]
    ).map((r) => r.name),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      db.exec(stmt);
    }

    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      file,
      new Date().toISOString(),
    );
  }
}
