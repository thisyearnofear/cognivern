import { create } from "zustand";
import type { Agent, AuditLog, Policy, Run } from "@cognivern/shared";
import {
  DEMO_AGENTS,
  DEMO_POLICIES,
  DEMO_AUDIT_LOGS,
  DEMO_RUNS,
} from "@/lib/demo-data";

interface DemoState {
  demoMode: boolean;
  demoData: {
    agents: Agent[];
    auditLogs: AuditLog[];
    policies: Policy[];
    runs: Run[];
  };
  enableDemoMode: () => void;
  exitDemoMode: () => void;
  addDemoAuditLog: (log: AuditLog) => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  demoMode: false,
  demoData: {
    agents: DEMO_AGENTS,
    auditLogs: DEMO_AUDIT_LOGS,
    policies: DEMO_POLICIES,
    runs: DEMO_RUNS,
  },
  enableDemoMode: () =>
    set({
      demoMode: true,
      demoData: {
        agents: DEMO_AGENTS,
        auditLogs: DEMO_AUDIT_LOGS,
        policies: DEMO_POLICIES,
        runs: DEMO_RUNS,
      },
    }),
  // Note: callers are responsible for not clearing auth state on demo exit.
  // Check useAuthStore().isConnected at call site before deciding whether to
  // redirect to landing page. The demo store only controls the demo flag.
  exitDemoMode: () => set({ demoMode: false }),  addDemoAuditLog: (log: AuditLog) =>
    set({
      demoData: {
        ...get().demoData,
        auditLogs: [log, ...get().demoData.auditLogs].slice(0, 100),
      },
    }),
}));
