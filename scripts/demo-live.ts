import crypto from "node:crypto";

type ApiEnvelope<T = any> = {
  success?: boolean;
  data?: T;
  error?: any;
  [key: string]: unknown;
};

const baseUrl = (process.env.COGNIVERN_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const apiKey = process.env.COGNIVERN_API_KEY || "development-api-key";
const projectId = process.env.COGNIVERN_PROJECT_ID || "default";
const ingestKey = process.env.COGNIVERN_INGEST_KEY || "dev-ingest-key";

async function request<T = any>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (path.startsWith("/api/")) {
    headers.set("X-API-KEY", apiKey);
  }
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as ApiEnvelope<T>) : ({} as ApiEnvelope<T>);

  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message || `${path} failed with ${res.status}`,
    );
  }

  return body as T;
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function ensureSpendPolicy() {
  const policyName = `Hackathon Spend Guardrails ${new Date().toISOString()}`;
  const payload = {
    name: policyName,
    description:
      "Live demo policy for governed spend: low-value allow, high-value deny, vendor restriction.",
    rules: [
      {
        id: `rule-amount-${crypto.randomUUID()}`,
        type: "deny",
        condition: "action.metadata.amountUsd > 50",
        action: { type: "block", parameters: { reason: "Amount exceeds $50" } },
        metadata: { reason: "Amount exceeds live demo limit" },
      },
      {
        id: `rule-vendor-${crypto.randomUUID()}`,
        type: "deny",
        condition: 'action.metadata.vendor !== "stable-email"',
        action: {
          type: "block",
          parameters: { reason: "Vendor is not on the allowlist" },
        },
        metadata: { reason: "Vendor is not on the allowlist" },
      },
    ],
  };

  const response = await request<ApiEnvelope<{ id: string }>>(
    "/api/governance/policies",
    {
      method: "POST",
      json: payload,
    },
  );

  if (!response.success || !response.data) {
    throw new Error("Policy creation did not return policy data");
  }

  return response.data;
}

async function evaluateAction(policyId: string, action: Record<string, unknown>) {
  return request<ApiEnvelope<any>>("/api/governance/evaluate", {
    method: "POST",
    json: {
      agentId: "procurement-agent-1",
      policyId,
      action,
    },
  });
}

async function ingestRun(run: Record<string, unknown>) {
  return request<ApiEnvelope<any>>("/ingest/runs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ingestKey}`,
      "X-PROJECT-ID": projectId,
    },
    json: run,
  });
}

async function main() {
  console.log(`Using Cognivern at ${baseUrl}`);
  console.log(`Project: ${projectId}`);

  const policy = await ensureSpendPolicy();
  console.log(`Created live demo policy: ${policy.id}`);

  const approved = await evaluateAction(policy.id, {
    id: crypto.randomUUID(),
    type: "spend_request",
    description: "Send campaign email batch through approved vendor",
    metadata: {
      amountUsd: 12,
      vendor: "stable-email",
      chain: "base",
      purpose: "newsletter_send",
    },
  });

  const denied = await evaluateAction(policy.id, {
    id: crypto.randomUUID(),
    type: "spend_request",
    description: "Large supplier payment above budget threshold",
    metadata: {
      amountUsd: 125,
      vendor: "stable-email",
      chain: "base",
      purpose: "supplier_payment",
    },
  });

  const pausedRunId = crypto.randomUUID();
  await ingestRun({
    runId: pausedRunId,
    projectId,
    workflow: "spend",
    mode: "local",
    startedAt: isoNow(-15_000),
    ok: false,
    status: "paused_for_approval",
    requiresApproval: true,
    approvalState: "pending",
    currentStepName: "request_approval",
    controls: {
      canCancel: true,
      canRetry: false,
      canApprove: true,
    },
    provenance: {
      source: "ingested",
      workflowVersion: "spend-demo-v1",
      model: "procurement-agent-1",
      citations: [{ label: "demo", value: "live" }],
    },
    plan: {
      version: 1,
      updatedAt: isoNow(-10_000),
      summary: "Request approval for high-value supplier payment.",
      steps: [
        {
          id: "plan-1",
          title: "Prepare spend request",
          enabled: true,
          status: "approved",
        },
        {
          id: "plan-2",
          title: "Pause for approval",
          enabled: true,
          status: "pending",
        },
      ],
    },
    steps: [
      {
        kind: "compute",
        name: "assemble_spend_intent",
        startedAt: isoNow(-14_000),
        finishedAt: isoNow(-13_500),
        ok: true,
        summary: "Prepared supplier payment request",
      },
      {
        kind: "http",
        name: "request_approval",
        startedAt: isoNow(-13_000),
        ok: false,
        summary: "High-value spend paused for operator approval",
      },
    ],
    artifacts: [
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: isoNow(-13_500),
        data: {
          amountUsd: 125,
          vendor: "stable-email",
          chain: "base",
          reason: "supplier_payment",
        },
      },
    ],
  });

  const completedRunId = crypto.randomUUID();
  await ingestRun({
    runId: completedRunId,
    projectId,
    workflow: "spend",
    mode: "local",
    startedAt: isoNow(-8_000),
    finishedAt: isoNow(-2_000),
    ok: true,
    status: "completed",
    approvalState: "not_required",
    controls: {
      canCancel: false,
      canRetry: true,
      canApprove: false,
    },
    provenance: {
      source: "ingested",
      workflowVersion: "spend-demo-v1",
      model: "research-agent-1",
      citations: [{ label: "demo", value: "live" }],
    },
    steps: [
      {
        kind: "compute",
        name: "evaluate_vendor_quote",
        startedAt: isoNow(-8_000),
        finishedAt: isoNow(-6_500),
        ok: true,
        summary: "Validated low-cost vendor request",
      },
      {
        kind: "http",
        name: "complete_paid_action",
        startedAt: isoNow(-6_000),
        finishedAt: isoNow(-2_000),
        ok: true,
        summary: "Completed low-cost spend within policy",
      },
    ],
    artifacts: [
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: isoNow(-6_500),
        data: {
          amountUsd: 12,
          vendor: "stable-email",
          chain: "base",
          reason: "newsletter_send",
        },
      },
    ],
  });

  const auditLogs = await request<ApiEnvelope<{ logs?: unknown[] }>>("/api/audit/logs");
  const runs = await request<ApiEnvelope<{ runs?: unknown[] }>>(
    `/api/cre/runs?projectId=${encodeURIComponent(projectId)}`,
  );

  console.log("");
  console.log("Live demo scenario complete.");
  console.log(`Policy ID: ${policy.id}`);
  console.log(
    `Approved action: ${approved.data?.approved ? "approved" : "unexpected result"}`,
  );
  console.log(
    `Denied action: ${denied.data?.approved ? "unexpected result" : "denied"}`,
  );
  console.log(`Paused approval run: ${pausedRunId}`);
  console.log(`Completed run: ${completedRunId}`);
  console.log(
    `Audit log count: ${auditLogs.data?.logs?.length ?? "unknown"}`,
  );
  console.log(`Run count: ${runs.runs?.length ?? "unknown"}`);
  console.log("");
  console.log("Open these screens for the demo:");
  console.log(`- ${baseUrl}/audit`);
  console.log(`- ${baseUrl}/runs`);
  console.log(`- ${baseUrl}/agents`);
}

main().catch((error) => {
  console.error("Live demo failed:", error);
  process.exit(1);
});
