import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "../../../data/cognivern.db");

/**
 * Check if a column exists in a table (used for idempotent ALTER TABLE).
 * Must be called outside db.exec() — uses a prepared statement.
 */
function columnExists(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const rows = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

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
  // Create users table with full schema (idempotent — IF NOT EXISTS)
  // wallet_address is nullable — email-based users (auth_method='email')
  // don't have a wallet address at registration time.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE,
      email TEXT,
      password_hash TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      auth_method TEXT DEFAULT 'wallet' NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );
  `);

  // Add missing columns to existing users tables (from older inline migrations
  // that only had wallet_address). Each ALTER is guarded by a column existence
  // check to avoid "duplicate column name" errors.
  const userCols = [
    { name: "email", sql: "ALTER TABLE users ADD COLUMN email TEXT" },
    { name: "password_hash", sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { name: "email_verified", sql: "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0" },
    { name: "verification_token", sql: "ALTER TABLE users ADD COLUMN verification_token TEXT" },
    { name: "reset_token", sql: "ALTER TABLE users ADD COLUMN reset_token TEXT" },
    { name: "reset_token_expires_at", sql: "ALTER TABLE users ADD COLUMN reset_token_expires_at TEXT" },
    { name: "auth_method", sql: "ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'wallet' NOT NULL" },
  ];
  for (const col of userCols) {
    if (!columnExists(db, "users", col.name)) {
      db.exec(col.sql);
    }
  }

  // Email registration inserts rows without a wallet address. Older inline
  // migrations created users.wallet_address as NOT NULL, so any DB that
  // predates the nullable schema fails the INSERT with
  // SQLITE_CONSTRAINT_NOTNULL. SQLite cannot ALTER a column to drop a NOT
  // NULL constraint, so rebuild the table with the current schema when the
  // stale constraint is detected. Column data is preserved by name; FK
  // enforcement is toggled off for the swap because workspaces references
  // users(id).
  const userTableCols = db.pragma("table_info(users)") as Array<{
    name: string;
    notnull: number;
  }>;
  const walletAddressNotNull =
    userTableCols.find((c) => c.name === "wallet_address")?.notnull === 1;
  if (walletAddressNotNull) {
    const keepCols = userTableCols.map((c) => `"${c.name}"`).join(", ");
    const fkWasOn = db.pragma("foreign_keys", { simple: true });
    db.pragma("foreign_keys = OFF");
    db.exec(`
      BEGIN;
      CREATE TABLE users_rebuild (
        id TEXT PRIMARY KEY,
        wallet_address TEXT UNIQUE,
        email TEXT,
        password_hash TEXT,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expires_at TEXT,
        auth_method TEXT DEFAULT 'wallet' NOT NULL,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );
      INSERT INTO users_rebuild (${keepCols}) SELECT ${keepCols} FROM users;
      DROP TABLE users;
      ALTER TABLE users_rebuild RENAME TO users;
      COMMIT;
    `);
    db.pragma(`foreign_keys = ${fkWasOn ? "ON" : "OFF"}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'demo',
      activated_at TEXT,
      settings TEXT,
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
      imported INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    -- TEE-sealed spend mandates bound to API keys: the key cannot overspend
    -- its mandate because evaluation runs in the enclave (Flare FCC), not in
    -- this database. policy_id is derived from the key id, never chosen by
    -- callers, so demo/user policy ids can never collide with mandates.
    CREATE TABLE IF NOT EXISTS key_mandates (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL UNIQUE,
      workspace_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      daily_limit_usd TEXT NOT NULL,
      per_tx_usd TEXT NOT NULL,
      approval_threshold_usd TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sealed_tx_hash TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
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

    CREATE TABLE IF NOT EXISTS funded_mandates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      agent_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      budget_by_asset TEXT NOT NULL DEFAULT '{}',
      policy_ids TEXT NOT NULL DEFAULT '[]',
      measurement_window TEXT,
      success_metrics TEXT NOT NULL DEFAULT '[]',
      settlement TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS hydra_context_sync_jobs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      mandate_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_hydra_context_sync_jobs_due
      ON hydra_context_sync_jobs(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_hydra_context_sync_jobs_scope
      ON hydra_context_sync_jobs(workspace_id, mandate_id, status);

    CREATE TABLE IF NOT EXISTS outcome_observations (
      id TEXT PRIMARY KEY,
      mandate_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      metric_id TEXT,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      unit TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      idempotency_key TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (mandate_id) REFERENCES funded_mandates(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      UNIQUE (workspace_id, mandate_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS published_mandate_statements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      mandate_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      published_by TEXT NOT NULL,
      published_at TEXT NOT NULL,
      FOREIGN KEY (mandate_id) REFERENCES funded_mandates(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      UNIQUE (workspace_id, mandate_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at);
    CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_workspace_agents_workspace ON workspace_agents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_policies_workspace ON workspace_policies(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_funded_mandates_workspace ON funded_mandates(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_outcome_observations_mandate ON outcome_observations(workspace_id, mandate_id, observed_at);
    CREATE INDEX IF NOT EXISTS idx_published_statements_mandate ON published_mandate_statements(workspace_id, mandate_id);
    -- Composite indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_workspace_agents_workspace_status ON workspace_agents(workspace_id, status);
    CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_revoked ON api_keys(workspace_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_workspace_policies_workspace_status ON workspace_policies(workspace_id, status);
  `);

  // Compatibility guard for databases that were created by an older partial
  // bootstrap before outcome observations were introduced. The normal CREATE
  // Existing DBs: api_keys predates the imported flag (BYO credentials) and
  // key_mandates — CREATE TABLE IF NOT EXISTS never alters, so migrate
  // idempotently here (key_mandates is created fresh by the template above).
  if (!columnExists(db, "api_keys", "imported")) {
    db.exec("ALTER TABLE api_keys ADD COLUMN imported INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(db, "hydra_context_sync_jobs", "last_synced_at")) {
    db.exec("ALTER TABLE hydra_context_sync_jobs ADD COLUMN last_synced_at TEXT");
  }

  // TABLE path above handles new databases; these targeted ALTERs keep an
  // existing table from silently missing fields used by the service.
  const outcomeColumns = [
    { name: "mandate_id", sql: "ALTER TABLE outcome_observations ADD COLUMN mandate_id TEXT" },
    { name: "workspace_id", sql: "ALTER TABLE outcome_observations ADD COLUMN workspace_id TEXT" },
    { name: "metric_id", sql: "ALTER TABLE outcome_observations ADD COLUMN metric_id TEXT" },
    { name: "kind", sql: "ALTER TABLE outcome_observations ADD COLUMN kind TEXT DEFAULT 'observed'" },
    { name: "value", sql: "ALTER TABLE outcome_observations ADD COLUMN value TEXT DEFAULT ''" },
    { name: "unit", sql: "ALTER TABLE outcome_observations ADD COLUMN unit TEXT DEFAULT ''" },
    { name: "observed_at", sql: "ALTER TABLE outcome_observations ADD COLUMN observed_at TEXT DEFAULT ''" },
    { name: "source", sql: "ALTER TABLE outcome_observations ADD COLUMN source TEXT DEFAULT ''" },
    { name: "confidence", sql: "ALTER TABLE outcome_observations ADD COLUMN confidence TEXT DEFAULT 'self_reported'" },
    { name: "evidence", sql: "ALTER TABLE outcome_observations ADD COLUMN evidence TEXT DEFAULT '[]'" },
    { name: "notes", sql: "ALTER TABLE outcome_observations ADD COLUMN notes TEXT" },
    { name: "idempotency_key", sql: "ALTER TABLE outcome_observations ADD COLUMN idempotency_key TEXT DEFAULT ''" },
    { name: "payload_hash", sql: "ALTER TABLE outcome_observations ADD COLUMN payload_hash TEXT DEFAULT ''" },
    { name: "created_at", sql: "ALTER TABLE outcome_observations ADD COLUMN created_at TEXT DEFAULT ''" },
  ];
  for (const col of outcomeColumns) {
    if (!columnExists(db, "outcome_observations", col.name)) db.exec(col.sql);
  }
  const invalidOutcomeKeys = db
    .prepare(
      `SELECT workspace_id, mandate_id, idempotency_key, COUNT(*) AS count
       FROM outcome_observations
       WHERE workspace_id IS NULL OR TRIM(workspace_id) = ''
          OR mandate_id IS NULL OR TRIM(mandate_id) = ''
          OR idempotency_key IS NULL OR TRIM(idempotency_key) = ''
       GROUP BY workspace_id, mandate_id, idempotency_key
       UNION ALL
       SELECT workspace_id, mandate_id, idempotency_key, COUNT(*) AS count
       FROM outcome_observations
       GROUP BY workspace_id, mandate_id, idempotency_key
       HAVING COUNT(*) > 1`,
    )
    .all() as Array<{ workspace_id: string; mandate_id: string; idempotency_key: string | null; count: number }>;
  if (invalidOutcomeKeys.length > 0) {
    throw new Error(
      "Outcome observation migration found blank workspace/mandate references or duplicate idempotency keys; repair this data before starting the service",
    );
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS outcome_observations_idempotency_unique ON outcome_observations (workspace_id, mandate_id, idempotency_key)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_outcome_observations_mandate ON outcome_observations (workspace_id, mandate_id, observed_at)");

  // Migration: funded_mandates.settlement (Cleanverse / verified-capital constraints)
  try {
    db.exec(`ALTER TABLE funded_mandates ADD COLUMN settlement TEXT`);
  } catch {
    /* already exists */
  }

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
    CREATE INDEX IF NOT EXISTS idx_copilot_events_run_timestamp ON copilot_events(run_id, timestamp);
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

  // Migration: add settings column to workspaces (idempotent)
  try {
    db.exec(`ALTER TABLE workspaces ADD COLUMN settings TEXT;`);
  } catch {
    // Column already exists
  }

  // Migration: sponsored inference credits (metered gateway).
  //
  // Declared inline, not left to the .sql file in migrations/, because the
  // deploy artifact copies only dist/ and .sql files never land there — so
  // runFileMigrations() finds no directory and returns early in production.
  // Every table that must exist on the deployed backend is created here; the
  // matching 0003_sponsored_credits.sql keeps drizzle-kit and local file
  // migrations in sync. Both paths are CREATE ... IF NOT EXISTS, so whichever
  // runs first wins and the other is a no-op.
  //
  // Money columns are INTEGER nano-USD (1e-9 USD) — see services/credits/money.ts.
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sponsor_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      backend TEXT NOT NULL DEFAULT 'zerog-router',
      pool_nano INTEGER NOT NULL DEFAULT 0,
      base_allocation_nano INTEGER NOT NULL DEFAULT 0,
      allowed_models TEXT NOT NULL DEFAULT '[]',
      max_output_tokens INTEGER,
      max_input_tokens INTEGER,
      starts_at TEXT,
      ends_at TEXT,
      disclosure_multipliers TEXT NOT NULL DEFAULT '{}',
      require_trust_mode TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS credit_participants (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT,
      project_tag TEXT,
      disclosure_tier TEXT NOT NULL DEFAULT 'standard',
      base_allocation_nano INTEGER NOT NULL DEFAULT 0,
      allocated_nano INTEGER NOT NULL DEFAULT 0,
      consumed_nano INTEGER NOT NULL DEFAULT 0,
      held_nano INTEGER NOT NULL DEFAULT 0,
      overdrawn_nano INTEGER NOT NULL DEFAULT 0,
      request_count INTEGER NOT NULL DEFAULT 0,
      key_hash TEXT,
      key_prefix TEXT,
      key_issued_at TEXT,
      last_used_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (program_id) REFERENCES credit_programs(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    -- Append-only: corrections are new compensating lines, never UPDATEs.
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount_nano INTEGER NOT NULL,
      balance_after_nano INTEGER NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (participant_id) REFERENCES credit_participants(id)
    );

    -- Content columns (task_class / project_tag / *_excerpt) are written ONLY
    -- when the participant's disclosure tier permits it. See
    -- services/credits/disclosure.ts fieldsPersistedAt().
    CREATE TABLE IF NOT EXISTS inference_records (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      disclosure_tier TEXT NOT NULL,
      backend TEXT NOT NULL,
      provider TEXT,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      denied_reason TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      cost_nano INTEGER NOT NULL DEFAULT 0,
      raw_cost_native TEXT,
      pricing_source TEXT,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      streamed INTEGER NOT NULL DEFAULT 0,
      trust_tier TEXT,
      tee_verified INTEGER NOT NULL DEFAULT 0,
      upstream_request_id TEXT,
      prompt_digest TEXT,
      response_digest TEXT,
      redaction_count INTEGER NOT NULL DEFAULT 0,
      redaction_categories TEXT NOT NULL DEFAULT '[]',
      task_class TEXT,
      project_tag TEXT,
      prompt_excerpt TEXT,
      response_excerpt TEXT,
      audit_run_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (participant_id) REFERENCES credit_participants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_credit_programs_workspace ON credit_programs(workspace_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS credit_participants_handle_unique ON credit_participants(program_id, handle);
    CREATE INDEX IF NOT EXISTS idx_credit_participants_program ON credit_participants(program_id, status);
    CREATE INDEX IF NOT EXISTS idx_credit_participants_key_prefix ON credit_participants(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_credit_ledger_participant ON credit_ledger(participant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_ledger_program ON credit_ledger(program_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_ledger_ref ON credit_ledger(ref_type, ref_id);
    CREATE INDEX IF NOT EXISTS idx_inference_records_participant ON inference_records(participant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inference_records_program ON inference_records(program_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inference_records_model ON inference_records(program_id, model);

    -- Anchored ledger commitments: a Merkle root over per-participant balance
    -- states, anchored to 0G Storage + Filecoin so balances are externally
    -- verifiable (see services/credits/LedgerCommitmentService.ts). Status is
    -- 'anchored' when at least one store accepted the payload, 'pending'
    -- otherwise. proof_map holds per-participant inclusion proofs (JSON) so
    -- receipts can be served without rebuilding the tree.
    CREATE TABLE IF NOT EXISTS credit_ledger_commitments (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      commitment_root TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      participant_count INTEGER NOT NULL DEFAULT 0,
      high_water_mark TEXT,
      zerog_root_hash TEXT,
      zerog_tx_hash TEXT,
      filecoin_cid TEXT,
      filecoin_tx_hash TEXT,
      filecoin_action_id TEXT,
      proof_map TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (program_id) REFERENCES credit_programs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_credit_commitments_program ON credit_ledger_commitments(program_id, created_at);
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
      try {
        db.exec(stmt);
      } catch (error) {
        // The inline bootstrap schema predates file migrations and may have
        // already created one of the known legacy objects. Treat only the
        // duplicate-object errors from that legacy migration as idempotent;
        // surface all other migration failures.
        const duplicateLegacyObject =
          file === "0000_slim_master_mold.sql" &&
          error instanceof Error &&
          /already exists/i.test(error.message);
        if (!duplicateLegacyObject) {
          throw error;
        }
      }
    }

    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      file,
      new Date().toISOString(),
    );
  }
}
