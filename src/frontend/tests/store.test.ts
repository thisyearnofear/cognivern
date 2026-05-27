import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/stores/app-store";
import { DEMO_WORKSPACE, DEMO_AGENTS } from "@/lib/demo-data";

describe("App Store", () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.exitDemoMode();
    store.logout();
  });

  describe("workspace mode", () => {
    it("defaults to sandbox mode", () => {
      const { user } = useAppStore.getState();
      expect(user.workspaceMode).toBe("sandbox");
    });

    it("switches to production mode", () => {
      useAppStore.getState().setWorkspaceMode("production");
      expect(useAppStore.getState().user.workspaceMode).toBe("production");
    });

    it("switches back to sandbox mode", () => {
      useAppStore.getState().setWorkspaceMode("production");
      useAppStore.getState().setWorkspaceMode("sandbox");
      expect(useAppStore.getState().user.workspaceMode).toBe("sandbox");
    });
  });

  describe("demo mode", () => {
    it("starts with demo mode disabled", () => {
      expect(useAppStore.getState().demoMode).toBe(false);
    });

    it("enableDemoMode sets workspace and demo data", () => {
      useAppStore.getState().enableDemoMode();
      const state = useAppStore.getState();

      expect(state.demoMode).toBe(true);
      expect(state.user.workspace).toEqual(DEMO_WORKSPACE);
      expect(state.user.workspaceMode).toBe("sandbox");
      expect(state.demoData.agents).toEqual(DEMO_AGENTS);
      expect(state.demoData.auditLogs.length).toBeGreaterThan(0);
    });

    it("exitDemoMode clears demo state for unauthenticated users", () => {
      useAppStore.getState().enableDemoMode();
      useAppStore.getState().exitDemoMode();
      const state = useAppStore.getState();

      expect(state.demoMode).toBe(false);
      expect(state.user.workspace).toBeNull();
      expect(state.user.isConnected).toBe(false);
    });

    it("exitDemoMode preserves user session for authenticated users", () => {
      useAppStore.getState().enableDemoMode();
      // Simulate authenticated state
      useAppStore.setState({
        user: {
          ...useAppStore.getState().user,
          isConnected: true,
          walletAddress: "0x1234",
        },
      });
      useAppStore.getState().exitDemoMode();

      expect(useAppStore.getState().demoMode).toBe(false);
      expect(useAppStore.getState().user.isConnected).toBe(true);
    });
  });

  describe("audit log management", () => {
    it("addDemoAuditLog prepends new logs", () => {
      useAppStore.getState().enableDemoMode();
      const before = useAppStore.getState().demoData.auditLogs.length;

      useAppStore.getState().addDemoAuditLog({
        id: "test-log-1",
        agentId: "agent-1",
        action: "test.action",
        description: "Test log entry",
        decision: "approved",
        chain: "ethereum",
        timestamp: new Date().toISOString(),
      });

      const after = useAppStore.getState().demoData.auditLogs;
      expect(after.length).toBe(before + 1);
      expect(after[0].id).toBe("test-log-1");
    });

    it("addDemoAuditLog caps at 100 entries", () => {
      useAppStore.getState().enableDemoMode();

      for (let i = 0; i < 110; i++) {
        useAppStore.getState().addDemoAuditLog({
          id: `log-${i}`,
          agentId: "agent-1",
          action: "test",
          description: `Log ${i}`,
          decision: "approved",
          chain: "ethereum",
          timestamp: new Date().toISOString(),
        });
      }

      expect(useAppStore.getState().demoData.auditLogs.length).toBeLessThanOrEqual(100);
    });
  });

  describe("preferences", () => {
    it("defaults to dark theme", () => {
      expect(useAppStore.getState().preferences.theme).toBe("dark");
    });

    it("updates preferences", () => {
      useAppStore.getState().updatePreferences({ theme: "light" });
      expect(useAppStore.getState().preferences.theme).toBe("light");
    });

    it("merges preferences without overwriting", () => {
      useAppStore.getState().updatePreferences({ theme: "light" });
      useAppStore.getState().updatePreferences({ onboardingCompleted: true });
      const prefs = useAppStore.getState().preferences;
      expect(prefs.theme).toBe("light");
      expect(prefs.onboardingCompleted).toBe(true);
    });
  });
});
