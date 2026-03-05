import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Link, useParams } from "react-router-dom";
import { getApiUrl } from "../../utils/api";
import { creApi, CreRun, CreRunEvent } from "../../services/creApi";
import {
  toAgentRunViewModel,
  toForensicEvents,
} from "../../services/agentRunAdapter";
import { toAgUiStream } from "../../services/agUiAdapter";
import { uxAnalytics } from "../../services/uxAnalytics";
import { designTokens } from "../../styles/design-system";
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  LoadingSpinner,
} from "../ui";
import ForensicTimeline from "../ui/ForensicTimeline";

const containerStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[8]};
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[6]};
  max-width: 1100px;
  margin: 0 auto;
`;

const topBarStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const metricGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${designTokens.spacing[4]};
`;

export default function RunDetails() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<CreRun | null>(null);
  const [liveEvents, setLiveEvents] = useState<CreRunEvent[]>([]);
  const [, setEventCursor] = useState<number | undefined>(undefined);
  const [approvalReason, setApprovalReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planSummary, setPlanSummary] = useState("");
  const [planDraft, setPlanDraft] = useState<
    Array<{ id: string; title: string; description?: string; enabled: boolean }>
  >([]);

  const load = async (
    resetEventState: boolean = true,
    showLoadingIndicator: boolean = true
  ) => {
    if (!runId) return;
    if (showLoadingIndicator) {
      setIsLoading(true);
    }
    setError(null);
    const res = await creApi.getRun(runId);
    if (!res.success) {
      setError(res.error || "Failed to load run.");
      if (showLoadingIndicator) {
        setIsLoading(false);
      }
      return;
    }
    const payload = (res.data as any) || {};
    const loadedRun = payload.run || null;
    setRun(loadedRun);
    if (loadedRun?.plan) {
      setPlanSummary(loadedRun.plan.summary || "");
      setPlanDraft(
        loadedRun.plan.steps.map((step: any) => ({
          id: step.id,
          title: step.title,
          description: step.description,
          enabled: Boolean(step.enabled),
        }))
      );
    }
    if (resetEventState) {
      setLiveEvents([]);
      setEventCursor(undefined);
    }
    if (showLoadingIndicator) {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(true, true);
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    uxAnalytics.track("run_console_view", { runId });
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
    const streamUrl = getApiUrl(
      `/api/cre/runs/${encodeURIComponent(runId)}/events/stream?apiKey=${encodeURIComponent(apiKey)}`
    );
    const source = new EventSource(streamUrl);

    source.addEventListener("run_event", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as CreRunEvent;
        if (!parsed?.id) return;
        setLiveEvents((prev) => {
          if (prev.some((e) => e.id === parsed.id)) return prev;
          return [...prev, parsed];
        });
        const ts = new Date(parsed.timestamp).getTime();
        if (!Number.isNaN(ts)) {
          setEventCursor((prev) => (typeof prev === "number" ? Math.max(prev, ts) : ts));
        }
      } catch {
        // Ignore malformed event payloads.
      }
    });

    source.onerror = () => {
      // Keep UI usable on transient network issues; periodic state sync effect will recover.
    };

    return () => {
      source.close();
    };
  }, [runId]);

  useEffect(() => {
    if (!run) return;
    const status = run.status || (run.finishedAt ? (run.ok ? "completed" : "failed") : "running");
    if (status !== "running" && status !== "paused_for_approval") return;
    const id = window.setInterval(() => {
      void load(false, false);
    }, 5000);
    return () => window.clearInterval(id);
  }, [run, runId]);

  const vm = useMemo(() => (run ? toAgentRunViewModel(run) : null), [run]);
  const timelineEvents = useMemo(
    () => (run ? toForensicEvents(run, liveEvents) : []),
    [run, liveEvents]
  );
  const agUiStream = useMemo(
    () => toAgUiStream([...(run?.events || []), ...liveEvents]),
    [run, liveEvents]
  );
  const lastFailedStepIndex = useMemo(() => {
    if (!run) return -1;
    return run.steps.findIndex((step) => !step.ok);
  }, [run]);

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || "Run action failed.");
    } finally {
      await load();
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div css={containerStyles}>
        <div style={{ display: "flex", justifyContent: "center", padding: "120px" }}>
          <LoadingSpinner size="lg" text="Loading run console..." />
        </div>
      </div>
    );
  }

  if (!run || !vm) {
    return (
      <div css={containerStyles}>
        <Card variant="outlined">
          <CardContent style={{ textAlign: "center", padding: "60px" }}>
            <h3>Run not found</h3>
            <p>The requested run could not be located.</p>
            <Link to="/runs">Return to ledger</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={topBarStyles}>
        <div>
          <h1
            css={css`
              margin: 0;
              font-size: ${designTokens.typography.fontSize["4xl"]};
              font-weight: ${designTokens.typography.fontWeight.bold};
            `}
          >
            Agent Run Console
          </h1>
          <div
            css={css`
              margin-top: ${designTokens.spacing[2]};
              display: flex;
              gap: ${designTokens.spacing[2]};
              align-items: center;
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
            <span>Run ID: {vm.runId}</span>
            <span>Duration: {vm.durationLabel}</span>
            {vm.currentStepName && <span>Current: {vm.currentStepName}</span>}
          </div>
          <div
            css={css`
              margin-top: ${designTokens.spacing[3]};
            `}
          >
            <Link to="/runs">← Return to Run Ledger</Link>
          </div>
        </div>

        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[2]};
            flex-wrap: wrap;
            justify-content: flex-end;
          `}
        >
          <Button onClick={() => load()} variant="outline" disabled={isBusy}>
            Refresh
          </Button>
          {vm.controls.canCancel && (
            <Button
              onClick={() =>
                runAction(async () => {
                  await creApi.cancelRun(vm.runId);
                  await uxAnalytics.track("run_cancel", { runId: vm.runId });
                })
              }
              variant="danger"
              disabled={isBusy}
            >
              Cancel Run
            </Button>
          )}
          {vm.controls.canRetry && (
            <Button
              onClick={() =>
                runAction(async () => {
                  await creApi.retryRun(vm.runId);
                  await uxAnalytics.track("run_retry", { runId: vm.runId });
                })
              }
              variant="secondary"
              disabled={isBusy}
            >
              Retry Run
            </Button>
          )}
          {vm.controls.canRetry && lastFailedStepIndex > 0 && (
            <Button
              onClick={() =>
                runAction(async () => {
                  await creApi.retryRun(vm.runId, { fromStep: lastFailedStepIndex });
                  await uxAnalytics.track("run_retry_from_step", {
                    runId: vm.runId,
                    fromStep: lastFailedStepIndex,
                  });
                })
              }
              variant="outline"
              disabled={isBusy}
            >
              Retry From Step {lastFailedStepIndex + 1}
            </Button>
          )}
          <Button
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(run, null, 2))
            }
            variant="primary"
            disabled={isBusy}
          >
            Export JSON
          </Button>
        </div>
      </div>

      {error && (
        <Card variant="outlined">
          <CardContent>{error}</CardContent>
        </Card>
      )}

      {vm.controls.canApprove && (
        <Card variant="outlined">
          <CardHeader>Human Approval Required</CardHeader>
          <CardContent>
            <div
              css={css`
                display: grid;
                gap: ${designTokens.spacing[3]};
              `}
            >
              <textarea
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Optional approval note..."
                rows={3}
                css={css`
                  width: 100%;
                  border: 1px solid ${designTokens.colors.neutral[300]};
                  border-radius: ${designTokens.borderRadius.md};
                  padding: ${designTokens.spacing[3]};
                  font-family: inherit;
                `}
              />
              <div
                css={css`
                  display: flex;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <Button
                  variant="primary"
                  disabled={isBusy}
                  onClick={() =>
                    runAction(async () => {
                      await creApi.submitRunApproval(vm.runId, {
                        approve: true,
                        reason: approvalReason.trim() || undefined,
                      });
                      await uxAnalytics.track("run_approval_approve", {
                        runId: vm.runId,
                      });
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={isBusy}
                  onClick={() =>
                    runAction(async () => {
                      await creApi.submitRunApproval(vm.runId, {
                        approve: false,
                        reason: approvalReason.trim() || undefined,
                      });
                      await uxAnalytics.track("run_approval_reject", {
                        runId: vm.runId,
                      });
                    })
                  }
                >
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {run.plan && (
        <Card variant="outlined">
          <CardHeader>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: ${designTokens.spacing[2]};
                flex-wrap: wrap;
              `}
            >
              <span>Execution Plan</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowPlanEditor((prev) => !prev);
                  if (!showPlanEditor) {
                    uxAnalytics.track("run_plan_opened", { runId: vm.runId });
                  }
                }}
              >
                {showPlanEditor ? "Close Plan Editor" : "Edit Plan"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showPlanEditor ? (
              <div
                css={css`
                  display: grid;
                  gap: ${designTokens.spacing[3]};
                `}
              >
                <textarea
                  value={planSummary}
                  onChange={(e) => setPlanSummary(e.target.value)}
                  rows={2}
                  placeholder="Plan summary..."
                  css={css`
                    width: 100%;
                    border: 1px solid ${designTokens.colors.neutral[300]};
                    border-radius: ${designTokens.borderRadius.md};
                    padding: ${designTokens.spacing[3]};
                    font-family: inherit;
                  `}
                />
                {planDraft.map((step, idx) => (
                  <label
                    key={step.id}
                    css={css`
                      display: grid;
                      grid-template-columns: auto 1fr;
                      gap: ${designTokens.spacing[2]};
                      align-items: start;
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(e) => {
                        const next = [...planDraft];
                        next[idx] = { ...next[idx], enabled: e.target.checked };
                        setPlanDraft(next);
                      }}
                    />
                    <div>
                      <strong>{step.title}</strong>
                      <div
                        css={css`
                          color: ${designTokens.colors.neutral[600]};
                          font-size: ${designTokens.typography.fontSize.sm};
                        `}
                      >
                        {step.description || "No description"}
                      </div>
                    </div>
                  </label>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isBusy}
                    onClick={() =>
                      runAction(async () => {
                        await creApi.updateRunPlan(vm.runId, {
                          version: (run.plan?.version || 1) + 1,
                          summary: planSummary.trim() || undefined,
                          steps: planDraft.map((step) => ({
                            ...step,
                            status: "pending",
                          })),
                        });
                        await uxAnalytics.track("run_plan_saved", {
                          runId: vm.runId,
                          enabledSteps: planDraft.filter((s) => s.enabled).length,
                        });
                      })
                    }
                  >
                    Save Plan For Approval
                  </Button>
                </div>
              </div>
            ) : (
              <div
                css={css`
                  display: grid;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <div>{run.plan.summary || "No plan summary."}</div>
                {run.plan.steps.map((step) => (
                  <div key={step.id}>
                    <Badge variant={step.enabled ? "secondary" : "outline"} size="sm">
                      {step.enabled ? "enabled" : "disabled"}
                    </Badge>{" "}
                    {step.title}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div css={metricGridStyles}>
        <Card variant="outlined">
          <CardHeader>Latency</CardHeader>
          <CardContent>{vm.metrics.latencyMs ?? "N/A"} ms</CardContent>
        </Card>
        <Card variant="outlined">
          <CardHeader>Steps</CardHeader>
          <CardContent>{vm.metrics.stepCount}</CardContent>
        </Card>
        <Card variant="outlined">
          <CardHeader>Artifacts</CardHeader>
          <CardContent>{vm.metrics.artifactCount}</CardContent>
        </Card>
        <Card variant="outlined">
          <CardHeader>Estimated Tokens / Cost</CardHeader>
          <CardContent>
            {vm.metrics.estimatedTokens ?? "N/A"} / $
            {vm.metrics.estimatedCostUsd?.toFixed(6) ?? "N/A"}
          </CardContent>
        </Card>
      </div>

      <Card variant="outlined">
        <CardHeader>Provenance</CardHeader>
        <CardContent>
          <div
            css={css`
              display: grid;
              gap: ${designTokens.spacing[2]};
            `}
          >
            <div>Source: {vm.provenance.source}</div>
            <div>Workflow Version: {vm.provenance.workflowVersion || "N/A"}</div>
            <div>Model: {vm.provenance.model || "N/A"}</div>
            <div>
              Citations:
              {vm.provenance.citations.length ? (
                <ul>
                  {vm.provenance.citations.map((c, idx) => (
                    <li key={`${c.label}-${idx}`}>
                      {c.label}: {c.value}
                    </li>
                  ))}
                </ul>
              ) : (
                " none"
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>AG-UI Compatible Event Stream</CardHeader>
        <CardContent>
          <div>Total Events: {agUiStream.length}</div>
          <div>Latest Timestamp: {agUiStream.length ? agUiStream[agUiStream.length - 1].timestamp : "N/A"}</div>
        </CardContent>
      </Card>

      <section>
        <h2
          css={css`
            margin: 0 0 ${designTokens.spacing[3]} 0;
          `}
        >
          Run Event Timeline
        </h2>
        <ForensicTimeline events={timelineEvents} />
      </section>
    </div>
  );
}
