import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuditLogService } from "../../src/backend/services/AuditLogService.js";
import { CreRunStore } from "../../src/backend/cre/storage/CreRunStore.js";
import { JsonlCreRunPersistence } from "../../src/backend/cre/persistence/CreRunPersistence.js";

describe("AuditLogService persists logs deterministically via CRE store", () => {
  it("persisted logs survive a new service instance", async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cognivern-audit-"),
    );
    const filePath = path.join(tempDir, "audit-logs.jsonl");

    // Setup a store with local persistence only for testing
    const persistence = new JsonlCreRunPersistence({ filePath });
    const store = new CreRunStore({ persistence });
    const service = new AuditLogService(store);

    await service.logEvent({
      eventType: "agent_registration",
      agentType: "recall",
      timestamp: new Date("2025-01-01T00:00:00.000Z"),
      details: {
        latencyMs: 42,
        severity: "medium",
        complianceStatus: "warning",
      },
    });

    // Create a new store/service pointing to the same file
    const reloadedPersistence = new JsonlCreRunPersistence({ filePath });
    const reloadedStore = new CreRunStore({ persistence: reloadedPersistence });
    const reloadedService = new AuditLogService(reloadedStore);
    const logs = await reloadedService.getFilteredLogs({});

    expect(logs.length).toBe(1);
    expect(logs[0].agent).toBe("recall");
    expect(logs[0].responseTime).toBe(42);
    expect(logs[0].severity).toBe("medium");
    expect(logs[0].complianceStatus).toBe("warning");

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
