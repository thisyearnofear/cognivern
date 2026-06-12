import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { mockAnchor } = vi.hoisted(() => ({
  mockAnchor: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/backend/services/ZeroGStorageService.js", () => ({
  zeroGStorageService: {
    anchorAuditRecord: mockAnchor,
  },
}));

vi.mock("../../src/backend/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AuditLogService } from "../../src/backend/services/AuditLogService.js";
import { CreRunStore } from "../../src/backend/cre/storage/CreRunStore.js";
import { JsonlCreRunPersistence } from "../../src/backend/cre/persistence/CreRunPersistence.js";

describe("AuditLogService persists logs deterministically via CRE store", () => {
  it("persisted logs survive a new service instance", async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cognivern-audit-"),
    );
    const filePath = path.join(tempDir, "audit-logs.jsonl");

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

    const reloadedPersistence = new JsonlCreRunPersistence({ filePath });
    const reloadedStore = new CreRunStore({ persistence: reloadedPersistence });
    const reloadedService = new AuditLogService(reloadedStore);
    const logs = await reloadedService.getFilteredLogs({});

    expect(logs.length).toBe(1);
    expect(logs[0].agent).toBe("recall");
    expect(logs[0].responseTime).toBe(42);
    expect(logs[0].severity).toBe("low");
    expect(logs[0].complianceStatus).toBe("compliant");

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});

describe("AuditLogService captures 0G rootHash in CRE evidence", () => {
  it("logAction stores zeroGRootHash when anchor succeeds", async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cognivern-audit-0g-"),
    );
    const filePath = path.join(tempDir, "audit-logs.jsonl");

    const persistence = new JsonlCreRunPersistence({ filePath });
    const store = new CreRunStore({ persistence });
    const service = new AuditLogService(store);

    mockAnchor.mockResolvedValueOnce({
      rootHash: "0xzeroroot",
      localHash: "abc123",
      network: "0g-newton-testnet",
      timestamp: new Date().toISOString(),
    });

    await service.logAction(
      {
        type: "spend",
        description: "test spend",
        timestamp: new Date().toISOString(),
        metadata: { agentId: "agent-1", durationMs: 50 },
      },
      [],
      true,
    );

    // Wait for fire-and-forget .then(replace) to flush
    await new Promise((r) => setTimeout(r, 50));

    const runs = await store.list();
    expect(runs.length).toBe(1);
    expect(runs[0].evidence?.zeroGRootHash).toBe("0xzeroroot");

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("logEvent stores zeroGRootHash when anchor succeeds", async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cognivern-audit-0g-evt-"),
    );
    const filePath = path.join(tempDir, "audit-logs.jsonl");

    const persistence = new JsonlCreRunPersistence({ filePath });
    const store = new CreRunStore({ persistence });
    const service = new AuditLogService(store);

    mockAnchor.mockResolvedValueOnce({
      rootHash: "0xeventroot",
      localHash: "def456",
      network: "0g-newton-testnet",
      timestamp: new Date().toISOString(),
    });

    await service.logEvent({
      eventType: "agent_registration",
      agentType: "test-agent",
      timestamp: new Date(),
      details: { latencyMs: 10 },
    });

    await new Promise((r) => setTimeout(r, 50));

    const runs = await store.list();
    expect(runs.length).toBe(1);
    expect(runs[0].evidence?.zeroGRootHash).toBe("0xeventroot");

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
