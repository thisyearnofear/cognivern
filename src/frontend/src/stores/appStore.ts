import { create } from 'zustand';

export type SidebarState = 'expanded' | 'collapsed' | 'hidden' | 'overlay';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebarState: SidebarState;
  onboardingCompleted: boolean;
  demoExplored: boolean; // User has seen the demo
  demoValueSeen: boolean; // User reached an "aha moment" (e.g., saw policy enforcement in action)
  lastVisited: string;
  notifications: boolean;
  shadowedAgents: string[];
}

export interface User {
  address?: string;
  userType?: string;
  isConnected: boolean;
  network?: 'filecoin' | 'xlayer';
  // OWS governance wallet (single source of truth)
  owsWalletConnected: boolean;
  owsWalletAddress?: string;
  owsWalletName?: string;
  owsWalletChain?: string;
  // Fhenix Confidential Compute
  fhenixConnected: boolean;
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
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  markDemoValueSeen: () => void;
  reset: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  sidebarState: 'expanded',
  onboardingCompleted: false,
  demoExplored: false,
  demoValueSeen: false,
  lastVisited: '/',
  notifications: true,
  shadowedAgents: [],
};

const defaultUser: User = {
  isConnected: false,
  owsWalletConnected: false,
  fhenixConnected: false,
};

// Simple persist implementation without middleware
const persistKey = 'cognivern-app-store';

const getStoredState = () => {
  try {
    const stored = localStorage.getItem(persistKey);
    if (!stored) return {};

    const parsed = JSON.parse(stored);

    // Backward compatibility for older persisted sidebarCollapsed preference
    if (parsed?.preferences) {
      const prefs = parsed.preferences;
      if (typeof prefs.sidebarCollapsed === 'boolean' && !prefs.sidebarState) {
        prefs.sidebarState = prefs.sidebarCollapsed ? 'collapsed' : 'expanded';
      }
      delete prefs.sidebarCollapsed;
    }

    return parsed;
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
    activeTab: 'dashboard',
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

      // Sync theme changes with ThemeProvider
      if (prefs.theme !== undefined) {
        window.dispatchEvent(new CustomEvent('themechange', { detail: prefs.theme }));
      }
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
        activeTab: 'dashboard',
      };
      set(newState);
      setStoredState(newState);
    },

    enterDemoMode: () => {
      // Demo mode lets visitors explore the dashboard immediately without
      // committing to wallet setup. We mark `demoExplored` so the dashboard
      // can render an informative banner, but DO NOT mark onboarding as
      // completed — that way the user is still nudged to set up their
      // own treasury when they're ready.
      const newState = {
        ...get(),
        user: { ...get().user, userType: get().user.userType || 'explorer' },
        preferences: { ...get().preferences, demoExplored: true },
        activeTab: 'dashboard',
      };
      set(newState);
      setStoredState(newState);
    },

    exitDemoMode: () => {
      const newState = {
        ...get(),
        preferences: { ...get().preferences, demoExplored: false },
      };
      set(newState);
      setStoredState(newState);
    },

    markDemoValueSeen: () => {
      const newState = {
        ...get(),
        preferences: { ...get().preferences, demoValueSeen: true },
      };
      set(newState);
      setStoredState(newState);
    },

    reset: () => {
      const resetState = {
        user: defaultUser,
        preferences: defaultPreferences,
        activeTab: 'dashboard',
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
    if (preferences.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return preferences.theme;
  };

  return {
    theme: preferences.theme,
    effectiveTheme: getEffectiveTheme(),
    isDark: getEffectiveTheme() === 'dark',
  };
};
