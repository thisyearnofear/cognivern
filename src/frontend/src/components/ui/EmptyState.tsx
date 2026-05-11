import React, { useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Button } from './Button';
import {
  Plus,
  Search,
  Shield,
  Users,
  Activity,
  TrendingUp,
  FileX,
  BookOpen,
  Inbox,
} from 'lucide-react';

export type EmptyStateType =
  | 'agents'
  | 'policies'
  | 'activity'
  | 'runs'
  | 'general'
  | 'trading'
  | 'docs'
  | 'files'
  | 'notifications';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  compact?: boolean;
  isLoading?: boolean;
}

// Icon map for consistent empty state visuals
const iconMap: Record<EmptyStateType, React.ReactNode> = {
  agents: <Users size={24} />,
  policies: <Shield size={24} />,
  activity: <Activity size={24} />,
  runs: <TrendingUp size={24} />,
  trading: <TrendingUp size={24} />,
  docs: <BookOpen size={24} />,
  files: <FileX size={24} />,
  notifications: <Inbox size={24} />,
  general: <Search size={24} />,
};

// Configuration map
const configMap: Record<
  EmptyStateType,
  {
    defaultTitle: string;
    defaultDescription: string;
    defaultAction: string;
  }
> = {
  agents: {
    defaultTitle: 'No agents yet',
    defaultDescription: 'Connect your first agent to start governing spend and policies.',
    defaultAction: 'Connect Agent',
  },
  policies: {
    defaultTitle: 'No policies configured',
    defaultDescription: 'Set up spend policies to control how agents can use funds.',
    defaultAction: 'Create Policy',
  },
  activity: {
    defaultTitle: 'No activity yet',
    defaultDescription: 'Activity will appear here as agents execute governed operations.',
    defaultAction: 'View Docs',
  },
  runs: {
    defaultTitle: 'No runs recorded',
    defaultDescription: 'Agent execution history will appear here.',
    defaultAction: 'Learn More',
  },
  general: {
    defaultTitle: 'Nothing here yet',
    defaultDescription: 'Start using the platform to see content here.',
    defaultAction: 'Get Started',
  },
  trading: {
    defaultTitle: 'No trading activity',
    defaultDescription: 'Trading history and performance metrics will appear here.',
    defaultAction: 'Start Trading',
  },
  docs: {
    defaultTitle: 'No documentation',
    defaultDescription: 'Documentation will appear once available.',
    defaultAction: 'Learn More',
  },
  files: {
    defaultTitle: 'No files',
    defaultDescription: 'Files will appear here once uploaded.',
    defaultAction: 'Upload Files',
  },
  notifications: {
    defaultTitle: 'All caught up',
    defaultDescription: 'No new notifications at this time.',
    defaultAction: 'View Settings',
  },
};

// Fade in animation
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

/**
 * Reusable empty state component for dashboard sections.
 * Provides contextual CTAs based on type.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'general',
  title,
  description,
  actionLabel,
  onAction,
  icon,
  compact = false,
  isLoading = false,
}) => {
  const [mounted, setMounted] = useState(false);

  // Entrance animation
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const config = configMap[type];
  const iconSize = compact ? 24 : 48;

  return (
    <div
      role="status"
      aria-live="polite"
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${compact ? designTokens.spacing[4] : designTokens.spacing[8]};
        text-align: center;
        min-height: ${compact ? 120 : 200}px;

        /* Entrance animation */
        opacity: ${mounted ? 1 : 0};
        transform: translateY(${mounted ? 0 : 16}px);
        transition: all ${designTokens.animation.duration.slow} ${designTokens.animation.easing.easeOut};
        animation: ${fadeIn} 0.4s ease-out ${mounted ? 0 : 0.2}s} forwards;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${iconSize}px;
          height: ${iconSize}px;
          border-radius: ${designTokens.borderRadius.full};
          background: linear-gradient(
            135deg,
            ${designTokens.colors.primary[50]} 0%,
            ${designTokens.colors.primary[100]} 100%
          );
          color: ${designTokens.colors.primary[500]};
          margin-bottom: ${designTokens.spacing[3]};
        `}
      >
        {icon || iconMap[type]}
      </div>

      <h3
        css={css`
          margin: 0 0 ${designTokens.spacing[2]} 0;
          font-size: ${compact
            ? designTokens.typography.fontSize.md
            : designTokens.typography.fontSize.lg};
          font-weight: ${designTokens.typography.fontWeight.semibold};
          color: var(--text-primary);
        `}
      >
        {title || config.defaultTitle}
      </h3>

      <p
        css={css`
          margin: 0 0 ${designTokens.spacing[4]} 0;
          font-size: ${designTokens.typography.fontSize.sm};
          color: var(--text-secondary);
          max-width: ${compact ? 240 : 320}px;
          line-height: 1.5;
        `}
      >
        {description || config.defaultDescription}
      </p>

      {onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          <Plus size={14} />
          {actionLabel || config.defaultAction}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
