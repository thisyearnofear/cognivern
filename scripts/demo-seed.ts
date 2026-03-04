import crypto from "node:crypto";
import { creRunStore } from "../src/cre/storage/CreRunStore.js";
import { CreRun } from "../src/cre/types.js";

function now(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeSeedRun(params: {
  status: CreRun["status"];
  ok: boolean;
  withApproval?: boolean;
  parentRunId?: string;
  retryCount?: number;
}): CreRun {
  const runId = crypto.randomUUID();
  const startedAt = now(-120_000);
  const finishedAt =
    params.status === "running" || params.status === "paused_for_approval"
      ? undefined
      : now(-60_000);

  return {
    runId,
    projectId: "default",
    workflow: "forecasting",
    mode: "local",
    startedAt,
    finishedAt,
    ok: params.ok,
    status: params.status,
    parentRunId: params.parentRunId,
    retryCount: params.retryCount || 0,
    requiresApproval: Boolean(params.withApproval),
    approvalState: params.withApproval ? "pending" : "not_required",
    controls: {
      canCancel: params.status === "running" || params.status === "queued",
      canRetry:
        params.status === "failed" ||
        params.status === "cancelled" ||
        params.status === "completed",
      canApprove: Boolean(params.withApproval),
    },
    metrics: {
      latencyMs: finishedAt
        ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
        : undefined,
      stepCount: 3,
      artifactCount: 2,
      estimatedTokens: 720,
      estimatedCostUsd: 0.0018,
    },
    provenance: {
      source: "cognivern",
      workflowVersion: "forecasting-v1",
      model: "demo:model",
      citations: [{ label: "demo", value: "seeded" }],
    },
    events: [
      {
        id: crypto.randomUUID(),
        runId,
        type: "run_started",
        timestamp: startedAt,
        payload: { source: "demo_seed" },
      },
      ...(finishedAt
        ? [
            {
              id: crypto.randomUUID(),
              runId,
              type: params.ok ? "run_finished" : "run_failed",
              timestamp: finishedAt,
              payload: { source: "demo_seed" },
            },
          ]
        : []),
    ],
    plan: {
      version: 1,
      updatedAt: now(-90_000),
      summary: "Demo plan for deterministic hackathon walkthrough.",
      steps: [
        {
          id: "plan-1",
          title: "Fetch market conditions",
          enabled: true,
          status: "approved",
        },
        {
          id: "plan-2",
          title: "Generate forecast",
          enabled: true,
          status: params.withApproval ? "pending" : "approved",
        },
        {
          id: "plan-3",
          title: "Write attestation",
          enabled: params.withApproval ? false : true,
          status: params.withApproval ? "pending" : "approved",
        },
      ],
    },
    steps: [
      {
        kind: "http",
        name: "fetch_sapience_conditions",
        startedAt: now(-115_000),
        finishedAt: now(-112_000),
        ok: true,
        summary: "Fetched 24 conditions",
      },
      {
        kind: "compute",
        name: "select_market_by_horizon",
        startedAt: now(-111_000),
        finishedAt: now(-110_000),
        ok: true,
        summary: "Selected condition",
      },
      {
        kind: "confidential_http",
        name: "generate_forecast_confidentially",
        startedAt: now(-109_000),
        finishedAt: finishedAt || undefined,
        ok: params.ok,
        summary: params.ok ? "Forecast generated" : "Forecast generation failed",
      },
    ],
    artifacts: [
      {
        id: crypto.randomUUID(),
        type: "sapience_conditions",
        createdAt: now(-113_000),
        data: { count: 24 },
      },
      {
        id: crypto.randomUUID(),
        type: params.ok ? "llm_forecast" : "error",
        createdAt: finishedAt || now(-105_000),
        data: params.ok
          ? { probability: 62, reasoning: "Demo forecast", model: "demo:model" }
          : { message: "Demo error case" },
      },
    ],
  };
}

async function main() {
  await creRunStore.reset();

  const completedRun = makeSeedRun({
    status: "completed",
    ok: true,
  });
  const failedRun = makeSeedRun({
    status: "failed",
    ok: false,
  });
  const pausedRun = makeSeedRun({
    status: "paused_for_approval",
    ok: false,
    withApproval: true,
    parentRunId: completedRun.runId,
    retryCount: 1,
  });

  await creRunStore.add(pausedRun);
  await creRunStore.add(failedRun);
  await creRunStore.add(completedRun);

  console.log("Demo seed complete.");
  console.log(`Completed run: ${completedRun.runId}`);
  console.log(`Failed run: ${failedRun.runId}`);
  console.log(`Approval run: ${pausedRun.runId}`);
}

main().catch((error) => {
  console.error("Demo seed failed:", error);
  process.exit(1);
});
