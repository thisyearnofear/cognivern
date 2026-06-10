import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  theme: "light" | "dark" | "system";
  onboardingCompleted: boolean;
  sidebarState: "expanded" | "collapsed";
  updatePreferences: (prefs: Partial<Omit<PreferencesState, "updatePreferences">>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      onboardingCompleted: false,
      sidebarState: "expanded",
      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
    }),
    {
      name: "civern-preferences",
      partialize: (state) => ({
        theme: state.theme,
        onboardingCompleted: state.onboardingCompleted,
        sidebarState: state.sidebarState,
      }),
    },
  ),
);
