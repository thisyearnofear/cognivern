import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuditLogService } from "../../src/services/AuditLogService.js";
import { AuditLogStore } from "../../src/shared/storage/AuditLogStore.js";

test("AuditLogService persists logs deterministically", async (t) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "cognivern-audit-"),
  );
  const filePath = path.join(tempDir, "audit-logs.jsonl");

  await t.test("persisted logs survive a new service instance", async () => {
    const store = new AuditLogStore({ filePath });
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

    const reloadedService = new AuditLogService(new AuditLogStore({ filePath }));
    const logs = await reloadedService.getFilteredLogs({});

    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].agent, "recall");
    assert.strictEqual(logs[0].responseTime, 42);
    assert.strictEqual(logs[0].severity, "medium");
    assert.strictEqual(logs[0].complianceStatus, "warning");
  });

  await fs.promises.rm(tempDir, { recursive: true, force: true });
});
