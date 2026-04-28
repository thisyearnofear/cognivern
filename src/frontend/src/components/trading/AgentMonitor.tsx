/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react';
import {
  AlertTriangle,
  RefreshCw,
  Play,
  Square,
  Activity,
  ShieldCheck,
  Brain,
  Eye,
  EyeOff,
} from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { AgentType } from '../../types';
import { isDemoAgent } from '../../utils/demoAgents';
import { useAgentData, useTradingData } from '../../hooks/useAgentData';
import { useAppStore } from '../../stores/appStore';
import { uxAnalytics } from '../../services/uxAnalytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ErrorBoundary } from '../ui/ErrorBoundary';
const TradingChart = React.lazy(() => import('./TradingChart'));
const TradeHistory = React.lazy(() => import('./TradeHistory'));

interface AgentMonitorProps {
  agentType: AgentType;
  title: string;
  description: string;
  isShowcase?: boolean;
}

export const AgentMonitor: React.FC<AgentMonitorProps> = ({
  agentType,
  title,
  description,
  isShowcase = false,
}) => {
  return (
    <ErrorBoundary componentName={`Agent Monitor: ${title}`}>
      <div id={`agent-monitor-${agentType}`}>
        <AgentMonitorContent
          agentType={agentType}
          title={title}
          description={description}
          isShowcase={isShowcase}
        />
      </div>
    </ErrorBoundary>
  );
};

