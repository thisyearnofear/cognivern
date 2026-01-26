import { create } from "zustand";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  onboardingCompleted: boolean;
  lastVisited: string;
  dashboardLayout: "simplified" | "advanced";
  notifications: boolean;
}

export interface User {
  address?: string;
  userType?: string;
  isConnected: boolean;
}

interface AppState {
  // User state
  user: User;
  preferences: UserPreferences;

  // UI state
  activeTab: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  completeOnboarding: (userType: string) => void;
  reset: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: "system",
  sidebarCollapsed: false,
  onboardingCompleted: false,
  lastVisited: "/",
  dashboardLayout: "simplified",
  notifications: true,
};

const defaultUser: User = {
  isConnected: false,
};

// Simple persist implementation without middleware
const persistKey = "cognivern-app-store";

const getStoredState = () => {
  try {
    const stored = localStorage.getItem(persistKey);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setStoredState = (state: Partial<AppState>) => {
  try {
    const toStore = {
      user: state.user,
      preferences: state.preferences,
    };
    localStorage.setItem(persistKey, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
};

export const useAppStore = create<AppState>((set, get) => {
  // Load initial state from localStorage
  const stored = getStoredState();

  const initialState = {
    user: { ...defaultUser, ...stored.user },
    preferences: { ...defaultPreferences, ...stored.preferences },
    activeTab: "dashboard",
    isLoading: false,
    error: null,
  };

  return {
    ...initialState,

    // Actions
    setUser: (userData) => {
      const newState = {
        ...get(),
        user: { ...get().user, ...userData },
      };
      set(newState);
      setStoredState(newState);
    },

    updatePreferences: (prefs) => {
      const newState = {
        ...get(),
        preferences: { ...get().preferences, ...prefs },
      };
      set(newState);
      setStoredState(newState);
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
      // Update last visited
      const { updatePreferences } = get();
      updatePreferences({ lastVisited: tab });
    },

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    completeOnboarding: (userType) => {
      const newState = {
        ...get(),
        user: { ...get().user, userType },
        preferences: { ...get().preferences, onboardingCompleted: true },
        activeTab: "dashboard",
      };
      set(newState);
      setStoredState(newState);
    },

    reset: () => {
      const resetState = {
        user: defaultUser,
        preferences: defaultPreferences,
        activeTab: "dashboard",
        isLoading: false,
        error: null,
      };
      set(resetState);
      localStorage.removeItem(persistKey);
    },
  };
});

// Utility hook for theme detection
export const useTheme = () => {
  const { preferences } = useAppStore();

  const getEffectiveTheme = () => {
    if (preferences.theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return preferences.theme;
  };

  return {
    theme: preferences.theme,
    effectiveTheme: getEffectiveTheme(),
    isDark: getEffectiveTheme() === "dark",
  };
};
