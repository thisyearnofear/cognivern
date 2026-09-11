#!/usr/bin/env node
/**
 * Idempotent SQLite seed for the self-host demo compose stack.
 * Creates a workspace + funded mandate so the UI is not empty on first boot.
 * Credentials are not created here — use wallet login / demo auth as usual.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH || "/app/data/cognivern.db";
const USER_ID = "selfhost-demo-user";
const WORKSPACE_ID = "selfhost-demo-workspace";
const MANDATE_ID = "selfhost-demo-mandate";
const AGENT_ID = "selfhost-demo-agent";
const POLICY_ID = "selfhost-demo-policy";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
const now = new Date().toISOString();

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
`);

// Tables are normally created by the backend on boot; INSERT OR IGNORE is
// safe either way. If the backend schema is ahead of this script, missing
// columns will throw — catch and exit non-zero so the entrypoint can log it.
try {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)",
  ).run(USER_ID, now, now);

  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE_ID, "Self-host Demo", USER_ID, now, now);

  db.prepare(
    "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
  ).run(WORKSPACE_ID, USER_ID, now);

  db.prepare(
    "INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(AGENT_ID, WORKSPACE_ID, "Demo Agent", "capital_operator", "evm", now, now);

  db.prepare(
    "INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(POLICY_ID, WORKSPACE_ID, "Demo budget policy", "budget", now, now);

  db.prepare(
    `INSERT OR IGNORE INTO funded_mandates
      (id, workspace_id, name, objective, agent_ids, status, budget_by_asset, policy_ids, measurement_window, success_metrics, settlement, outcome_sources, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    MANDATE_ID,
    WORKSPACE_ID,
    "Self-host demo mandate",
    "Prove governed spend locally: policy checks, CRE ledger, and outcome sync.",
    JSON.stringify([AGENT_ID]),
    "active",
    JSON.stringify({
      USDC: {
        authorizedAmount: "1000",
        allocatedAmount: "100",
        consumedAmount: "0",
        pendingAmount: "0",
      },
    }),
    JSON.stringify([POLICY_ID]),
    JSON.stringify({ startsAt: now }),
    JSON.stringify([
      {
        id: "deliverables",
        name: "Deliverables shipped",
        unit: "deliverables",
        target: "3",
      },
    ]),
    null,
    null,
    now,
    now,
  );

  console.log(
    JSON.stringify({
      ok: true,
      workspaceId: WORKSPACE_ID,
      mandateId: MANDATE_ID,
      dbPath: DB_PATH,
    }),
  );
} catch (error) {
  console.error(
    "seed-demo failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
} finally {
  db.close();
}
