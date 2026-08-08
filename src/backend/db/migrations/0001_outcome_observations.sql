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
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS outcome_observations_idempotency_unique
  ON outcome_observations (workspace_id, mandate_id, idempotency_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_outcome_observations_mandate
  ON outcome_observations (workspace_id, mandate_id, observed_at);