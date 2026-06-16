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
  /**
   * Monotonic counter the AuthWatcher toast increments to ask the auth
   * hook to run signIn(). Lets the toast button actually trigger the
   * SIWE flow without coupling the watcher to the wagmi context.
   */
  signInRequestId: number;
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
  setWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspace: Workspace, token: string) => void;
  setWorkspaceMode: (mode: "sandbox" | "production") => void;
  setHasHydrated: (hydrated: boolean) => void;
  requestSignIn: () => void;
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
  signInRequestId: 0,
};

const STORAGE_NAME = "civern-auth-store";

/**
 * Returns true when a JWT's `exp` claim is in the past (or the token is
 * malformed). Used on rehydration so a returning user with an expired
 * session isn't shown a logged-in UI whose every API call 401s.
 */
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return false;
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

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
      requestSignIn: () =>
        set((state) => ({ signInRequestId: state.signInRequestId + 1 })),
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
        // If the persisted token has expired, drop the session so the UI
        // doesn't render as authenticated while the API rejects everything.
        if (state && isTokenExpired(state.token)) {
          state.isConnected = false;
          state.walletAddress = null;
          state.authUser = null;
          state.workspace = null;
          state.token = null;
        }
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
