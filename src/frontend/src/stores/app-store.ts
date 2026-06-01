import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuthUser,
  Workspace,
  Agent,
  AuditLog,
  Policy,
  Run,
} from "@cognivern/shared";
import {
  DEMO_WORKSPACE,
  DEMO_AGENTS,
  DEMO_AUDIT_LOGS,
  DEMO_POLICIES,
  DEMO_RUNS,
} from "@/lib/demo-data";

interface UserPreferences {
  theme: "light" | "dark" | "system";
  onboardingCompleted: boolean;
  sidebarState: "expanded" | "collapsed";
}

interface User {
  isConnected: boolean;
  walletAddress: string | null;
  authUser: AuthUser | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  token: string | null;
  workspaceMode: "sandbox" | "production";
}

interface DemoData {
  agents: Agent[];
  auditLogs: AuditLog[];
  policies: Policy[];
  runs: Run[];
}

interface AppState {
  user: User;
  preferences: UserPreferences;
  demoMode: boolean;
  demoData: DemoData;
  setUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setWorkspaceMode: (mode: "sandbox" | "production") => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspace: Workspace, token: string) => void;
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
  enableDemoMode: () => void;
  exitDemoMode: () => void;
  addDemoAuditLog: (log: AuditLog) => void;
}

const defaultPreferences: UserPreferences = {
  theme: "dark",
  onboardingCompleted: false,
  sidebarState: "expanded",
};

const defaultUser: User = {
  isConnected: false,
  walletAddress: null,
  authUser: null,
  workspace: null,
  workspaces: [],
  token: null,
  workspaceMode: "sandbox",
};

const defaultDemoData: DemoData = {
  agents: DEMO_AGENTS,
  auditLogs: DEMO_AUDIT_LOGS,
  policies: DEMO_POLICIES,
  runs: DEMO_RUNS,
};

const storeImpl = (set: (partial: Partial<AppState>) => void, get: () => AppState) => ({
  user: defaultUser,
  preferences: defaultPreferences,
  demoMode: false,
  demoData: defaultDemoData,
  setUser: (userData: Partial<User>) =>
    set({ user: { ...get().user, ...userData } }),
  updatePreferences: (prefs: Partial<UserPreferences>) =>
    set({ preferences: { ...get().preferences, ...prefs } }),
  setWorkspaceMode: (mode: "sandbox" | "production") =>
    set({ user: { ...get().user, workspaceMode: mode } }),
  setWorkspaces: (workspaces: Workspace[]) =>
    set({ user: { ...get().user, workspaces } }),
  switchWorkspace: (workspace: Workspace, token: string) => {
    set({
      user: {
        ...get().user,
        workspace,
        token,
      },
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("cognivern-token", token);
    }
  },
  login: (token: string, authUser: AuthUser, workspace: Workspace) => {
    set({
      demoMode: false,
      user: {
        isConnected: true,
        walletAddress: authUser.walletAddress ?? null,
        authUser,
        workspace,
        workspaces: get().user.workspaces ?? [],
        token,
        workspaceMode:
          get().user.workspaceMode === "sandbox" && get().demoMode
            ? "sandbox"
            : get().user.workspaceMode,
      },
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("cognivern-token", token);
    }
  },
  logout: () => {
    set({ user: defaultUser });
    if (typeof window !== "undefined") {
      localStorage.removeItem("cognivern-token");
    }
  },
  enableDemoMode: () => {
    set({
      demoMode: true,
      user: {
        ...defaultUser,
        workspace: DEMO_WORKSPACE,
        workspaceMode: "sandbox",
      },
      demoData: defaultDemoData,
    });
  },
  exitDemoMode: () => {
    const current = get().user;
    if (current.isConnected) {
      set({ demoMode: false });
    } else {
      set({ demoMode: false, user: defaultUser });
    }
  },
  addDemoAuditLog: (log: AuditLog) => {
    set({
      demoData: {
        ...get().demoData,
        auditLogs: [log, ...get().demoData.auditLogs].slice(0, 100),
      },
    });
  },
});

const isBrowser = typeof window !== "undefined";

export const useAppStore = create<AppState>()(
  isBrowser
    ? persist(storeImpl, {
        name: "civern-app-store",
        partialize: (state) => ({
          preferences: state.preferences,
          user: {
            isConnected: state.user.isConnected,
            walletAddress: state.user.walletAddress,
            authUser: state.user.authUser,
            workspace: state.user.workspace,
            workspaceMode: state.user.workspaceMode,
          },
          demoMode: state.demoMode,
        }),
      })
    : storeImpl,
);
