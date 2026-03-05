import React, { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Link } from "react-router-dom";
import { creApi, CreRun } from "../../services/creApi";
import { toAgentRunViewModel } from "../../services/agentRunAdapter";
import { uxAnalytics } from "../../services/uxAnalytics";
import { getApiUrl } from "../../utils/api";
import { designTokens } from "../../styles/design-system";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

const containerStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[6]};
  display: grid;
  gap: ${designTokens.spacing[6]};
  background: ${designTokens.colors.background.secondary};
`;

const headerRowStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const titleBlockStyles = css`
  display: grid;
  gap: ${designTokens.spacing[2]};
`;

const titleStyles = css`
  margin: 0;
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
`;

const subtitleStyles = css`
  margin: 0;
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.lg};
`;

const actionsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  align-items: center;
`;

const runRowStyles = css`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${designTokens.spacing[4]};
  align-items: center;

  @media (max-width: ${designTokens.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const runMetaStyles = css`
  display: grid;
  gap: ${designTokens.spacing[1]};
`;

const smallText = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
`;

function formatDuration(run: CreRun) {
  if (!run.finishedAt) return "running";
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.finishedAt).getTime();
  const ms = Math.max(0, end - start);
  return `${ms}ms`;
}

const statusDotColor = (status: string) => {
  switch (status) {
    case "completed":
      return designTokens.colors.semantic.success;
    case "failed":
    case "cancelled":
      return designTokens.colors.semantic.error;
    case "paused_for_approval":
      return designTokens.colors.semantic.warning;
    default:
      return designTokens.colors.primary[500];
  }
};

