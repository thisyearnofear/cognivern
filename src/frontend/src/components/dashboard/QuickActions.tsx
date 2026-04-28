/**
 * QuickActions - Mobile bottom navigation bar
 * Extracted from UnifiedDashboard for better modularity
 */

import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, ShieldCheck, FileSearch } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import * as styles from './UnifiedDashboard.styles';

interface QuickActionsProps {
  isMobile: boolean;
}

export const QuickActions = ({ isMobile }: QuickActionsProps) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      path: '/',
    },
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
      label: 'Logs',
      icon: <FileSearch size={20} />,
      path: '/audit',
    },
  ];

  // Desktop: sidebar handles navigation — only render mobile bottom bar
  if (!isMobile) return null;

  return (
    <div css={styles.mobileActionsStyles}>
      {actions.map((action) => (
        <button
          key={action.path}
          css={styles.mobileActionButtonStyles}
          onClick={() => navigate(action.path)}
        >
          <div css={styles.mobileActionIconStyles}>{action.icon}</div>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
