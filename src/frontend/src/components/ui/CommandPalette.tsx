import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { designTokens } from '../../styles/designTokens';
import Modal from './Modal';

interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  action: () => void;
  keywords: string[];
  category: 'navigation' | 'actions' | 'settings' | 'help';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { updatePreferences, preferences, setError } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'View overview and metrics',
      icon: '📊',
      action: () => { navigate('/'); onClose(); },
      keywords: ['dashboard', 'home', 'overview', 'metrics'],
      category: 'navigation',
    },
    {
      id: 'nav-trading',
      title: 'Go to Trading',
      description: 'Manage AI trading agents',
      icon: '🤖',
      action: () => { navigate('/trading'); onClose(); },
      keywords: ['trading', 'agents', 'ai', 'bot'],
      category: 'navigation',
    },
    {
      id: 'nav-policies',
      title: 'Go to Policies',
      description: 'Manage governance policies',
      icon: '📋',
      action: () => { navigate('/policies'); onClose(); },
      keywords: ['policies', 'governance', 'rules', 'compliance'],
      category: 'navigation',
    },
    {
      id: 'nav-audit',
      title: 'Go to Audit Logs',
      description: 'View activity history',
      icon: '📝',
      action: () => { navigate('/audit'); onClose(); },
      keywords: ['audit', 'logs', 'history', 'activity'],
      category: 'navigation',
    },
    
    // Actions
    {
      id: 'action-new-policy',
      title: 'Create New Policy',
      description: 'Create a new governance policy',
      icon: '➕',
      action: () => { 
        navigate('/policies');
        // TODO: Trigger new policy creation
        onClose(); 
      },
      keywords: ['create', 'new', 'policy', 'add'],
      category: 'actions',
    },
    {
      id: 'action-start-agent',
      title: 'Start Trading Agent',
      description: 'Start an AI trading agent',
      icon: '▶️',
      action: () => { 
        navigate('/trading');
        // TODO: Trigger agent start
        onClose(); 
      },
      keywords: ['start', 'agent', 'trading', 'run'],
      category: 'actions',
    },
    
    // Settings
    {
      id: 'setting-toggle-theme',
      title: 'Toggle Theme',
      description: `Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} mode`,
      icon: preferences.theme === 'dark' ? '☀️' : '🌙',
      action: () => { 
        updatePreferences({ 
          theme: preferences.theme === 'dark' ? 'light' : 'dark' 
        }); 
        onClose(); 
      },
      keywords: ['theme', 'dark', 'light', 'mode'],
      category: 'settings',
    },
    {
      id: 'setting-toggle-sidebar',
      title: 'Toggle Sidebar',
      description: preferences.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
      icon: preferences.sidebarCollapsed ? '→' : '←',
      action: () => { 
        updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed }); 
        onClose(); 
      },
      keywords: ['sidebar', 'collapse', 'expand', 'toggle'],
      category: 'settings',
    },
    
    // Help
    {
      id: 'help-shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'View available keyboard shortcuts',
      icon: '⌨️',
      action: () => { 
        // TODO: Show shortcuts help
        setError('Keyboard shortcuts help coming soon!');
        onClose(); 
      },
      keywords: ['shortcuts', 'keyboard', 'help', 'hotkeys'],
      category: 'help',
    },
    {
      id: 'help-docs',
      title: 'Documentation',
      description: 'View platform documentation',
      icon: '📚',
      action: () => { 
        window.open('https://github.com/your-repo/docs', '_blank');
        onClose(); 
      },
      keywords: ['docs', 'documentation', 'help', 'guide'],
      category: 'help',
    },
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter(command => {
    if (!query) return true;
    
    const searchText = query.toLowerCase();
    return (
      command.title.toLowerCase().includes(searchText) ||
      command.description?.toLowerCase().includes(searchText) ||
      command.keywords.some(keyword => keyword.toLowerCase().includes(searchText))
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, Command[]>);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    help: 'Help',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: designTokens.spacing[4],
    fontSize: designTokens.typography.fontSize.lg,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: designTokens.colors.neutral[900],
  };

  const commandListStyle: React.CSSProperties = {
    maxHeight: '400px',
    overflow: 'auto',
  };

  const categoryStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    fontWeight: designTokens.typography.fontWeight.semibold,
    color: designTokens.colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${designTokens.spacing[3]} ${designTokens.spacing[4]}`,
    marginTop: designTokens.spacing[2],
  };

  const commandItemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: designTokens.spacing[3],
    padding: designTokens.spacing[3],
    margin: `0 ${designTokens.spacing[2]}`,
    borderRadius: designTokens.borderRadius.md,
    cursor: 'pointer',
    backgroundColor: isSelected 
      ? designTokens.colors.primary[50] 
      : 'transparent',
    border: isSelected 
      ? `1px solid ${designTokens.colors.primary[200]}` 
      : '1px solid transparent',
    transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
  });

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    width: '20px',
    textAlign: 'center',
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.medium,
    color: designTokens.colors.neutral[900],
    margin: 0,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    color: designTokens.colors.neutral[500],
    margin: 0,
  };

  let commandIndex = 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <div>
        {/* Search Input */}
        <div style={{
          borderBottom: `1px solid ${designTokens.colors.neutral[200]}`,
          marginBottom: designTokens.spacing[2],
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Commands List */}
        <div style={commandListStyle}>
          {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
            <div key={category}>
              <div style={categoryStyle}>
                {categoryLabels[category as keyof typeof categoryLabels]}
              </div>
              {categoryCommands.map((command) => {
                const isSelected = commandIndex === selectedIndex;
                const currentIndex = commandIndex++;
                
                return (
                  <div
                    key={command.id}
                    style={commandItemStyle(isSelected)}
                    onClick={() => command.action()}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <span style={iconStyle}>{command.icon}</span>
                    <div style={textStyle}>
                      <div style={titleStyle}>{command.title}</div>
                      {command.description && (
                        <div style={descriptionStyle}>{command.description}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: designTokens.spacing[8],
              color: designTokens.colors.neutral[500],
            }}>
              <div style={{ fontSize: '32px', marginBottom: designTokens.spacing[2] }}>
                🔍
              </div>
              <div>No commands found</div>
              <div style={{ fontSize: designTokens.typography.fontSize.sm }}>
                Try a different search term
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${designTokens.colors.neutral[200]}`,
          padding: designTokens.spacing[3],
          fontSize: designTokens.typography.fontSize.xs,
          color: designTokens.colors.neutral[500],
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Use ↑↓ to navigate, ↵ to select, esc to close</span>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </Modal>
  );
};

export default CommandPalette;