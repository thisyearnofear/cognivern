/**
 * ValidationStore — server-recorded evidence that a cohort receipt travels.
 *
 * The mentor's North Star for the hackathon wedge: % of sponsored cohorts
 * where the organiser shares the report link within 7 days of cohort end.
 * Client-side beacons can't prove that to a judge, so the three signals
 * below are written by the server:
 *
 *   share events   — organiser copies/sends a `/verify?id=…` link (workspace
 *                    auth, so the actor is the program owner).
 *   open events    — the public verification page loads a commitment. Counted,
 *                    never identified: NO ip, user-agent, or fingerprint is
 *                    stored — an open is a timestamp on a commitment id.
 *   feedback       — organiser 1–5 usefulness rating + would-reuse flag.
 *
 * Reporting only. None of this gates, prices, or alters any money path.
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";

export interface ShareEventInput {
  programId: string;
  workspaceId: string;
  commitmentId: string;
}

export interface FeedbackInput {
  programId: string;
  workspaceId: string;
  usefulness: number;
  wouldReuse: boolean;
  note?: string | null;
}

export interface ValidationSummary {
  shareCount: number;
  lastSharedAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  feedbackCount: number;
  avgUsefulness: number | null;
  wouldReuseCount: number;
}

const EMPTY_SUMMARY: ValidationSummary = {
  shareCount: 0,
  lastSharedAt: null,
  openCount: 0,
  lastOpenedAt: null,
  feedbackCount: 0,
  avgUsefulness: null,
  wouldReuseCount: 0,
};

export class ValidationStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  /** Record an organiser share. Returns the event id. */
  recordShare(input: ShareEventInput): string {
    const id = `shr_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO report_share_events
           (id, program_id, workspace_id, commitment_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.programId, input.workspaceId, input.commitmentId, new Date().toISOString());
    return id;
  }

  /** Record a public verification-page open. No identity is captured by design. */
  recordOpen(commitmentId: string): string {
    const id = `opn_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO verify_open_events (id, commitment_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(id, commitmentId, new Date().toISOString());
    return id;
  }

  /** Record organiser feedback. Returns the feedback id. */
  recordFeedback(input: FeedbackInput): string {
    const id = `fdb_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO program_feedback
           (id, program_id, workspace_id, usefulness, would_reuse, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.programId,
        input.workspaceId,
        input.usefulness,
        input.wouldReuse ? 1 : 0,
        input.note ?? null,
        new Date().toISOString(),
      );
    return id;
  }

  /** Per-program aggregate for the report endpoint and the judges' slide. */
  summary(programId: string): ValidationSummary {
    const share = this.db
      .prepare(
        `SELECT COUNT(*) AS n, MAX(created_at) AS last_at
         FROM report_share_events WHERE program_id = ?`,
      )
      .get(programId) as Record<string, unknown>;
    const open = this.db
      .prepare(
        `SELECT COUNT(*) AS n, MAX(o.created_at) AS last_at
         FROM verify_open_events o
         JOIN credit_ledger_commitments c ON c.id = o.commitment_id
         WHERE c.program_id = ?`,
      )
      .get(programId) as Record<string, unknown>;
    const feedback = this.db
      .prepare(
        `SELECT COUNT(*) AS n, AVG(usefulness) AS avg_use,
                COALESCE(SUM(would_reuse), 0) AS reuse_n
         FROM program_feedback WHERE program_id = ?`,
      )
      .get(programId) as Record<string, unknown>;
    return {
      shareCount: Number(share.n ?? 0),
      lastSharedAt: (share.last_at as string | null) ?? null,
      openCount: Number(open.n ?? 0),
      lastOpenedAt: (open.last_at as string | null) ?? null,
      feedbackCount: Number(feedback.n ?? 0),
      avgUsefulness: feedback.avg_use === null ? null : Number(feedback.avg_use),
      wouldReuseCount: Number(feedback.reuse_n ?? 0),
    };
  }
}

let shared: ValidationStore | null = null;
export function sharedValidationStore(): ValidationStore {
  if (!shared) shared = new ValidationStore();
  return shared;
}
