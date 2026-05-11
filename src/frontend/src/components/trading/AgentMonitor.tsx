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
import { designTokens, keyframeAnimations, easings } from '../../styles/design-system';
import { AgentType } from '../../types';
import { isDemoAgent } from '../../utils/demoAgents';
import { useAgentData, useTradingData } from '../../hooks/useAgentData';
import { useAppStore } from '../../stores/appStore';
import { uxAnalytics } from '../../services/uxAnalytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Tabs, TabList, Tab, TabContent } from '../ui/Tabs';
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
    gap: ${designTokens.spacing[4]};
    animation: ${keyframeAnimations.fadeInUp} 0.5s ${easings.out};
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
    grid-template-columns: repeat(3, 1fr);
    gap: ${designTokens.spacing[3]};

    @media (max-width: ${designTokens.breakpoints.md}) {
      grid-template-columns: repeat(3, 1fr);
      gap: ${designTokens.spacing[2]};
    }

    @media (max-width: ${designTokens.breakpoints.sm}) {
      grid-template-columns: 1fr;
      gap: ${designTokens.spacing[2]};
    }
  `;

  if (error) {
    return (
      <Card
        css={css`
          border-color: ${designTokens.colors.semantic.error[200]};
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
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
              font-weight: ${designTokens.typography.fontWeight.bold};
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
      <Card
        compact
        padding="sm"
        css={css`
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid ${designTokens.colors.neutral[200]};
          width: 100%;
          max-width: 100%;
        `}
      >
        <CardHeader
          css={css`
            padding-bottom: ${designTokens.spacing[2]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          <div css={headerStyles}>
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[3]};
                  margin-bottom: ${designTokens.spacing[1]};
                `}
              >
                <CardTitle
                  css={css`
                    font-size: ${designTokens.typography.fontSize['xl']};
                    letter-spacing: -0.01em;
                    font-weight: ${designTokens.typography.fontWeight.bold};
                  `}
                >
                  {title}
                </CardTitle>
                {(isShowcase || isDemo) && (
                  <Badge variant="default" size="sm">
                    DEMO
                  </Badge>
                )}
                <Badge variant={status.isActive ? 'success' : 'secondary'} size="sm">
                  {status.isActive ? 'LIVE' : 'STANDBY'}
                </Badge>
              </div>
              <CardDescription
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                {description}
              </CardDescription>
              {isDemo && (
                <div
                  css={css`
                    margin-top: ${designTokens.spacing[2]};
                    font-size: 10px;
                    font-family: ${designTokens.typography.fontFamily.mono};
                    color: ${designTokens.colors.neutral[400]};
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                  `}
                >
                  Simulation Data Stream
                </div>
              )}
            </div>
            <div css={controlsStyles}>
              <Button
                onClick={toggleShadow}
                variant={isShadowed ? 'primary' : 'outline'}
                size="sm"
                css={css`
                  height: 32px;
                  background: ${isShadowed ? designTokens.colors.primary[600] : 'white'};
                `}
              >
                {isShadowed ? <EyeOff size={14} /> : <Eye size={14} />}
                <span
                  css={css`
                    margin-left: 6px;
                  `}
                >
                  {isShadowed ? 'Watching' : 'Watch'}
                </span>
              </Button>
              {!status.isActive ? (
                <Button
                  onClick={startAgent}
                  disabled={isLoading}
                  size="sm"
                  css={css`
                    height: 32px;
                  `}
                >
                  <Play size={14} />
                  <span
                    css={css`
                      margin-left: 6px;
                    `}
                  >
                    Start
                  </span>
                </Button>
              ) : (
                <Button
                  onClick={stopAgent}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  css={css`
                    height: 32px;
                    background: white;
                  `}
                >
                  <Square size={14} />
                  <span
                    css={css`
                      margin-left: 6px;
                    `}
                  >
                    Stop
                  </span>
                </Button>
              )}
              <Button
                onClick={() => refreshData()}
                variant="ghost"
                size="sm"
                disabled={isLoading}
                css={css`
                  width: 32px;
                  height: 32px;
                  padding: 0;
                `}
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div css={statsGridStyles}>
            <div css={statItemStyles}>
              <div
                css={css`
                  background: ${designTokens.colors.primary[50]};
                  width: 32px;
                  height: 32px;
                  border-radius: ${designTokens.borderRadius.md};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `}
              >
                <Activity size={16} color={designTokens.colors.primary[600]} />
              </div>
              <div>
                <div css={statLabelStyles}>Compliance</div>
                <div css={statValueStyles}>{status.performance?.complianceScore ?? 100}%</div>
              </div>
            </div>
            <div css={statItemStyles}>
              <div
                css={css`
                  background: ${designTokens.colors.secondary[50]};
                  width: 32px;
                  height: 32px;
                  border-radius: ${designTokens.borderRadius.md};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `}
              >
                <Brain size={16} color={designTokens.colors.secondary[600]} />
              </div>
              <div>
                <div css={statLabelStyles}>Autonomy</div>
                <div css={statValueStyles}>Level {status.performance?.autonomyLevel ?? 1}</div>
              </div>
            </div>
            <div css={statItemStyles}>
              <div
                css={css`
                  background: ${designTokens.colors.semantic.success[50]};
                  width: 32px;
                  height: 32px;
                  border-radius: ${designTokens.borderRadius.md};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `}
              >
                <ShieldCheck size={16} color={designTokens.colors.semantic.success[600]} />
              </div>
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

      <Tabs defaultValue="activity" size="sm" variant="underline">
        <TabList>
          <Tab value="activity" icon={<Activity size={14} />}>
            Activity
          </Tab>
          <Tab value="audit" icon={<ShieldCheck size={14} />}>
            Audit
          </Tab>
        </TabList>

        <TabContent value="activity">
          <Card compact padding="sm">
            <CardHeader
              css={css`
                padding-bottom: ${designTokens.spacing[2]};
                margin-bottom: ${designTokens.spacing[2]};
              `}
            >
              <CardTitle
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  color: ${designTokens.colors.neutral[700]};
                `}
              >
                Intelligence Activity Stream
              </CardTitle>
            </CardHeader>
            <CardContent
              padding="none"
              css={css`
                padding: 0 ${designTokens.spacing[3]} ${designTokens.spacing[3]}
                  ${designTokens.spacing[3]};
              `}
            >
              <React.Suspense
                fallback={
                  <div
                    css={css`
                      height: 220px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0.5;
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
        </TabContent>

        <TabContent value="audit">
          <Card compact padding="sm">
            <CardHeader
              css={css`
                padding-bottom: ${designTokens.spacing[2]};
                margin-bottom: ${designTokens.spacing[2]};
              `}
            >
              <CardTitle
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  color: ${designTokens.colors.neutral[700]};
                `}
              >
                Governance Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent
              padding="none"
              css={css`
                padding: 0 ${designTokens.spacing[3]} ${designTokens.spacing[3]}
                  ${designTokens.spacing[3]};
              `}
            >
              <React.Suspense
                fallback={
                  <div
                    css={css`
                      height: 220px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0.5;
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
        </TabContent>
      </Tabs>
    </div>
  );
};

const statItemStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid ${designTokens.colors.neutral[100]};
  border-radius: ${designTokens.borderRadius.lg};
  transition: all 0.3s ease;
  min-height: 56px;

  @media (max-width: ${designTokens.breakpoints.md}) {
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    min-height: 52px;
  }

  @media (max-width: ${designTokens.breakpoints.sm}) {
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[2]};
    min-height: 48px;
  }

  &:hover {
    background: white;
    box-shadow: ${designTokens.shadows.sm};
    transform: translateY(-2px);
  }
`;

const statLabelStyles = css`
  font-size: 10px;
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: ${designTokens.typography.fontWeight.bold};
  margin-bottom: 2px;
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  letter-spacing: -0.01em;
`;
