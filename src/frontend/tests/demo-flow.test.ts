import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import {
  DEMO_AGENTS,
  DEMO_AUDIT_LOGS,
  generateDemoAuditLog,
} from "@/lib/demo-data";

describe("Demo flow integration", () => {
  beforeEach(() => {
    useDemoStore.getState().exitDemoMode();
    useAuthStore.getState().logout();
  });

  it("enableDemoMode activates demo state with data", () => {
    expect(useDemoStore.getState().demoMode).toBe(false);

    useDemoStore.getState().enableDemoMode();

    const state = useDemoStore.getState();
    expect(state.demoMode).toBe(true);
    expect(state.demoData.agents.length).toBeGreaterThan(0);
    expect(state.demoData.auditLogs.length).toBeGreaterThan(0);
    expect(state.demoData.policies.length).toBeGreaterThan(0);
    expect(state.demoData.runs.length).toBeGreaterThan(0);
  });

  it("addDemoAuditLog prepends and caps at 100 entries", () => {
    useDemoStore.getState().enableDemoMode();

    const before = useDemoStore.getState().demoData.auditLogs.length;
    const newLog = generateDemoAuditLog();
    useDemoStore.getState().addDemoAuditLog(newLog);

    const after = useDemoStore.getState().demoData.auditLogs;
    expect(after.length).toBe(before + 1);
    expect(after[0].id).toBe(newLog.id);
  });

  it("exitDemoMode clears demo flag", () => {
    useDemoStore.getState().enableDemoMode();
    expect(useDemoStore.getState().demoMode).toBe(true);

    useDemoStore.getState().exitDemoMode();

    expect(useDemoStore.getState().demoMode).toBe(false);
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
