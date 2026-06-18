/**
 * SQLite-backed store for Copilot runs and their events.
 *
 * Replaces the in-memory `Map` in CopilotController so that a run survives
 * a pm2 restart, an esbuild rebuild, or any lean deploy that reloads the
 * Node process. Without this, a user can start a run, the backend can
 * restart for any reason, and the next /confirm click returns 404.
 */

import { getDb } from "@backend/db/index.js";

export interface PersistedCopilotEvent {
  id: number;
  type: string;
  timestamp: string;
  name?: string;
  payload?: Record<string, unknown>;
}

export interface PersistedCopilotRun {
  id: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  summary?: string;
  error?: string;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  events: PersistedCopilotEvent[];
}

interface RunRow {
  id: string;
  goal: string;
  status: string;
  summary: string | null;
  error: string | null;
  preview: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: number;
  run_id: string;
  type: string;
  name: string | null;
  payload: string | null;
  timestamp: string;
}

function safeJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function rowToRun(row: RunRow, events: PersistedCopilotEvent[]): PersistedCopilotRun {
  return {
    id: row.id,
    goal: row.goal,
    status: row.status,
    summary: row.summary ?? undefined,
    error: row.error ?? undefined,
    preview: safeJson<Record<string, unknown>>(row.preview),
    result: safeJson<Record<string, unknown>>(row.result),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events,
  };
}

export class CopilotRunStore {
  create(input: {
    id: string;
    goal: string;
    createdAt: string;
    status: string;
  }): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO copilot_runs (id, goal, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(input.id, input.goal, input.status, input.createdAt, input.createdAt);
  }

  updateStatus(runId: string, status: string, updatedAt: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE copilot_runs SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(status, updatedAt, runId);
  }

  updateSummary(runId: string, summary: string, updatedAt: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE copilot_runs SET summary = ?, updated_at = ? WHERE id = ?`,
    ).run(summary, updatedAt, runId);
  }

  updateError(runId: string, error: string, updatedAt: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE copilot_runs SET error = ?, updated_at = ? WHERE id = ?`,
    ).run(error, updatedAt, runId);
  }

  updatePreview(
    runId: string,
    preview: Record<string, unknown>,
    updatedAt: string,
  ): void {
    const db = getDb();
    db.prepare(
      `UPDATE copilot_runs SET preview = ?, updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(preview), updatedAt, runId);
  }

  updateResult(
    runId: string,
    result: Record<string, unknown>,
    updatedAt: string,
  ): void {
    const db = getDb();
    db.prepare(
      `UPDATE copilot_runs SET result = ?, updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(result), updatedAt, runId);
  }

  appendEvent(
    runId: string,
    event: { id: number; type: string; timestamp: string; name?: string; payload?: Record<string, unknown> },
  ): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO copilot_events (id, run_id, type, name, payload, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      event.id,
      runId,
      event.type,
      event.name ?? null,
      event.payload ? JSON.stringify(event.payload) : null,
      event.timestamp,
    );
    db.prepare(
      `UPDATE copilot_runs SET updated_at = ? WHERE id = ?`,
    ).run(event.timestamp, runId);
  }

  get(runId: string): PersistedCopilotRun | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, goal, status, summary, error, preview, result, created_at, updated_at
         FROM copilot_runs WHERE id = ?`,
      )
      .get(runId) as RunRow | undefined;

    if (!row) return null;

    const eventRows = db
      .prepare(
        `SELECT id, run_id, type, name, payload, timestamp
         FROM copilot_events WHERE run_id = ? ORDER BY id ASC`,
      )
      .all(runId) as EventRow[];

    const events: PersistedCopilotEvent[] = eventRows.map((eventRow) => ({
      id: eventRow.id,
      type: eventRow.type,
      timestamp: eventRow.timestamp,
      name: eventRow.name ?? undefined,
      payload: safeJson<Record<string, unknown>>(eventRow.payload),
    }));

    return rowToRun(row, events);
  }

  /**
   * Return the N most recent runs, newest first. Used to render the
   * recent-decisions rail on the Copilot page so users can revisit or
   * re-run prior missions after they've made a decision.
   */
  listRecent(limit: number): PersistedCopilotRun[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, goal, status, summary, error, preview, result, created_at, updated_at
         FROM copilot_runs
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as RunRow[];

    return rows.map((row) => {
      const eventRows = db
        .prepare(
          `SELECT id, run_id, type, name, payload, timestamp
           FROM copilot_events WHERE run_id = ? ORDER BY id ASC`,
        )
        .all(row.id) as EventRow[];
      const events: PersistedCopilotEvent[] = eventRows.map((eventRow) => ({
        id: eventRow.id,
        type: eventRow.type,
        timestamp: eventRow.timestamp,
        name: eventRow.name ?? undefined,
        payload: safeJson<Record<string, unknown>>(eventRow.payload),
      }));
      return rowToRun(row, events);
    });
  }
}

export const copilotRunStore = new CopilotRunStore();
