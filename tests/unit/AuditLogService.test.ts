import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuditLogService } from "../../src/services/AuditLogService.js";
import { CreRunStore } from "../../src/cre/storage/CreRunStore.js";
import { JsonlCreRunPersistence } from "../../src/cre/persistence/CreRunPersistence.js";

test("AuditLogService persists logs deterministically via CRE store", async (t) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "cognivern-audit-"),
  );
  const filePath = path.join(tempDir, "audit-logs.jsonl");

  await t.test("persisted logs survive a new service instance", async () => {
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

    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].agent, "recall");
    assert.strictEqual(logs[0].responseTime, 42);
    assert.strictEqual(logs[0].severity, "medium");
    assert.strictEqual(logs[0].complianceStatus, "warning");
  });

  await fs.promises.rm(tempDir, { recursive: true, force: true });
});