const AgentMonitorContent: React.FC<AgentMonitorProps> = ({
  agentType,
  title,
  description,
  isShowcase,
}) => {
  const {
    status,
    isLoading: agentLoading,
    error: agentError,
    startAgent,
    stopAgent,
    refreshData,
  } = useAgentData(agentType);

  const { decisions, isLoading: tradingLoading, error: tradingError } = useTradingData(agentType);

  const { preferences, updatePreferences } = useAppStore();
  const isShadowed = preferences.shadowedAgents.includes(agentType);

  const toggleShadow = () => {
    const newShadowed = isShadowed
      ? preferences.shadowedAgents.filter((id) => id !== agentType)
      : [...preferences.shadowedAgents, agentType];

    updatePreferences({ shadowedAgents: newShadowed });
    uxAnalytics.track(isShadowed ? 'agent_shadow_stop' : 'agent_shadow_start', { agentType });
  };

  const isLoading = agentLoading || tradingLoading;
  const error = agentError || tradingError;
  const isDemo = isDemoAgent(agentType);

  const containerStyles = css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[6]};
    animation: fadeIn 0.5s ease-out;

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  const headerStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[2]};

    @media (max-width: 640px) {
      flex-direction: column;
    }
  `;

  const controlsStyles = css`
    display: flex;
    gap: ${designTokens.spacing[2]};
  `;

  const statsGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: ${designTokens.spacing[4]};
  `;

  const monitorGridStyles = css`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${designTokens.spacing[6]};

    @media (min-width: 1280px) {
      grid-template-columns: 2fr 1fr;
    }
  `;

  if (error) {
    return (
      <Card
        css={css`
          border-color: ${designTokens.colors.semantic.error[200]};
        `}
      >
        <CardContent
          css={css`
            padding: ${designTokens.spacing[8]};
            text-align: center;
          `}
        >
          <AlertTriangle
            size={48}
            color={designTokens.colors.semantic.error[500]}
            css={css`
              margin: 0 auto ${designTokens.spacing[4]};
            `}
          />
          <h3
            css={css`
              margin-bottom: ${designTokens.spacing[2]};
            `}
          >
            Connection Error
          </h3>
          <p
            css={css`
              color: ${designTokens.colors.neutral[600]};
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            Failed to fetch data for {title}. {error}
          </p>
          <Button onClick={() => refreshData()} variant="outline">
            <RefreshCw
              size={16}
              css={css`
                margin-right: ${designTokens.spacing[2]};
              `}
            />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div css={containerStyles}>
      <Card>
        <CardHeader>
          <div css={headerStyles}>
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <CardTitle>{title}</CardTitle>
                {(isShowcase || isDemo) && <Badge variant="default">Demo</Badge>}
                <Badge variant={status.isActive ? 'success' : 'secondary'}>
                  {status.isActive ? 'Live' : 'Standby'}
                </Badge>
              </div>
              <CardDescription>{description}</CardDescription>
              {isDemo && (
                <div
                  css={css`
                    margin-top: ${designTokens.spacing[2]};
                    font-size: ${designTokens.typography.fontSize.xs};
                    color: ${designTokens.colors.neutral[500]};
                  `}
                >
                  Sample data — connect your agent for real performance
                </div>
              )}
            </div>
            <div css={controlsStyles}>
              <Button
                onClick={toggleShadow}
                variant={isShadowed ? 'primary' : 'outline'}
                size="sm"
                title={isShadowed ? 'Watching' : 'Watch Agent'}
              >
                {isShadowed ? (
                  <EyeOff
                    size={14}
                    css={css`
                      margin-right: ${designTokens.spacing[1]};
                    `}
                  />
                ) : (
                  <Eye
                    size={14}
                    css={css`
                      margin-right: ${designTokens.spacing[1]};
                    `}
                  />
                )}
                {isShadowed ? 'Unwatch' : 'Watch'}
              </Button>
              {!status.isActive ? (
                <Button onClick={startAgent} disabled={isLoading} size="sm">
                  <Play
                    size={14}
                    css={css`
                      margin-right: ${designTokens.spacing[1]};
                    `}
                  />
                  Start
                </Button>
              ) : (
                <Button onClick={stopAgent} disabled={isLoading} variant="outline" size="sm">
                  <Square
                    size={14}
                    css={css`
                      margin-right: ${designTokens.spacing[1]};
                    `}
                  />
                  Stop
                </Button>
              )}
              <Button onClick={() => refreshData()} variant="ghost" size="sm" disabled={isLoading}>
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div css={statsGridStyles}>
            <div css={statItemStyles}>
              <Activity size={16} color={designTokens.colors.primary[500]} />
              <div>
                <div css={statLabelStyles}>Compliance</div>
                <div css={statValueStyles}>{status.performance?.complianceScore ?? 100}%</div>
              </div>
            </div>
            <div css={statItemStyles}>
              <Brain size={16} color={designTokens.colors.secondary[500]} />
              <div>
                <div css={statLabelStyles}>Autonomy</div>
                <div css={statValueStyles}>Lvl {status.performance?.autonomyLevel ?? 1}</div>
              </div>
            </div>
            <div css={statItemStyles}>
              <ShieldCheck size={16} color={designTokens.colors.semantic.success[500]} />
              <div>
                <div css={statLabelStyles}>Risk Profile</div>
                <div
                  css={[
                    statValueStyles,
                    css`
                      text-transform: capitalize;
                    `,
                  ]}
                >
                  {status.performance?.riskProfile ?? 'Low'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div css={monitorGridStyles}>
        <Card>
          <CardHeader>
            <CardTitle
              css={css`
                font-size: ${designTokens.typography.fontSize.base};
              `}
            >
              Decision Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <React.Suspense
              fallback={
                <div
                  css={css`
                    height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  `}
                >
                  Loading activity...
                </div>
              }
            >
              <TradingChart decisions={decisions} agentType={agentType} isLoading={isLoading} />
            </React.Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              css={css`
                font-size: ${designTokens.typography.fontSize.base};
              `}
            >
              Activity Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <React.Suspense
              fallback={
                <div
                  css={css`
                    height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  `}
                >
                  Loading audit trail...
                </div>
              }
            >
              <TradeHistory decisions={decisions} agentType={agentType} isLoading={isLoading} />
            </React.Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const statItemStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
`;

const statLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
`;
