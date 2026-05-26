import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, Workspace, Agent, AuditLog, Policy, Run } from '@cognivern/shared';
import {
  DEMO_WORKSPACE,
  DEMO_AGENTS,
  DEMO_AUDIT_LOGS,
  DEMO_POLICIES,
  DEMO_RUNS,
} from '@/lib/demo-data';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  onboardingCompleted: boolean;
  sidebarState: 'expanded' | 'collapsed';
}

interface User {
  isConnected: boolean;
  walletAddress: string | null;
  authUser: AuthUser | null;
  workspace: Workspace | null;
  token: string | null;
  workspaceMode: 'sandbox' | 'production';
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
  setWorkspaceMode: (mode: 'sandbox' | 'production') => void;
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
  enableDemoMode: () => void;
  exitDemoMode: () => void;
  addDemoAuditLog: (log: AuditLog) => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  onboardingCompleted: false,
  sidebarState: 'expanded',
};

const defaultUser: User = {
  isConnected: false,
  walletAddress: null,
  authUser: null,
  workspace: null,
  token: null,
  workspaceMode: 'sandbox',
};

const defaultDemoData: DemoData = {
  agents: DEMO_AGENTS,
  auditLogs: DEMO_AUDIT_LOGS,
  policies: DEMO_POLICIES,
  runs: DEMO_RUNS,
};

const isBrowser = typeof window !== 'undefined';

export const useAppStore = create<AppState>()(
  isBrowser
    ? persist(
        (set, get) => ({
          user: defaultUser,
          preferences: defaultPreferences,
          demoMode: false,
          demoData: defaultDemoData,
          setUser: (userData) => set({ user: { ...get().user, ...userData } }),
          updatePreferences: (prefs) => set({ preferences: { ...get().preferences, ...prefs } }),
          setWorkspaceMode: (mode) => set({ user: { ...get().user, workspaceMode: mode } }),
          login: (token: string, authUser: AuthUser, workspace: Workspace) => {
            set({
              user: {
                isConnected: true,
                walletAddress: authUser.walletAddress,
                authUser,
                workspace,
                token,
                workspaceMode: get().user.workspaceMode,
              },
            });
            localStorage.setItem('cognivern-token', token);
          },
          logout: () => {
            set({ user: defaultUser });
            localStorage.removeItem('cognivern-token');
          },
          enableDemoMode: () => {
            set({
              demoMode: true,
              user: {
                ...defaultUser,
                workspace: DEMO_WORKSPACE,
                workspaceMode: 'sandbox',
              },
              demoData: defaultDemoData,
            });
          },
          exitDemoMode: () => {
            set({ demoMode: false, user: defaultUser });
          },
          addDemoAuditLog: (log) => {
            set({
              demoData: {
                ...get().demoData,
                auditLogs: [log, ...get().demoData.auditLogs].slice(0, 100),
              },
            });
          },
        }),
        {
          name: 'civern-app-store',
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
        },
      )
    : (set) => ({
        user: defaultUser,
        preferences: defaultPreferences,
        demoMode: false,
        demoData: defaultDemoData,
        setUser: () => {},
        updatePreferences: () => {},
        setWorkspaceMode: () => {},
        login: () => {},
        logout: () => {},
        enableDemoMode: () => {},
        exitDemoMode: () => {},
        addDemoAuditLog: () => {},
      }),
);
