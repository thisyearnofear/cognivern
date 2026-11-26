import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setSoundEnabled } from "@/lib/tactile-sound";

interface PreferencesState {
  theme: "light" | "dark" | "system";
  onboardingCompleted: boolean;
  sidebarState: "expanded" | "collapsed";
  soundEnabled: boolean;
  updatePreferences: (prefs: Partial<Omit<PreferencesState, "updatePreferences">>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      onboardingCompleted: false,
      sidebarState: "expanded",
      soundEnabled: false,
      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
    }),
    {
      name: "civern-preferences",
      partialize: (state) => ({
        theme: state.theme,
        onboardingCompleted: state.onboardingCompleted,
        sidebarState: state.sidebarState,
        soundEnabled: state.soundEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        setSoundEnabled(state?.soundEnabled ?? false);
      },
    },
  ),
);

usePreferencesStore.subscribe((state) => {
  setSoundEnabled(state.soundEnabled);
});