export default function RunLedger() {
  const [runs, setRuns] = useState<CreRun[]>([]);
  const [projects, setProjects] = useState<
    Array<{ projectId: string; name: string }>
  >([]);
  const [projectId, setProjectId] = useState<string>("default");
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
      const res = await fetch("/api/projects", {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
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

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    const res = await creApi.listRuns(projectId);
    if (!res.success) {
      setError(res.error || "Failed to load runs");
      setIsLoading(false);
      return;
    }
    // endpoint returns { success, runs }
    // our API service wraps it as data
    const payload = (res.data as any) || {};
    setRuns(payload.runs || []);
    await loadUxSummary();
    setIsLoading(false);
  };

  const loadUxSummary = async () => {
    try {
      const res = await fetch(getApiUrl("/api/metrics/ux-summary"), {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
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
  }, [autoRefresh, refreshIntervalMs]);

  const trigger = async (
    writeAttestation: boolean,
    requireApproval: boolean = false
  ) => {
    setIsTriggering(true);
    setError(null);
    const res = await creApi.triggerForecast({ writeAttestation, requireApproval });
    if (!res.success) {
      setError(res.error || "Failed to trigger forecast");
      setIsTriggering(false);
      return;
    }
    await uxAnalytics.track("run_console_view", { source: "ledger_trigger" });
    await refresh();
    setIsTriggering(false);
  };

  const headerBadge = useMemo(() => {
    if (isLoading) return <Badge variant="secondary">Loading</Badge>;
    return <Badge variant="secondary">{runs.length} runs</Badge>;
  }, [isLoading, runs.length]);

  const onCancelRun = async (runId: string) => {
    setActiveRunAction(`cancel-${runId}`);
    const res = await creApi.cancelRun(runId);
    if (!res.success) {
      setError(res.error || "Failed to cancel run");
    }
    await uxAnalytics.track("run_cancel", { runId, source: "ledger" });
    await refresh();
    setActiveRunAction(null);
  };

  const onRetryRun = async (runId: string) => {
    setActiveRunAction(`retry-${runId}`);
    const res = await creApi.retryRun(runId);
    if (!res.success) {
      setError(res.error || "Failed to retry run");
    }
    await uxAnalytics.track("run_retry", { runId, source: "ledger" });
    await refresh();
    setActiveRunAction(null);
  };

  return (
    <div css={containerStyles} data-dashboard="true">
      <div css={headerRowStyles}>
        <div css={titleBlockStyles}>
          <h1 css={titleStyles}>Agent Run Ledger</h1>
          <p css={subtitleStyles}>
            Verifiable agent execution traces, cognitive paths, and governance
            attestations.
          </p>
          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[2]};
              align-items: center;
              flex-wrap: wrap;
            `}
          >
            <span css={smallText}>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              css={css`
                padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                border-radius: ${designTokens.borderRadius.lg};
                border: 1px solid ${designTokens.colors.neutral[200]};
                background: rgba(255, 255, 255, 0.7);
              `}
            >
              {(projects.length
                ? projects
                : [{ projectId: "default", name: "Default Project" }]
              ).map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name} ({p.projectId})
                </option>
              ))}
            </select>
          </div>
          {headerBadge}
        </div>

        <div css={actionsStyles}>
          <label
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.neutral[700]};
              padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
              border: 1px solid ${designTokens.colors.neutral[200]};
              border-radius: ${designTokens.borderRadius.lg};
              background: rgba(255, 255, 255, 0.6);
            `}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Live refresh
            <select
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
              css={css`
                padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                border-radius: ${designTokens.borderRadius.md};
                border: 1px solid ${designTokens.colors.neutral[200]};
              `}
              disabled={!autoRefresh}
            >
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </label>

          <Button onClick={() => refresh()} variant="secondary">
            Refresh
          </Button>
          <Button
            onClick={() => trigger(false)}
            disabled={isTriggering}
            variant="primary"
          >
            Run forecast (dry)
          </Button>
          <Button
            onClick={() => trigger(true)}
            disabled={isTriggering}
            variant="danger"
          >
            Run + Attest
          </Button>
          <Button
            onClick={() => trigger(true, true)}
            disabled={isTriggering}
            variant="outline"
          >
            Run + Approval Gate
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>API Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div css={smallText}>{error}</div>
          </CardContent>
        </Card>
      )}

      {uxSummary && (
        <Card
          css={css`
            background: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(226, 232, 240, 0.8);
          `}
        >
          <CardHeader>
            <CardTitle>UX Outcome Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div css={smallText}>
              Events: {uxSummary.totalEvents} · Completion rate:{" "}
              {(uxSummary.completionRate * 100).toFixed(1)}% · Retry rate:{" "}
              {(uxSummary.retryRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      )}

      <Card
        css={css`
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: ${designTokens.shadows.sm};
        `}
      >
        <CardHeader>
          <CardTitle>Recent Verifiable Traces</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div css={smallText}>Loading runs…</div>
          ) : runs.length === 0 ? (
            <div css={smallText}>
              No runs yet. Click “Run forecast (dry)” to generate your first
              verifiable trace.
            </div>
          ) : (
            <div
              css={css`
                display: grid;
                gap: ${designTokens.spacing[4]};
              `}
            >
              {runs.map((r) => (
                <div key={r.runId} css={runRowStyles}>
                  {(() => {
                    const vm = toAgentRunViewModel(r);
                    return (
                      <>
                        <div css={runMetaStyles}>
                    <div
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: ${designTokens.spacing[2]};
                      `}
                    >
                      <span
                        css={css`
                          width: 8px;
                          height: 8px;
                          border-radius: 50%;
                          background: ${statusDotColor(vm.status)};
                          box-shadow: 0 0 8px ${statusDotColor(vm.status)};
                          display: inline-block;
                        `}
                      />
                      <strong>{r.workflow}</strong> · <span>{r.mode}</span>
                    </div>
                    <div css={smallText}>
                      {new Date(r.startedAt).toLocaleString()} ·{" "}
                      {formatDuration(r)}
                    </div>
                    <div css={smallText}>
                      Status: {vm.status} · Steps: {vm.metrics.stepCount} ·
                      Artifacts: {vm.metrics.artifactCount}
                    </div>
                    {vm.currentStepName && (
                      <div css={smallText}>Current step: {vm.currentStepName}</div>
                    )}
                  </div>

                  <div
                    css={css`
                      display: flex;
                      gap: ${designTokens.spacing[2]};
                      align-items: center;
                      justify-content: flex-end;
                      flex-wrap: wrap;
                    `}
                  >
                    <Badge
                      variant={
                        vm.status === "completed"
                          ? "success"
                          : vm.status === "failed" || vm.status === "cancelled"
                            ? "error"
                            : vm.status === "paused_for_approval"
                              ? "warning"
                              : "secondary"
                      }
                    >
                      {vm.status.toUpperCase()}
                    </Badge>
                    {vm.controls.canCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activeRunAction === `cancel-${r.runId}`}
                        onClick={() => onCancelRun(r.runId)}
                      >
                        Cancel
                      </Button>
                    )}
                    {vm.controls.canRetry && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={activeRunAction === `retry-${r.runId}`}
                        onClick={() => onRetryRun(r.runId)}
                      >
                        Retry
                      </Button>
                    )}
                    <Link to={`/runs/${r.runId}`}>View</Link>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
