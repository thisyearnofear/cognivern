import { getDb } from "@backend/db/index.js";
import {
  hashStatementPayload,
  StatementService,
  type FundedMandateStatement,
} from "./StatementService.js";

export interface PublishedMandateStatement {
  id: string;
  version: number;
  workspaceId: string;
  mandateId: string;
  payload: FundedMandateStatement;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedMandateStatementSummary {
  id: string;
  version: number;
  contentHash: string;
  publishedAt: string;
  publishedBy: string;
}

export interface MandateStatementExport {
  redacted: true;
  statementId: string;
  version: number;
  publishedAt: string;
  originalContentHash: string;
  contentHash: string;
  payload: FundedMandateStatement;
}

type Row = Record<string, unknown>;

function rowToPublished(row: Row): PublishedMandateStatement {
  return {
    id: row.id as string,
    version: row.version as number,
    workspaceId: row.workspace_id as string,
    mandateId: row.mandate_id as string,
    payload: JSON.parse(row.payload as string) as FundedMandateStatement,
    publishedAt: row.published_at as string,
    publishedBy: row.published_by as string,
  };
}

function rowToSummary(row: Row): PublishedMandateStatementSummary {
  return {
    id: row.id as string,
    version: row.version as number,
    contentHash: row.content_hash as string,
    publishedAt: row.published_at as string,
    publishedBy: row.published_by as string,
  };
}

function findRow(
  workspaceId: string,
  mandateId: string,
  statementId: string,
): Row | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM published_mandate_statements WHERE id = ? AND workspace_id = ? AND mandate_id = ?",
    )
    .get(statementId, workspaceId, mandateId) as Row | undefined;
}

/**
 * Permissioned export redaction: strip operator commentary and internal
 * pointers (observation notes, sources, evidence references) while preserving
 * the capital, mandate framing, and receipt evidence needed for review.
 * Never mutates the stored snapshot; the export is hashed independently.
 */
function redactStatement(statement: FundedMandateStatement): FundedMandateStatement {
  const outcomes = statement.performance.outcomes.map((outcome) => ({
    ...outcome,
    source: "[redacted]",
    evidence: outcome.evidence.map((evidence) => ({
      type: evidence.type,
      reference: "[redacted]",
      ...(evidence.hash ? { hash: evidence.hash } : {}),
    })),
    ...(outcome.notes ? { notes: "[redacted]" } : {}),
  }));

  return {
    ...statement,
    performance: {
      ...statement.performance,
      outcomes,
    },
    evidence: {
      ...statement.evidence,
      externalReferences: statement.evidence.externalReferences.map(() => "[redacted]"),
    },
  };
}

export const PublishedStatementService = {
  async publish(
    workspaceId: string,
    mandateId: string,
    operatorUserId: string,
  ): Promise<PublishedMandateStatement> {
    const candidate = await StatementService.generateCandidate(workspaceId, mandateId);
    const rows = getDb()
      .prepare(
        "SELECT version FROM published_mandate_statements WHERE workspace_id = ? AND mandate_id = ? ORDER BY version DESC LIMIT 1",
      )
      .all(workspaceId, mandateId) as Array<{ version: number }>;
    const version = (rows[0]?.version ?? 0) + 1;
    const statementId = `statement-${mandateId}-v${version}`;
    const publishedAt = new Date().toISOString();

    // The frozen payload is the candidate with the published statementId and a
    // contentHash computed over that payload (excluding contentHash itself and
    // the candidate's generatedAt display timestamp), so the stored hash is
    // reproducible from the stored payload alone.
    const payload: FundedMandateStatement = {
      ...candidate,
      statementId,
      contentHash: hashStatementPayload({ ...candidate, statementId }),
    };

    getDb()
      .prepare(
        `INSERT INTO published_mandate_statements
          (id, workspace_id, mandate_id, version, payload, content_hash, published_by, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        statementId,
        workspaceId,
        mandateId,
        version,
        JSON.stringify(payload),
        payload.contentHash,
        operatorUserId,
        publishedAt,
      );

    const row = findRow(workspaceId, mandateId, statementId);
    if (!row) throw new Error("Published statement could not be persisted");
    return rowToPublished(row);
  },

  list(workspaceId: string, mandateId: string): PublishedMandateStatementSummary[] {
    const rows = getDb()
      .prepare(
        "SELECT * FROM published_mandate_statements WHERE workspace_id = ? AND mandate_id = ? ORDER BY version DESC",
      )
      .all(workspaceId, mandateId) as Row[];
    return rows.map(rowToSummary);
  },

  get(
    workspaceId: string,
    mandateId: string,
    statementId: string,
  ): PublishedMandateStatement | undefined {
    const row = findRow(workspaceId, mandateId, statementId);
    return row ? rowToPublished(row) : undefined;
  },

  export(
    workspaceId: string,
    mandateId: string,
    statementId: string,
  ): MandateStatementExport | undefined {
    const row = findRow(workspaceId, mandateId, statementId);
    if (!row) return undefined;
    const published = rowToPublished(row);
    const redacted = redactStatement(published.payload);
    const { contentHash: _originalContentHash, ...redactedContent } = redacted;
    const contentHash = hashStatementPayload(redactedContent);
    return {
      redacted: true,
      statementId: published.id,
      version: published.version,
      publishedAt: published.publishedAt,
      originalContentHash: published.payload.contentHash,
      contentHash,
      // Re-embed the export's own hash so the returned payload stays a full
      // statement shape and the hash is verifiable from the payload alone.
      payload: { ...redactedContent, contentHash },
    };
  },
};
