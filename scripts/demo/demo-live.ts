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

async function bootstrapVault() {
  return request<ApiEnvelope<any>>("/api/ows/bootstrap", {
    method: "POST",
  });
}

async function listWallets() {
  return request<ApiEnvelope<any>>("/api/ows/wallets");
}

async function createOwsApiKey(payload: {
  name: string;
  walletIds: string[];
  policyIds: string[];
  metadata?: Record<string, unknown>;
}) {
  return request<ApiEnvelope<any>>("/api/ows/api-keys", {
    method: "POST",
    json: payload,
  });
}

async function ensureSpendPolicy() {
  const policyName = `Hackathon Spend Guardrails ${new Date().toISOString()}`;
  const payload = {
    name: policyName,
    description:
      "Live demo policy for governed spend: low-value allow, mid-range hold, high-value deny, vendor restriction.",
    rules: [
      {
        id: `rule-amount-${crypto.randomUUID()}`,
        type: "deny",
        condition: "Number(action.metadata.amountUsd || 0) > 100",
        action: { type: "block", parameters: { reason: "Amount exceeds $100" } },
        metadata: { reason: "Amount exceeds live demo limit" },
      },
      {
        id: `rule-review-${crypto.randomUUID()}`,
        type: "require",
        condition: "Number(action.metadata.amountUsd || 0) <= 25",
        action: {
          type: "escalate",
          parameters: { reason: "Amounts above $25 require approval" },
        },
        metadata: { reason: "Amounts above $25 require approval" },
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

async function requestSpend(
  spend: Record<string, unknown>,
  owsApiKey: string,
) {
  return request<ApiEnvelope<any>>("/api/spend", {
    method: "POST",
    headers: {
      "X-OWS-API-KEY": owsApiKey,
    },
    json: spend,
  });
}

async function main() {
  console.log(`Using Cognivern at ${baseUrl}`);
  console.log(`Project: ${projectId}`);

  const bootstrap = await bootstrapVault();
  console.log(`Vault bootstrap: ${bootstrap.success ? "ready" : "failed"}`);

  const wallets = await listWallets();
  const walletId = wallets.data?.[0]?.id;
  if (!walletId) {
    throw new Error("No OWS wallet is available after bootstrap");
  }

  const policy = await ensureSpendPolicy();
  console.log(`Created live demo policy: ${policy.id}`);

  const scopedKey = await createOwsApiKey({
    name: `Procurement Agent ${new Date().toISOString()}`,
    walletIds: [walletId],
    policyIds: [policy.id],
    metadata: {
      agentId: "procurement-agent-1",
      demo: "ows-hackathon-live",
    },
  });
  const owsApiKey = scopedKey.data?.token;
  if (!owsApiKey) {
    throw new Error("OWS API key creation did not return a token");
  }

  const status = await request<ApiEnvelope<any>>("/api/spend/status");

  const approved = await requestSpend({
    agentId: "procurement-agent-1",
    recipient: "0x1111111111111111111111111111111111111111",
    amount: "12",
    asset: "USDC",
    reason: "Send campaign email batch through approved vendor",
    metadata: {
      policyId: policy.id,
      walletId,
      amountUsd: 12,
      vendor: "stable-email",
      chain: "base",
      purpose: "newsletter_send",
    },
  }, owsApiKey);

  const held = await requestSpend({
    agentId: "procurement-agent-1",
    recipient: "0x2222222222222222222222222222222222222222",
    amount: "55",
    asset: "USDC",
    reason: "Mid-sized supplier payment requiring operator review",
    metadata: {
      policyId: policy.id,
      walletId,
      amountUsd: 55,
      vendor: "stable-email",
      chain: "base",
      purpose: "supplier_review",
    },
  }, owsApiKey);

  const denied = await requestSpend({
    agentId: "procurement-agent-1",
    recipient: "0x3333333333333333333333333333333333333333",
    amount: "125",
    asset: "USDC",
    reason: "Large supplier payment above budget threshold",
    metadata: {
      policyId: policy.id,
      walletId,
      amountUsd: 125,
      vendor: "stable-email",
      chain: "base",
      purpose: "supplier_payment",
    },
  }, owsApiKey);

  const auditLogs = await request<ApiEnvelope<{ logs?: unknown[] }>>("/api/audit/logs");
  const runs = await request<ApiEnvelope<{ runs?: unknown[] }>>(
    `/api/cre/runs?projectId=${encodeURIComponent(projectId)}`,
  );

  console.log("");
  console.log("Live demo scenario complete.");
  console.log(`OWS wallet: ${walletId}`);
  console.log(`Scoped API key: ${scopedKey.data?.apiKey?.id ?? "unknown"}`);
  console.log(`Policy ID: ${policy.id}`);
  console.log(`Execution layer: ${status.data?.status}`);
  console.log(`Approved spend: ${approved.data?.status} (${approved.data?.runId ?? "no run"})`);
  console.log(`Held spend: ${held.data?.status} (${held.data?.runId ?? "no run"})`);
  console.log(`Denied spend: ${denied.data?.status} (${denied.data?.runId ?? "no run"})`);
  console.log(
    `Audit log count: ${auditLogs.data?.logs?.length ?? "unknown"}`,
  );
  console.log(`Run count: ${runs.data?.runs?.length ?? runs.runs?.length ?? "unknown"}`);
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
