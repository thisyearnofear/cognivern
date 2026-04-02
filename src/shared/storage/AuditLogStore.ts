import { BaseStore } from "./BaseStore.js";
import type { AuditLog } from "../../services/AuditLogService.js";

/**
 * Durable audit log store backed by JSONL.
 *
 * Reuses the shared BaseStore foundation so audit persistence follows the same
 * loading, truncation, and bounded-cache patterns as the other stores.
 */
export class AuditLogStore extends BaseStore<AuditLog> {
  constructor(params: { filePath?: string } = {}) {
    super({
      filePath: params.filePath,
      envVar: "AUDIT_LOGS_FILE",
      defaultFilename: "audit-logs.jsonl",
      maxRecords: 10000,
    });
  }

  protected parseLine(line: string): { key: string; record: AuditLog } | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed.key && parsed.record) {
        return { key: parsed.key, record: parsed.record as AuditLog };
      }
      if (parsed.id) {
        return { key: parsed.id, record: parsed as AuditLog };
      }
      return null;
    } catch {
      return null;
    }
  }

  protected serializeRecord(key: string, record: AuditLog): string {
    return JSON.stringify({ key, record });
  }

  async add(log: AuditLog): Promise<void> {
    await this.set(log.id, log);
  }

  async list(): Promise<AuditLog[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.values()).sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  }
}

export const auditLogStore = new AuditLogStore();
