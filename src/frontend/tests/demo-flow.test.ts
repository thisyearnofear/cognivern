import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/stores/app-store";
import {
  DEMO_WORKSPACE,
  DEMO_AGENTS,
  DEMO_AUDIT_LOGS,
  generateDemoAuditLog,
} from "@/lib/demo-data";

describe("Demo flow integration", () => {
  beforeEach(() => {
    // Reset store to known baseline
    useAppStore.getState().exitDemoMode();
  });

  it("enableDemoMode activates demo state with workspace and data", () => {
    const store = useAppStore.getState();
    expect(store.demoMode).toBe(false);
    expect(store.user.workspace).toBeNull();

    store.enableDemoMode();

    const after = useAppStore.getState();
    expect(after.demoMode).toBe(true);
    expect(after.user.workspace).toEqual(DEMO_WORKSPACE);
    expect(after.user.workspaceMode).toBe("sandbox");
    expect(after.demoData.agents.length).toBeGreaterThan(0);
    expect(after.demoData.auditLogs.length).toBeGreaterThan(0);
    expect(after.demoData.policies.length).toBeGreaterThan(0);
    expect(after.demoData.runs.length).toBeGreaterThan(0);
  });

  it("addDemoAuditLog prepends and caps at 100 entries", () => {
    useAppStore.getState().enableDemoMode();

    const before = useAppStore.getState().demoData.auditLogs.length;
    const newLog = generateDemoAuditLog();
    useAppStore.getState().addDemoAuditLog(newLog);

    const after = useAppStore.getState().demoData.auditLogs;
    expect(after.length).toBe(before + 1);
    expect(after[0].id).toBe(newLog.id);
  });

  it("exitDemoMode clears demo state and workspace", () => {
    useAppStore.getState().enableDemoMode();
    expect(useAppStore.getState().demoMode).toBe(true);

    useAppStore.getState().exitDemoMode();

    const after = useAppStore.getState();
    expect(after.demoMode).toBe(false);
    expect(after.user.workspace).toBeNull();
    expect(after.user.isConnected).toBe(false);
  });

  it("demo agents have required fields for the UI", () => {
    for (const agent of DEMO_AGENTS) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(["active", "paused", "inactive"]).toContain(agent.status);
      expect(typeof agent.trades).toBe("number");
    }
  });

  it("demo audit logs have required fields for the UI", () => {
    for (const log of DEMO_AUDIT_LOGS) {
      expect(log.id).toBeTruthy();
      expect(log.agentId).toBeTruthy();
      expect(log.action).toBeTruthy();
      expect(log.description).toBeTruthy();
      expect(log.decision).toBeTruthy();
      expect(log.chain).toBeTruthy();
      expect(log.timestamp).toBeTruthy();
    }
  });

  it("generated audit logs match the required shape", () => {
    const log = generateDemoAuditLog();
    expect(log.id).toMatch(/^log-/);
    expect(log.agentId).toBeTruthy();
    expect(log.action).toBeTruthy();
    expect(log.decision).toBeTruthy();
    expect(log.chain).toBeTruthy();
    expect(log.timestamp).toBeTruthy();
  });
});
