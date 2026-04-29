import React, { useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Clock3, PlayCircle, RefreshCw } from 'lucide-react';
import { creApi, CreRun } from '../../services/creApi';
import { toAgentRunViewModel } from '../../services/agentRunAdapter';
import { uxAnalytics } from '../../services/uxAnalytics';
import { getApiUrl, getApiKey } from '../../utils/api';
import { designTokens } from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, StatCard, EmptyState } from '../ui';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const pageStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[4]};
  display: grid;
  gap: ${designTokens.spacing[4]};
  background: transparent;
`;

const heroStyles = css`
  display: grid;
  gap: ${designTokens.spacing[4]};
  padding: ${designTokens.spacing[6]};
  border-radius: ${designTokens.borderRadius.xl};
  background: linear-gradient(
    135deg,
    ${designTokens.colors.primary[50]} 0%,
    ${designTokens.colors.semantic.success[50]} 100%
  );
  border: 1px solid ${designTokens.colors.primary[100]};
  box-shadow: ${designTokens.shadows.sm};
`;

const heroHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const heroCopyStyles = css`
  display: grid;
  gap: ${designTokens.spacing[2]};
  max-width: 760px;
`;

const titleStyles = css`
  margin: 0;
  font-size: ${designTokens.typography.fontSize['3xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
`;

const subtitleStyles = css`
  margin: 0;
  color: ${designTokens.colors.neutral[700]};
  font-size: ${designTokens.typography.fontSize.lg};
  line-height: 1.6;
`;

const controlsRowStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  flex-wrap: wrap;
`;

const projectControlStyles = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.lg};
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.9);
  color: ${designTokens.colors.neutral[700]};
  font-size: ${designTokens.typography.fontSize.sm};
`;

const selectStyles = css`
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  background: rgba(255, 255, 255, 0.95);
  color: ${designTokens.colors.neutral[800]};
`;

const actionsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  align-items: center;
  flex-wrap: wrap;
`;

const statsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${designTokens.spacing[3]};
`;

const statusPanelStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: ${designTokens.spacing[3]};
`;

const panelTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  line-height: 1.6;
`;

const listCardStyles = css`
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: ${designTokens.shadows.sm};
`;

const runListStyles = css`
  display: grid;
  gap: ${designTokens.spacing[3]};
`;

const runCardStyles = css`
  display: grid;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[4]};
  border-radius: ${designTokens.borderRadius.xl};
  border: 1px solid ${designTokens.colors.neutral[200]};
  background: rgba(255, 255, 255, 0.92);
  box-shadow: ${designTokens.shadows.sm};
`;

const runTopRowStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${designTokens.spacing[3]};
  flex-wrap: wrap;
`;

const runHeadingStyles = css`
  display: grid;
  gap: ${designTokens.spacing[1]};
`;

const runMetaRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[2]};
  align-items: center;
`;

const smallTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
`;

const detailGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: ${designTokens.spacing[2]};
`;

const detailTileStyles = css`
  display: grid;
  gap: ${designTokens.spacing[1]};
  padding: ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.lg};
  background: ${designTokens.colors.neutral[50]};
  border: 1px solid ${designTokens.colors.neutral[100]};
`;

const detailLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${designTokens.colors.neutral[500]};
  font-weight: ${designTokens.typography.fontWeight.semibold};
`;

const detailValueStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[800]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

