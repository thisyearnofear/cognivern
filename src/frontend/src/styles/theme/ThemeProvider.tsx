import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

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

  // Apply theme attributes to document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
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
