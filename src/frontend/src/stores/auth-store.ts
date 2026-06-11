import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser, Workspace } from "@cognivern/shared";

interface AuthState {
  isConnected: boolean;
  walletAddress: string | null;
  authUser: AuthUser | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  token: string | null;
  workspaceMode: "sandbox" | "production";
  hasHydrated: boolean;
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
  setWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspace: Workspace, token: string) => void;
  setWorkspaceMode: (mode: "sandbox" | "production") => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const defaultState = {
  isConnected: false,
  walletAddress: null,
  authUser: null,
  workspace: null,
  workspaces: [],
  token: null,
  workspaceMode: "sandbox" as const,
  hasHydrated: false,
};

const STORAGE_NAME = "civern-auth-store";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...defaultState,
      login: (token, authUser, workspace) => {
        set({
          isConnected: true,
          walletAddress: authUser.walletAddress ?? null,
          authUser,
          workspace,
          token,
        });
      },
      logout: () => {
        set({ ...defaultState, hasHydrated: true });
      },
      setWorkspace: (workspace) => set({ workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      switchWorkspace: (workspace, token) => {
        set({ workspace, token });
      },
      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        walletAddress: state.walletAddress,
        authUser: state.authUser,
        workspace: state.workspace,
        token: state.token,
        workspaceMode: state.workspaceMode,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated after rehydration so the UI can render
        // without flashing the unauthenticated default state.
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * React hook helper: returns `true` once the persisted auth state has been
 * read from localStorage. UI that depends on auth state (sign-in button,
 * dashboard redirect, socket connection) should wait for this.
 */
export function useAuthHydrated(): boolean {
  return useAuthStore((s) => s.hasHydrated);
}
