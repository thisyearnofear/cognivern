-- Sponsored inference credits: a sponsor (e.g. a hackathon organiser) funds a
-- pool, participants draw from it through the metered gateway, and every call
-- lands as an append-only ledger line plus an inference record.
--
-- Money is stored as INTEGER nano-USD (1e-9 USD) so arithmetic is exact and
-- never touches floating point. $20 => 20_000_000_000. A $1,000 pool is 1e12,
-- comfortably inside Number.MAX_SAFE_INTEGER (~9e15).

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
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_programs_workspace
  ON credit_programs (workspace_id, status);
--> statement-breakpoint

-- One row per participant. The denormalised counters (allocated/consumed/held)
-- are the authoritative balance and are only ever mutated inside the same
-- SQLite transaction that appends the matching credit_ledger line.
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
  FOREIGN KEY (program_id) REFERENCES credit_programs(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS credit_participants_handle_unique
  ON credit_participants (program_id, handle);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_participants_program
  ON credit_participants (program_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_participants_key_prefix
  ON credit_participants (key_prefix);
--> statement-breakpoint

-- Append-only. Never UPDATE or DELETE a row here: a correction is a new
-- compensating line. amount_nano is signed (credits positive, debits negative).
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_participant
  ON credit_ledger (participant_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_program
  ON credit_ledger (program_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_ref
  ON credit_ledger (ref_type, ref_id);
--> statement-breakpoint

-- One row per gateway call. Content columns (task_class / project_tag /
-- *_excerpt) are written ONLY when the participant's disclosure tier permits
-- it: storage is tier-gated at write time, not filtered at read time, so a
-- participant on the `private` tier has no content on disk to leak.
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inference_records_participant
  ON inference_records (participant_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inference_records_program
  ON inference_records (program_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inference_records_model
  ON inference_records (program_id, model);
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_commitments_program
  ON credit_ledger_commitments (program_id, created_at);
