import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { updatePreferences, preferences } = useAppStore();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      ctrlKey: true,
      action: () => {
        // TODO: Open command palette
        console.log('Opening command palette...');
      },
      description: 'Open command palette',
    },
    {
      key: 'k',
      metaKey: true, // For Mac
      action: () => {
        console.log('Opening command palette...');
      },
      description: 'Open command palette',
    },
    {
      key: '/',
      action: () => {
        // TODO: Focus search
        console.log('Focus search...');
      },
      description: 'Focus search',
    },
    {
      key: 'd',
      altKey: true,
      action: () => navigate('/'),
      description: 'Go to Dashboard',
    },
    {
      key: 't',
      altKey: true,
      action: () => navigate('/trading'),
      description: 'Go to Trading',
    },
    {
      key: 'p',
      altKey: true,
      action: () => navigate('/policies'),
      description: 'Go to Policies',
    },
    {
      key: 'a',
      altKey: true,
      action: () => navigate('/audit'),
      description: 'Go to Audit Logs',
    },
    {
      key: 'b',
      ctrlKey: true,
      action: () => {
        updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
      },
      description: 'Toggle sidebar',
    },
    {
      key: 'b',
      metaKey: true, // For Mac
      action: () => {
        updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
      },
      description: 'Toggle sidebar',
    },
    {
      key: 'Escape',
      action: () => {
        // Close any open modals/dropdowns
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      },
      description: 'Close modals/dropdowns',
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.contentEditable === 'true'
    ) {
      return;
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.metaKey === event.metaKey &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.altKey === event.altKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
    }
  }, [shortcuts, navigate, updatePreferences, preferences.sidebarCollapsed]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
};

// Hook for displaying keyboard shortcuts help
export const useShortcutsHelp = () => {
  const { shortcuts } = useKeyboardShortcuts();

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys = [];
    
    if (shortcut.ctrlKey || shortcut.metaKey) {
      keys.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    }
    if (shortcut.altKey) {
      keys.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
    }
    if (shortcut.shiftKey) {
      keys.push('⇧');
    }
    
    keys.push(shortcut.key.toUpperCase());
    
    return keys.join(' + ');
  };

  return {
    shortcuts: shortcuts.map(shortcut => ({
      ...shortcut,
      formatted: formatShortcut(shortcut),
    })),
    formatShortcut,
  };
};