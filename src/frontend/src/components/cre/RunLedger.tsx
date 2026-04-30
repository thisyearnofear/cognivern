import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import { creApi, CreRun } from '../../services/creApi';
import { toAgentRunViewModel } from '../../services/agentRunAdapter';
import { uxAnalytics } from '../../services/uxAnalytics';
import { getApiUrl, getApiKey } from '../../utils/api';
import { designTokens, loadingStyles } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { useEntranceAnimation } from '../../hooks/useAnimation';
import { Card, CardContent, CardHeader, CardTitle, StatCard, EmptyState } from '../ui';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotificationStore } from '../../stores/notificationStore';

const containerStyles = (isMobile: boolean) => css`
  padding: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[4]};
  max-width: 1440px;
  margin: 0 auto;
  display: grid;
  gap: ${designTokens.spacing[3]};
  background: transparent;
`;

const headerRowStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  flex-wrap: wrap;
`;

const titleStyles = css`
  margin: 0;
  font-size: ${designTokens.typography.fontSize['2xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.text.primary};
  letter-spacing: -0.025em;
`;

const controlsRowStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  flex-wrap: wrap;
`;

const projectControlStyles = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.md};
  background: ${designTokens.colors.neutral[50]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  color: ${designTokens.colors.neutral[700]};
  font-size: ${designTokens.typography.fontSize.xs};
`;

const selectStyles = css`
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  background: white;
  color: ${designTokens.colors.neutral[800]};
  font-size: ${designTokens.typography.fontSize.xs};
`;

const statsGridStyles = (isMobile: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'};
  gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[3]};
`;

const listCardStyles = css`
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: ${designTokens.shadows.sm};
`;

const panelTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  line-height: 1.5;
`;

const runListStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
`;

const runCardStyles = (isMobile: boolean) => css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
  padding: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.lg};
  border: 1px solid ${designTokens.colors.neutral[200]};
  background: rgba(255, 255, 255, 0.92);
  box-shadow: ${designTokens.shadows.sm};
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: ${designTokens.shadows.md};
  }
`;

const runTopRowStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${designTokens.spacing[2]};
  flex-wrap: wrap;
`;

const runHeadingStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  flex-wrap: wrap;
  min-width: 0;
`;

const runWorkflowName = css`
  font-weight: ${designTokens.typography.fontWeight.semibold};
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const runMetaText = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

const detailRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[3]};
  align-items: center;
`;

const detailChipStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[600]};
`;

const detailLabelStyles = css`
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[400]};
  font-size: 10px;
`;

const detailValueStyles = css`
  color: ${designTokens.colors.neutral[800]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const runActionsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  align-items: center;
  flex-shrink: 0;
`;

const outcomesRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[2]};
  align-items: center;
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

const liveIndicatorStyles = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

const pulseDotStyles = css`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${designTokens.colors.semantic.success[500]};
  flex-shrink: 0;
`;

const runListSkeletonStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
`;

const runCardSkeletonStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.lg};
  border: 1px solid ${designTokens.colors.neutral[200]};
  background: rgba(255, 255, 255, 0.92);
`;

function formatDuration(run: CreRun) {
  if (!run.finishedAt) return 'In progress';
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.finishedAt).getTime();
  const ms = Math.max(0, end - start);

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

function getStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
    case 'cancelled':
      return 'error' as const;
    case 'paused_for_approval':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}

