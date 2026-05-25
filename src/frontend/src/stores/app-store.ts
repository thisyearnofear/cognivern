import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, Workspace } from '@cognivern/shared';

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
}

interface AppState {
  user: User;
  preferences: UserPreferences;
  setUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  login: (token: string, authUser: AuthUser, workspace: Workspace) => void;
  logout: () => void;
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
};

const isBrowser = typeof window !== 'undefined';

export const useAppStore = create<AppState>()(
  isBrowser
    ? persist(
        (set, get) => ({
          user: defaultUser,
          preferences: defaultPreferences,
          setUser: (userData) => set({ user: { ...get().user, ...userData } }),
          updatePreferences: (prefs) => set({ preferences: { ...get().preferences, ...prefs } }),
          login: (token: string, authUser: AuthUser, workspace: Workspace) => {
            set({
              user: {
                isConnected: true,
                walletAddress: authUser.walletAddress,
                authUser,
                workspace,
                token,
              },
            });
            localStorage.setItem('cognivern-token', token);
          },
          logout: () => {
            set({ user: defaultUser });
            localStorage.removeItem('cognivern-token');
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
            },
          }),
        },
      )
    : (set) => ({
        user: defaultUser,
        preferences: defaultPreferences,
        setUser: () => {},
        updatePreferences: () => {},
        login: () => {},
        logout: () => {},
      }),
);
