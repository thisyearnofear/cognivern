/**
 * QuickActions - Mobile operator workflow shortcuts
 * Extracted from UnifiedDashboard for better modularity
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css, keyframes } from '@emotion/react';
import { PlusCircle, ShieldCheck, FileSearch, Activity } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import * as styles from './UnifiedDashboard.styles';

interface QuickActionsProps {
  isMobile: boolean;
}

// Bounce animation for button press feedback
const bounce = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.92); }
`;

// Ripple effect for click
const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.5;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
`;

export const QuickActions = ({ isMobile }: QuickActionsProps) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Add Agent',
      icon: <PlusCircle size={20} color={designTokens.colors.primary[500]} />,
      path: '/agents/workshop',
    },
    {
      label: 'Policies',
      icon: <ShieldCheck size={20} />,
      path: '/policies',
    },
    {
      label: 'Audit',
      icon: <FileSearch size={20} />,
      path: '/audit',
    },
    {
      label: 'Runs',
      icon: <Activity size={20} />,
      path: '/runs',
    },
  ];

  // Desktop: sidebar handles navigation — only render mobile quick actions
  if (!isMobile) return null;

  return (
    <div css={styles.mobileActionsStyles}>
      {actions.map((action) => (
        <QuickActionButton key={action.path} action={action} onNavigate={navigate} />
      ))}
    </div>
  );
};

interface QuickActionButtonProps {
  action: { label: string; icon: React.ReactNode; path: string };
  onNavigate: (path: string) => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ action, onNavigate }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      css={css`
        ${styles.mobileActionButtonStyles}
        position: relative;
        overflow: hidden;

        &:hover {
          background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
        }

        &:active {
          animation: ${bounce} 0.2s ease-out;
        }
      `}
      onClick={() => {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 300);
        onNavigate(action.path);
      }}
    >
      <div css={styles.mobileActionIconStyles}>{action.icon}</div>
      <span>{action.label}</span>
    </button>
  );
};

export default QuickActions;
