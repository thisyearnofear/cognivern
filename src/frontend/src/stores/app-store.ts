import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPreferences {
  theme: "light" | "dark" | "system";
  onboardingCompleted: boolean;
  demoExplored: boolean;
  sidebarState: "expanded" | "collapsed";
}

interface User {
  isConnected: boolean;
}

interface AppState {
  user: User;
  preferences: UserPreferences;
  mode: 'demo' | 'live';
  setUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setMode: (mode: 'demo' | 'live') => void;
  toggleMode: () => void;
  enterDemoMode: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: "dark",
  onboardingCompleted: false,
  demoExplored: false,
  sidebarState: "expanded",
};

const defaultUser: User = {
  isConnected: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      preferences: defaultPreferences,
      mode: 'demo',
      setUser: (userData) =>
        set({ user: { ...get().user, ...userData } }),
      updatePreferences: (prefs) =>
        set({ preferences: { ...get().preferences, ...prefs } }),
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'demo' ? 'live' : 'demo' }),
      enterDemoMode: () =>
        set({
          mode: 'demo',
          preferences: {
            ...get().preferences,
            demoExplored: true,
          },
        }),
    }),
    {
      name: "cognivern-app-store",
    }
  )
);
