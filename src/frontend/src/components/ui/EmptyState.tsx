import React, { useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Button } from './Button';
import { Plus, Search, Shield, Users } from 'lucide-react';

export type EmptyStateType = 'agents' | 'policies' | 'activity' | 'runs' | 'general';

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

  // Default configs by type
  const configs: Record<
    EmptyStateType,
    {
      defaultIcon: React.ReactNode;
      defaultTitle: string;
      defaultDescription: string;
      defaultAction: string;
    }
  > = {
    agents: {
      defaultIcon: <Users size={compact ? 32 : 48} />,
      defaultTitle: 'No agents yet',
      defaultDescription: 'Connect your first agent to start governing spend and policies.',
      defaultAction: 'Connect Agent',
    },
    policies: {
      defaultIcon: <Shield size={compact ? 32 : 48} />,
      defaultTitle: 'No policies configured',
      defaultDescription: 'Set up spend policies to control how agents can use funds.',
      defaultAction: 'Create Policy',
    },
    activity: {
      defaultIcon: <Search size={compact ? 32 : 48} />,
      defaultTitle: 'No activity yet',
      defaultDescription: 'Activity will appear here as agents execute governed operations.',
      defaultAction: 'View Docs',
    },
    runs: {
      defaultIcon: <Search size={compact ? 32 : 48} />,
      defaultTitle: 'No runs recorded',
      defaultDescription: 'Agent execution history will appear here.',
      defaultAction: 'Learn More',
    },
    general: {
      defaultIcon: <Search size={compact ? 32 : 48} />,
      defaultTitle: 'Nothing here yet',
      defaultDescription: 'Start using the platform to see content here.',
      defaultAction: 'Get Started',
    },
  };

  const config = configs[type];

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
      `}
    >
      <div
        css={css`
          /* Theme-aware icon color */
          color: var(--text-muted);
          margin-bottom: ${designTokens.spacing[3]};
        `}
      >
        {icon || config.defaultIcon}
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
