import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser, Workspace } from "@cognivern/shared";
import { useDemoStore } from "./demo-store";

interface AuthState {
  isConnected: boolean;
  walletAddress: string | null;
  authUser: AuthUser | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  token: string | null;
  workspaceMode: "sandbox" | "production";
  /**
   * Sticky flag: true once the user has been through the new-user sandbox
   * orientation (clicked Switch to Production, explicitly opened the
   * "View sandbox demo" tool, or — once wired — created their first real
   * artifact). Persisted across logout so a returning user doesn't get the
   * "what is all this?" amber banner a second time. The banner gates on
   * this, and login() forces production mode when it's true.
   */
  hasExitedSandbox: boolean;
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
  setHasExitedSandbox: (value: boolean) => void;
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
  hasExitedSandbox: false,
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
        // Exit demo mode on real login. useApiWithDemo() short-circuits to
        // demoData while demoMode is true; without this, a user who toured
        // the demo and then signed in would see the seeded run-001 series
        // instead of their actual runs.
        if (useDemoStore.getState().demoMode) {
          useDemoStore.getState().exitDemoMode();
        }
        // Returning users who have already graduated from sandbox should
        // land on production mode by default — they don't need the
        // orientation banner again. New users keep the persisted (or
        // default) sandbox mode so they get the banner once.
        const previous = useAuthStore.getState();
        const nextWorkspaceMode = previous.hasExitedSandbox
          ? "production"
          : previous.workspaceMode;
        set({
          isConnected: true,
          walletAddress: authUser.walletAddress ?? null,
          authUser,
          workspace,
          token,
          workspaceMode: nextWorkspaceMode,
        });
      },
      logout: () => {
        // Preserve hasExitedSandbox across logout: it's a per-browser fact
        // about whether the user has already gone through orientation,
        // independent of any particular session. Clearing it would push
        // a returning user back into the new-user sandbox onboarding.
        const preservedExit = useAuthStore.getState().hasExitedSandbox;
        set({
          ...defaultState,
          hasExitedSandbox: preservedExit,
          hasHydrated: true,
        });
      },
      setWorkspace: (workspace) => set({ workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      switchWorkspace: (workspace, token) => {
        set({ workspace, token });
      },
      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
      setHasExitedSandbox: (value) => set({ hasExitedSandbox: value }),
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
        hasExitedSandbox: state.hasExitedSandbox,
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