export default function RunLedger() {
  const { isMobile } = useBreakpoint();
  const { addNotification } = useNotificationStore();
  const [runs, setRuns] = useState<CreRun[]>([]);
  const [projects, setProjects] = useState<Array<{ projectId: string; name: string }>>([]);
  const [projectId, setProjectId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(5000);
  const [activeRunAction, setActiveRunAction] = useState<string | null>(null);
  const [uxSummary, setUxSummary] = useState<{
    totalEvents: number;
    completionRate: number;
    retryRate: number;
  } | null>(null);

  // Animation state: true once initial data loads, used to trigger entrance animations
  const [hasEntered, setHasEntered] = useState(false);
  const prevRunsRef = useRef<string[]>([]);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': getApiKey(),
        },
      });
      const json = await res.json();
      if (json?.projects) {
        setProjects(json.projects);
      }
    } catch {
      // ignore
    }
  };

  const loadUxSummary = async () => {
    try {
      const res = await fetch(getApiUrl('/api/metrics/ux-summary'), {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': getApiKey(),
        },
      });
      const json = await res.json();
      if (json?.success) {
        setUxSummary({
          totalEvents: json.data?.totalEvents || 0,
          completionRate: json.data?.rates?.completionRate || 0,
          retryRate: json.data?.rates?.retryRate || 0,
        });
      }
    } catch {
      // non-blocking
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    const res = await creApi.listRuns(projectId);
    if (!res.success) {
      setError(res.error || 'Failed to load runs');
      setIsLoading(false);
      return;
    }
    const payload = (res.data as any) || {};
    setRuns(payload.runs || []);
    await loadUxSummary();
    setIsLoading(false);
  };

  useEffect(() => {
    loadProjects();
    loadUxSummary();
  }, []);

  useEffect(() => {
    refresh();
  }, [projectId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      refresh();
    }, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshIntervalMs, projectId]);

  const trigger = async (writeAttestation: boolean, requireApproval: boolean = false) => {
    setIsTriggering(true);
    setError(null);
    const res = await creApi.triggerForecast({
      writeAttestation,
      requireApproval,
    });
    if (!res.success) {
      setError(res.error || 'Failed to trigger forecast');
      addNotification({
        type: 'error',
        title: 'Trigger failed',
        message: res.error || 'Unable to start forecast.',
      });
      setIsTriggering(false);
      return;
    }
    addNotification({
      type: 'success',
      title: 'Forecast started',
      message: writeAttestation ? 'Run + Attest initiated.' : 'Forecast is running.',
    });
    await uxAnalytics.track('run_console_view', { source: 'ledger_trigger' });
    await refresh();
    setIsTriggering(false);
  };

  const onCancelRun = async (runId: string) => {
    setActiveRunAction(`cancel-${runId}`);
    const res = await creApi.cancelRun(runId);
    if (!res.success) {
      setError(res.error || 'Failed to cancel run');
      addNotification({
        type: 'error',
        title: 'Cancel failed',
        message: res.error || 'Unable to cancel the run.',
      });
    } else {
      addNotification({
        type: 'info',
        title: 'Run cancelled',
        message: 'The run has been stopped.',
      });
    }
    await uxAnalytics.track('run_cancel', { runId, source: 'ledger' });
    await refresh();
    setActiveRunAction(null);
  };

  const onRetryRun = async (runId: string) => {
    setActiveRunAction(`retry-${runId}`);
    const res = await creApi.retryRun(runId);
    if (!res.success) {
      setError(res.error || 'Failed to retry run');
      addNotification({
        type: 'error',
        title: 'Retry failed',
        message: res.error || 'Unable to retry the run.',
      });
    } else {
      addNotification({
        type: 'success',
        title: 'Run restarted',
        message: 'The run has been re-queued.',
      });
    }
    await uxAnalytics.track('run_retry', { runId, source: 'ledger' });
    await refresh();
    setActiveRunAction(null);
  };

  const summary = useMemo(() => {
    const normalized = runs.map((run) => toAgentRunViewModel(run));
    const completed = normalized.filter((run) => run.status === 'completed').length;
    const active = normalized.filter(
      (run) => run.status === 'running' || run.status === 'paused_for_approval',
    ).length;
    const approvals = normalized.filter((run) => run.status === 'paused_for_approval').length;
    const failed = normalized.filter(
      (run) => run.status === 'failed' || run.status === 'cancelled',
    ).length;

    return {
      total: normalized.length,
      completed,
      active,
      approvals,
      failed,
    };
  }, [runs]);

  return (
    <div css={containerStyles(isMobile)}>
      {/* Header row — matches dashboard's slim header style */}
      <div css={headerRowStyles}>
        <h1 css={titleStyles}>Runs</h1>
        <div css={controlsRowStyles}>
          <div css={projectControlStyles}>
            <span>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              css={selectStyles}
            >
              {(projects.length
                ? projects
                : [{ projectId: 'default', name: 'Default Project' }]
              ).map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div css={projectControlStyles}>
            <span css={css`display: flex; align-items: center; gap: ${designTokens.spacing[1]};`}>
              {autoRefresh && <span css={pulseDotStyles} />}
              <span>Live</span>
            </span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <select
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
              css={selectStyles}
              disabled={!autoRefresh}
            >
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
          <Badge variant="secondary" size="sm">
            {summary.total} tracked
          </Badge>
        </div>
      </div>

      {/* Stats grid — matches dashboard's 4-col layout */}
      <div css={statsGridStyles(isMobile)}>
        <StatCard
          label="Active"
          value={summary.active}
          icon={<Activity size={isMobile ? 18 : 24} />}
          color="primary"
        />
        <StatCard
          label="Completed"
          value={summary.completed}
          icon={<CheckCircle2 size={isMobile ? 18 : 24} />}
          color="success"
        />
        <StatCard
          label="Awaiting"
          value={summary.approvals}
          icon={<Clock3 size={isMobile ? 18 : 24} />}
          color="info"
        />
        <StatCard
          label="Failed"
          value={summary.failed}
          icon={<AlertTriangle size={isMobile ? 18 : 24} />}
          color="error"
        />
      </div>

      {/* Outcomes + error row */}
      {uxSummary && (
        <div css={outcomesRowStyles}>
          <span>
            {uxSummary.totalEvents} events · {(uxSummary.completionRate * 100).toFixed(1)}%
            completion · {(uxSummary.retryRate * 100).toFixed(1)}% retry
          </span>
        </div>
      )}

      {error && (
        <div
          css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            color: ${designTokens.colors.semantic.error[600]};
            padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
            background: ${designTokens.colors.semantic.error[50]};
            border-radius: ${designTokens.borderRadius.md};
          `}
        >
          Couldn't load fresh run data. {error}
        </div>
      )}

      {/* Action buttons */}
      <div css={controlsRowStyles}>
        <Button onClick={() => refresh()} variant="outline" size="sm">
          <RefreshCw size={14} />
          Refresh
        </Button>
        <Button onClick={() => trigger(false)} disabled={isTriggering} variant="primary" size="sm">
          <PlayCircle size={14} />
          Forecast
        </Button>
        <Button
          onClick={() => trigger(true, true)}
          disabled={isTriggering}
          variant="secondary"
          size="sm"
        >
          Require approval
        </Button>
        <Button onClick={() => trigger(true)} disabled={isTriggering} variant="danger" size="sm">
          Run + Attest
        </Button>
      </div>

      {/* Run list */}
      <Card compact css={listCardStyles}>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div css={runListSkeletonStyles}>
              {[1, 2, 3].map((i) => (
                <div key={i} css={runCardSkeletonStyles}>
                  <div css={css`display: flex; gap: ${designTokens.spacing[2]}; align-items: center;`}>
                    <div css={loadingStyles.skeleton('rectangular', 60, 22)} />
                    <div css={loadingStyles.skeleton('rectangular', 160, 16)} />
                    <div css={loadingStyles.skeleton('rectangular', 120, 12)} style={{ marginLeft: 'auto' }} />
                  </div>
                  <div css={css`display: flex; gap: ${designTokens.spacing[3]};`}>
                    <div css={loadingStyles.skeleton('text', 48, 10)} />
                    <div css={loadingStyles.skeleton('text', 48, 10)} />
                    <div css={loadingStyles.skeleton('text', 64, 10)} />
                    <div css={loadingStyles.skeleton('text', 80, 10)} />
                  </div>
                </div>
              ))}
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              type="runs"
              title="No runs yet"
              description="Kick off a forecast to generate the first workflow trace."
              actionLabel="Run forecast"
              onAction={() => {
                void trigger(false);
              }}
            />
          ) : (
            <div css={runListStyles}>
              {runs.map((run, index) => {
                const vm = toAgentRunViewModel(run);
                return (
                  <article
                    key={run.runId}
                    css={[
                      runCardStyles(isMobile),
                      useEntranceAnimation({ delay: index * 60, mode: 'slideInUp' }),
                    ]}
                  >
                    <div css={runTopRowStyles}>
                      <div css={runHeadingStyles}>
                        <Badge variant={getStatusTone(vm.status)} size="sm">
                          {vm.status.toUpperCase()}
                        </Badge>
                        <span css={runWorkflowName}>{run.workflow}</span>
                        <span css={runMetaText}>
                          {run.mode} · {new Date(run.startedAt).toLocaleString()}
                        </span>
                      </div>
                      <div css={runActionsStyles}>
                        {vm.controls.canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={activeRunAction === `cancel-${run.runId}`}
                            onClick={() => onCancelRun(run.runId)}
                          >
                            Cancel
                          </Button>
                        )}
                        {vm.controls.canRetry && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={activeRunAction === `retry-${run.runId}`}
                            onClick={() => onRetryRun(run.runId)}
                          >
                            Retry
                          </Button>
                        )}
                        <Link
                          to={`/runs/${run.runId}`}
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            font-weight: ${designTokens.typography.fontWeight.medium};
                            color: ${designTokens.colors.primary[600]};
                            text-decoration: none;
                            &:hover {
                              text-decoration: underline;
                            }
                          `}
                        >
                          Open →
                        </Link>
                      </div>
                    </div>
                    <div css={detailRowStyles}>
                      <span css={detailChipStyles}>
                        <span css={detailLabelStyles}>Dur</span>
                        <span css={detailValueStyles}>{formatDuration(run)}</span>
                      </span>
                      <span css={detailChipStyles}>
                        <span css={detailLabelStyles}>Steps</span>
                        <span css={detailValueStyles}>{vm.metrics.stepCount}</span>
                      </span>
                      <span css={detailChipStyles}>
                        <span css={detailLabelStyles}>Artifacts</span>
                        <span css={detailValueStyles}>{vm.metrics.artifactCount}</span>
                      </span>
                      <span css={detailChipStyles}>
                        <span css={detailLabelStyles}>Stage</span>
                        <span css={detailValueStyles}>{vm.currentStepName || 'Done'}</span>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
