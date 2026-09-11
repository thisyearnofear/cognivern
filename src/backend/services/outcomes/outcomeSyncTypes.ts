/**
 * Shared report shapes for mandate outcome-source sync (GitHub, Langfuse, …).
 * Kept separate so connectors can import types without circular deps.
 */

export interface OutcomeSourceSyncReport {
  sourceType: "github" | "langfuse";
  /** github: owner/repo; langfuse: project */
  scope: string;
  /** @deprecated Prefer `scope`. Kept for GitHub report consumers. */
  repo?: string;
  mode: "pr" | "commits" | "scores" | "traces";
  fetched: number;
  ingested: number;
  replayed: number;
  skipped: number;
  error?: string;
}

export interface OutcomeSyncResult {
  mandateId: string;
  sources: OutcomeSourceSyncReport[];
  totalIngested: number;
  totalReplayed: number;
}
