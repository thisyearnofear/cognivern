import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, Workspace } from "@cognivern/shared";

interface AuthState {
  isConnected: boolean;
  walletAddress: string | null;
  authUser: AuthUser | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  token: string | null;
  workspaceMode: "sandbox" | "production";
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
  setWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspace: Workspace, token: string) => void;
  setWorkspaceMode: (mode: "sandbox" | "production") => void;
}

const defaultState = {
  isConnected: false,
  walletAddress: null,
  authUser: null,
  workspace: null,
  workspaces: [],
  token: null,
  workspaceMode: "sandbox" as const,
};

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
        if (typeof window !== "undefined") {
          localStorage.setItem("cognivern-token", token);
        }
      },
      logout: () => {
        set(defaultState);
        if (typeof window !== "undefined") {
          localStorage.removeItem("cognivern-token");
        }
      },
      setWorkspace: (workspace) => set({ workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      switchWorkspace: (workspace, token) => {
        set({ workspace, token });
        if (typeof window !== "undefined") {
          localStorage.setItem("cognivern-token", token);
        }
      },
      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
    }),
    {
      name: "civern-auth-store",
      partialize: (state) => ({
        isConnected: state.isConnected,
        walletAddress: state.walletAddress,
        authUser: state.authUser,
        workspace: state.workspace,
        workspaceMode: state.workspaceMode,
      }),
    }
  )
);
