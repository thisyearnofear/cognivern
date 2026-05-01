/**
 * Theme Provider - Light/Dark mode support with CSS variables
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Build on existing tokens, don't duplicate
 * - MODULAR: Theme context is isolated and easily swappable
 * - PREVENTION BLOAT: Single file handles all theme concerns
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

// CSS variable mappings for themes
export const themeVariables = {
  light: {
    // Background colors
    '--color-bg-primary': '#ffffff',
    '--color-bg-secondary': '#f8fafc',
    '--color-bg-tertiary': '#f1f5f9',
    '--color-bg-inverse': '#0f172a',

    // Text colors
    '--color-text-primary': '#1f2937',
    '--color-text-secondary': '#6b7280',
    '--color-text-tertiary': '#9ca3af',
    '--color-text-inverse': '#ffffff',

    // Border colors
    '--color-border-primary': '#e2e8f0',
    '--color-border-secondary': '#cbd5e1',

    // Surface colors
    '--color-surface-hover': '#f1f5f9',
    '--color-surface-active': '#e2e8f0',

    // Card backgrounds
    '--color-card-bg': '#ffffff',
    '--color-card-border': '#e2e8f0',

    // Sidebar
    '--color-sidebar-bg': '#ffffff',
    '--color-sidebar-border': '#e2e8f0',

    // Shadow styles
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',

    // Overlay
    '--color-overlay-bg': 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Background colors
    '--color-bg-primary': '#0f172a',
    '--color-bg-secondary': '#1e293b',
    '--color-bg-tertiary': '#334155',
    '--color-bg-inverse': '#f8fafc',

    // Text colors
    '--color-text-primary': '#f8fafc',
    '--color-text-secondary': '#94a3b8',
    '--color-text-tertiary': '#64748b',
    '--color-text-inverse': '#0f172a',

    // Border colors
    '--color-border-primary': '#334155',
    '--color-border-secondary': '#475569',

    // Surface colors
    '--color-surface-hover': '#1e293b',
    '--color-surface-active': '#334155',

    // Card backgrounds
    '--color-card-bg': '#1e293b',
    '--color-card-border': '#334155',

    // Sidebar
    '--color-sidebar-bg': '#0f172a',
    '--color-sidebar-border': '#334155',

    // Shadow styles (darker for dark mode)
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4)',

    // Overlay
    '--color-overlay-bg': 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// Context type
interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

// Create context
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Provider component
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Update resolved theme based on system preference or manual selection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();
    mediaQuery.addEventListener('change', updateResolvedTheme);

    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [theme]);

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const variables = themeVariables[resolvedTheme];

    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Also set data attribute for CSS selectors
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Set theme function (syncs with appStore)
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    // Dispatch event for appStore listener to pick up
    window.dispatchEvent(new CustomEvent('themechange', { detail: newTheme }));
  };

  // Listen for theme changes from appStore
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<ThemeMode>) => {
      setThemeState(event.detail);
    };

    window.addEventListener('themechange', handleThemeChange as EventListener);
    return () => window.removeEventListener('themechange', handleThemeChange as EventListener);
  }, []);

  // Toggle theme function (light <-> dark)
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

// Hook for resolved theme only (for CSS)
export function useResolvedTheme(): 'light' | 'dark' {
  const { resolvedTheme } = useThemeContext();
  return resolvedTheme;
}

// Theme-aware component helper
export function withTheme<P extends object>(
  Component: React.ComponentType<P>,
  themeProp = 'theme'
) {
  return function ThemedComponent(props: P) {
    const theme = useResolvedTheme();
    return <Component {...props} {...{ [themeProp]: theme }} />;
  };
}

// Utility: Apply theme transition
export const themeTransitionCSS = `
  transition: background-color 0.2s ease,
              color 0.2s ease,
              border-color 0.2s ease;
`;
