CREATE TABLE IF NOT EXISTS published_mandate_statements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS published_statements_version_unique
  ON published_mandate_statements (workspace_id, mandate_id, version);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_published_statements_mandate
  ON published_mandate_statements (workspace_id, mandate_id);