function formatDuration(run: CreRun) {
  if (!run.finishedAt) return 'In progress';
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.finishedAt).getTime();
  const ms = Math.max(0, end - start);

  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
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
      setIsTriggering(false);
      return;
    }
    await uxAnalytics.track('run_console_view', { source: 'ledger_trigger' });
    await refresh();
    setIsTriggering(false);
  };

  const onCancelRun = async (runId: string) => {
    setActiveRunAction(`cancel-${runId}`);
    const res = await creApi.cancelRun(runId);
    if (!res.success) {
      setError(res.error || 'Failed to cancel run');
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
    <div css={pageStyles} data-dashboard="true">
      <section css={heroStyles}>
        <div css={heroHeaderStyles}>
          <div css={heroCopyStyles}>
            <h1 css={titleStyles}>Runs</h1>
            <p css={subtitleStyles}>
              Monitor live agent workflows, approvals, and execution outcomes in one place.
              Review what happened, what needs attention, and where to drill in next.
            </p>
            <div css={controlsRowStyles}>
              <div css={projectControlStyles}>
                <span>Project</span>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} css={selectStyles}>
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
                <span>Live refresh</span>
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
              <Badge variant="secondary">{summary.total} runs tracked</Badge>
            </div>
          </div>

          <div css={actionsStyles}>
            <Button onClick={() => refresh()} variant="outline">
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button onClick={() => trigger(false)} disabled={isTriggering} variant="primary">
              <PlayCircle size={16} />
              Run forecast
            </Button>
            <Button onClick={() => trigger(true, true)} disabled={isTriggering} variant="secondary">
              Require approval
            </Button>
            <Button onClick={() => trigger(true)} disabled={isTriggering} variant="danger">
              Run + Attest
            </Button>
          </div>
        </div>

        <div css={statsGridStyles}>
          <StatCard
            label="Active runs"
            value={summary.active}
            icon={<Activity size={16} />}
            color="primary"
          />
          <StatCard
            label="Completed"
            value={summary.completed}
            icon={<CheckCircle2 size={16} />}
            color="success"
          />
          <StatCard
            label="Awaiting approval"
            value={summary.approvals}
            icon={<Clock3 size={16} />}
            color="info"
          />
          <StatCard
            label="Needs attention"
            value={summary.failed}
            icon={<AlertTriangle size={16} />}
            color="error"
          />
        </div>
      </section>

      <section css={statusPanelStyles}>
        {uxSummary && (
          <Card compact css={listCardStyles}>
            <CardHeader>
              <CardTitle>Operator outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              <div css={panelTextStyles}>
                {uxSummary.totalEvents} tracked events · {(uxSummary.completionRate * 100).toFixed(1)}%
                {' '}completion · {(uxSummary.retryRate * 100).toFixed(1)}% retry rate
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card compact css={listCardStyles}>
            <CardHeader>
              <CardTitle>Connection issue</CardTitle>
            </CardHeader>
            <CardContent>
              <div css={panelTextStyles}>
                We couldn&apos;t load fresh run data. {error}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <Card compact css={listCardStyles}>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div css={panelTextStyles}>Loading latest runs…</div>
          ) : runs.length === 0 ? (
            <EmptyState
              type="runs"
              title="No runs yet"
              description="Kick off a forecast to generate the first workflow trace for this project."
              actionLabel="Run forecast"
              onAction={() => {
                void trigger(false);
              }}
            />
          ) : (
            <div css={runListStyles}>
              {runs.map((run) => {
                const vm = toAgentRunViewModel(run);
                return (
                  <article key={run.runId} css={runCardStyles}>
                    <div css={runTopRowStyles}>
                      <div css={runHeadingStyles}>
                        <div css={runMetaRowStyles}>
                          <Badge variant={getStatusTone(vm.status)}>{vm.status.toUpperCase()}</Badge>
                          <span css={smallTextStyles}>{new Date(run.startedAt).toLocaleString()}</span>
                        </div>
                        <strong>{run.workflow}</strong>
                        <span css={smallTextStyles}>
                          {run.mode} workflow · Run ID {run.runId}
                        </span>
                      </div>

                      <div css={actionsStyles}>
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
                        <Link to={`/runs/${run.runId}`}>Open run</Link>
                      </div>
                    </div>

                    <div css={detailGridStyles}>
                      <div css={detailTileStyles}>
                        <span css={detailLabelStyles}>Duration</span>
                        <span css={detailValueStyles}>{formatDuration(run)}</span>
                      </div>
                      <div css={detailTileStyles}>
                        <span css={detailLabelStyles}>Steps</span>
                        <span css={detailValueStyles}>{vm.metrics.stepCount}</span>
                      </div>
                      <div css={detailTileStyles}>
                        <span css={detailLabelStyles}>Artifacts</span>
                        <span css={detailValueStyles}>{vm.metrics.artifactCount}</span>
                      </div>
                      <div css={detailTileStyles}>
                        <span css={detailLabelStyles}>Current stage</span>
                        <span css={detailValueStyles}>{vm.currentStepName || 'Finished'}</span>
                      </div>
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
