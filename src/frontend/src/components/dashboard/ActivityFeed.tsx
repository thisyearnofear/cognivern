/**
 * ActivityFeed - Displays recent activity and events
 * Extracted from UnifiedDashboard for better modularity
 */

import { useNavigate } from 'react-router-dom';
import { css, keyframes } from '@emotion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, FileSearch } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { Card, CardContent } from '../ui';
import { ActivityItem } from './utils/types';
import { buildEvidenceFacts, buildTrustSignals } from './utils/activity';
import { copyTextToClipboard } from '../../utils/clipboard';
import * as styles from './UnifiedDashboard.styles';

interface ActivityFeedProps {
  activities: ActivityItem[];
  compact?: boolean;
  showMore?: boolean;
  onToggleMore?: () => void;
}

// Fade-in animation for activity items
const fadeSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

export const TrustSignals = ({ activity }: { activity: ActivityItem }) => {
  const signals = buildTrustSignals(activity);
  if (!signals.length) return null;

  return (
    <div
      css={css`
        display: flex;
        gap: ${designTokens.spacing[1]};
        margin-top: ${designTokens.spacing[1]};
      `}
    >
      {signals.map((signal) => (
        <span
          key={signal.label}
          css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            padding: 2px 6px;
            border-radius: ${designTokens.borderRadius.full};
            background: ${designTokens.colors.neutral[100]};
            color: ${designTokens.colors.text.secondary};
          `}
        >
          {signal.label}
        </span>
      ))}
    </div>
  );
};

export const ActivityFeed = ({
  activities,
  compact,
  showMore,
  onToggleMore,
}: ActivityFeedProps) => {
  const navigate = useNavigate();
  const displayActivities = compact && !showMore ? activities.slice(0, 5) : activities;

  const getActivityIcon = (severity?: string, type?: string) => {
    if (severity === 'success' || type === 'trade') return <CheckCircle2 size={20} />;
    if (severity === 'warning') return <AlertTriangle size={20} />;
    if (severity === 'error') return <XCircle size={20} />;
    return <Info size={20} />;
  };

  return (
    <Card>
      <CardContent css={styles.activityFeedStyles(compact)}>
        {activities.length === 0 ? (
          <div css={styles.emptyStateStyles}>
            <FileSearch size={48} />
            <div>No recent activity</div>
          </div>
        ) : (
          <>
            {displayActivities.map((activity, idx) => (
              <div
                key={idx}
                css={css`
                  ${styles.activityItemStyles}
                  animation: ${fadeSlideIn} 0.3s ease-out forwards;
                  animation-delay: ${idx * 40}ms;
                  opacity: 0;
                `}
              >
                <div
                  css={styles.activityIconStyles(
                    activity.severity || (activity.type === 'trade' ? 'success' : 'info'),
                  )}
                >
                  {getActivityIcon(activity.severity, activity.type)}
                </div>
                <div css={styles.activityDetailsStyles}>
                  <div css={styles.activityTextStyles}>{activity.description || 'Activity'}</div>
                  <TrustSignals activity={activity} />
                  <div css={styles.activityTimeStyles}>
                    {activity.timestamp
                      ? new Date(activity.timestamp).toLocaleTimeString()
                      : 'Unknown time'}
                  </div>
                  {buildEvidenceFacts(activity).length > 0 && (
                    <div
                      css={css`
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${designTokens.spacing[1]};
                      `}
                    >
                      {buildEvidenceFacts(activity)
                        .slice(0, 3)
                        .map((fact) => (
                          <span
                            key={fact}
                            css={css`
                              font-size: ${designTokens.typography.fontSize.xs};
                              padding: 2px 6px;
                              border-radius: ${designTokens.borderRadius.full};
                              background: ${designTokens.colors.neutral[100]};
                              color: ${designTokens.colors.text.secondary};
                            `}
                          >
                            {fact}
                          </span>
                        ))}
                    </div>
                  )}
                  {(activity.targetPath || activity.evidenceLabel) && (
                    <div
                      css={css`
                        display: flex;
                        gap: ${designTokens.spacing[2]};
                        flex-wrap: wrap;
                      `}
                    >
                      <button
                        css={css`
                          background: none;
                          border: none;
                          padding: 0;
                          color: ${designTokens.colors.primary[600]};
                          cursor: pointer;
                          font-size: ${designTokens.typography.fontSize.xs};
                          font-weight: ${designTokens.typography.fontWeight.medium};

                          &:hover {
                            text-decoration: underline;
                          }
                        `}
                        onClick={() => {
                          if (activity.targetPath) {
                            navigate(activity.targetPath);
                          }
                        }}
                        disabled={!activity.targetPath}
                      >
                        {activity.evidenceLabel || 'View Evidence'}
                      </button>
                      {activity.evidenceHash && (
                        <button
                          css={css`
                            background: none;
                            border: none;
                            padding: 0;
                            color: ${designTokens.colors.text.secondary};
                            cursor: pointer;
                            font-size: ${designTokens.typography.fontSize.xs};

                            &:hover {
                              text-decoration: underline;
                            }
                          `}
                          onClick={() => {
                            void copyTextToClipboard(activity.evidenceHash as string);
                          }}
                        >
                          Copy Hash
                        </button>
                      )}
                      {activity.cid && (
                        <button
                          css={css`
                            background: none;
                            border: none;
                            padding: 0;
                            color: ${designTokens.colors.text.secondary};
                            cursor: pointer;
                            font-size: ${designTokens.typography.fontSize.xs};

                            &:hover {
                              text-decoration: underline;
                            }
                          `}
                          onClick={() => {
                            void copyTextToClipboard(activity.cid as string);
                          }}
                        >
                          Copy CID
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {compact && activities.length > 5 && onToggleMore && (
              <button css={styles.showMoreButtonStyles} onClick={onToggleMore}>
                {showMore ? 'Show Less' : `Show ${activities.length - 5} More`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
