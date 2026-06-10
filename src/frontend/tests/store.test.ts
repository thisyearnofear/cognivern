import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { DEMO_AGENTS } from "@/lib/demo-data";

describe("Auth Store", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe("workspace mode", () => {
    it("defaults to sandbox mode", () => {
      expect(useAuthStore.getState().workspaceMode).toBe("sandbox");
    });

    it("switches to production mode", () => {
      useAuthStore.getState().setWorkspaceMode("production");
      expect(useAuthStore.getState().workspaceMode).toBe("production");
    });

    it("switches back to sandbox mode", () => {
      useAuthStore.getState().setWorkspaceMode("production");
      useAuthStore.getState().setWorkspaceMode("sandbox");
      expect(useAuthStore.getState().workspaceMode).toBe("sandbox");
    });
  });
});

describe("Demo Store", () => {
  beforeEach(() => {
    useDemoStore.getState().exitDemoMode();
  });

  it("starts with demo mode disabled", () => {
    expect(useDemoStore.getState().demoMode).toBe(false);
  });

  it("enableDemoMode sets demo flag and data", () => {
    useDemoStore.getState().enableDemoMode();
    const state = useDemoStore.getState();

    expect(state.demoMode).toBe(true);
    expect(state.demoData.agents).toEqual(DEMO_AGENTS);
    expect(state.demoData.auditLogs.length).toBeGreaterThan(0);
  });

  it("exitDemoMode clears demo flag", () => {
    useDemoStore.getState().enableDemoMode();
    useDemoStore.getState().exitDemoMode();
    expect(useDemoStore.getState().demoMode).toBe(false);
  });

  it("addDemoAuditLog prepends new logs", () => {
    useDemoStore.getState().enableDemoMode();
    const before = useDemoStore.getState().demoData.auditLogs.length;

    useDemoStore.getState().addDemoAuditLog({
      id: "test-log-1",
      agentId: "agent-1",
      action: "test.action",
      description: "Test log entry",
      decision: "approved",
      chain: "ethereum",
      timestamp: new Date().toISOString(),
    });

    const after = useDemoStore.getState().demoData.auditLogs;
    expect(after.length).toBe(before + 1);
    expect(after[0].id).toBe("test-log-1");
  });

  it("addDemoAuditLog caps at 100 entries", () => {
    useDemoStore.getState().enableDemoMode();

    for (let i = 0; i < 110; i++) {
      useDemoStore.getState().addDemoAuditLog({
        id: `log-${i}`,
        agentId: "agent-1",
        action: "test",
        description: `Log ${i}`,
        decision: "approved",
        chain: "ethereum",
        timestamp: new Date().toISOString(),
      });
    }

    expect(useDemoStore.getState().demoData.auditLogs.length).toBeLessThanOrEqual(100);
  });
});

describe("Preferences Store", () => {
  beforeEach(() => {
    usePreferencesStore.getState().updatePreferences({
      theme: "dark",
      onboardingCompleted: false,
      sidebarState: "expanded",
    });
  });

  it("defaults to dark theme", () => {
    expect(usePreferencesStore.getState().theme).toBe("dark");
  });

  it("updates preferences", () => {
    usePreferencesStore.getState().updatePreferences({ theme: "light" });
    expect(usePreferencesStore.getState().theme).toBe("light");
  });

  it("merges preferences without overwriting", () => {
    usePreferencesStore.getState().updatePreferences({ theme: "light" });
    usePreferencesStore.getState().updatePreferences({ onboardingCompleted: true });
    const state = usePreferencesStore.getState();
    expect(state.theme).toBe("light");
    expect(state.onboardingCompleted).toBe(true);
  });
});
