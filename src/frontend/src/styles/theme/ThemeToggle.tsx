/**
 * ThemeToggle - Theme switcher button component
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Build on existing design tokens
 * - MODULAR: Single file, easy to place anywhere
 * - ACCESSIBILITY: Proper labels and keyboard support
 */

import { css } from '@emotion/react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeContext, ThemeMode } from './ThemeProvider';
import { designTokens } from '../design-system';

/**
 * ThemeToggle - A button to cycle through light/dark/system themes
 */
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useThemeContext();

  const cycleTheme = () => {
    const cycle: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = cycle.indexOf(theme);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setTheme(cycle[nextIndex]);
  };

  const icons = {
    light: <Sun size={18} />,
    dark: <Moon size={18} />,
    system: <Monitor size={18} />,
  };

  const labels = {
    light: 'Switch to dark mode',
    dark: 'Switch to light mode',
    system: 'System theme',
  };

  return (
    <button
      onClick={cycleTheme}
      aria-label={labels[theme]}
      title={labels[theme]}
      css={toggleButtonStyles}
    >
      {icons[theme]}
    </button>
  );
};

const toggleButtonStyles = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: ${designTokens.borderRadius.md};
  background: transparent;
  color: ${designTokens.colors.text.secondary};
  cursor: pointer;
  transition:
    background-color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut},
    color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut};

  &:hover {
    background: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.text.primary};
  }

  &:focus-visible {
    outline: 2px solid ${designTokens.colors.primary[500]};
    outline-offset: 2px;
  }

  &:active {
    transform: scale(0.95);
  }

  [data-theme='dark'] & {
    &:hover {
      background: ${designTokens.colors.neutral[800]};
      color: ${designTokens.colors.text.inverse};
    }
  }
`;

export default ThemeToggle;
