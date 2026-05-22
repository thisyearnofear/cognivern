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
  setUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
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
      setUser: (userData) =>
        set({ user: { ...get().user, ...userData } }),
      updatePreferences: (prefs) =>
        set({ preferences: { ...get().preferences, ...prefs } }),
      enterDemoMode: () =>
        set({
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
