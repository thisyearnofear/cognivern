/**
 * Demo seed — prepare a Cognivern workspace for tester onboarding.
 *
 * Creates a funded mandate (budget + success metrics), adds evidence-backed
 * outcome observations, and runs governance checks so the Audit page has
 * approved / held / denied decisions. When the backend has HydraDB enabled,
 * mandate creation and outcome ingestion auto-sync to HydraDB, so the Capital
 * page Evidence context goes live immediately after this script runs.
 *
 * Idempotent: every write uses an Idempotency-Key header, so re-running never
 * duplicates records. Safe to run against the demo workspace on the live API.
 *
 * Usage:
 *   COGNIVERN_TOKEN=<jwt> \
 *   COGNIVERN_BASE_URL=https://api.cognivern.persidian.com \
 *   pnpm demo:seed
 *
 * The token comes from `POST /auth/login` (email) or `/auth/verify` (SIWE) —
 * see docs/TESTER_GUIDE.md.
 */

const BASE_URL = (process.env.COGNIVERN_BASE_URL || "https://api.cognivern.persidian.com").replace(/\/$/, "");
const TOKEN = process.env.COGNIVERN_TOKEN;
const MANDATE_NAME = "Hack Hydra Demo — Lead Verification";

if (!TOKEN) {
  console.error("COGNIVERN_TOKEN is required — log in first, then pass the JWT.");
  process.exit(1);
}

async function api(
  path: string,
  opts: { method?: string; body?: unknown; idemKey?: string } = {},
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
  if (opts.idemKey) headers["Idempotency-Key"] = opts.idemKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.success === false) {
    const detail = json.details ? ` — ${JSON.stringify(json.details)}` : "";
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${json.error || json.raw || "unknown error"}${detail}`);
  }
  return json;
}

async function main(): Promise<void> {
  console.log(`Seeding against ${BASE_URL}\n`);

  // ── 1. Mandate (reuse if present) ────────────────────────────────────────
  const existing = await api("/api/mandates");
  let mandate = (existing.data || []).find((m: { name: string }) => m.name === MANDATE_NAME);

  if (!mandate) {
    console.log("→ Creating funded mandate …");
    const created = await api("/api/mandates", {
      method: "POST",
      idemKey: "demo-seed-mandate-lead-verification",
      body: {
        name: MANDATE_NAME,
        objective:
          "Verify 50 qualified leads from the CRM and record evidence-backed outcomes, demonstrating cross-source retrieval for the funded-mandate evaluation loop.",
        status: "active",
        budget: {
          byAsset: {
            USDC: {
              authorizedAmount: "5000",
              allocatedAmount: "5000",
              consumedAmount: "1250",
              pendingAmount: "3750",
            },
          },
        },
        successMetrics: [
          { id: "leads-verified", name: "Verified leads", unit: "leads", target: "50" },
          { id: "engagement-rate", name: "Lead engagement rate", unit: "percent", target: "20" },
        ],
        measurementWindow: {
          startsAt: "2026-08-01T00:00:00Z",
          endsAt: "2026-09-01T00:00:00Z",
        },
      },
    });
    mandate = created.data;
    console.log(`  ✓ created ${mandate.id} — ${mandate.name}`);
  } else {
    console.log(`→ Reusing existing mandate ${mandate.id} — ${mandate.name}`);
  }
  const mandateId = mandate.id;

  // ── 2. Outcome observations (evidence-backed) ────────────────────────────
  const outcomes = [
    {
      idemKey: "demo-seed-outcome-1",
      body: {
        kind: "verified_external_state",
        value: "12",
        unit: "leads",
        observedAt: "2026-08-14T12:00:00Z",
        source: "CRM verified",
        confidence: "independently_verified",
        evidence: [{ type: "external_record", reference: "crm://demo/lead-batch-3" }],
      },
    },
    {
      idemKey: "demo-seed-outcome-2",
      body: {
        kind: "verified_external_state",
        value: "18",
        unit: "leads",
        observedAt: "2026-08-12T09:00:00Z",
        source: "CRM verified",
        confidence: "independently_verified",
        evidence: [{ type: "external_record", reference: "crm://demo/lead-batch-2" }],
      },
    },
    {
      idemKey: "demo-seed-outcome-3",
      body: {
        kind: "observed",
        value: "9",
        unit: "leads",
        observedAt: "2026-08-10T14:30:00Z",
        source: "CRM verified",
        confidence: "system_observed",
        evidence: [{ type: "external_record", reference: "crm://demo/lead-batch-1" }],
      },
    },
  ];

  console.log("→ Recording outcome observations …");
  for (const outcome of outcomes) {
    await api(`/api/mandates/${mandateId}/outcomes`, {
      method: "POST",
      idemKey: outcome.idemKey,
      body: outcome.body,
    });
  }
  console.log(`  ✓ ${outcomes.length} outcomes recorded (idempotent — safe to re-run)`);

  // ── 3. Governance checks (fills Audit with approved/held/denied) ─────────
  const agents = await api("/api/agents");
  const agentId =
    (agents.data && agents.data.length > 0 && agents.data[0].id) || "agent-alpha-001";
  console.log(`→ Running governance checks (agent: ${agentId}) …`);

  const checks = [
    { amount: 50, expect: "approved" },
    { amount: 500, expect: "held" },
    { amount: 5000, expect: "denied" },
  ];
  for (const check of checks) {
    const res = await api("/api/governance/evaluate", {
      method: "POST",
      body: {
        agentId,
        action: {
          type: "swap",
          description: `Demo ${check.expect} check — $${check.amount} swap`,
          amount: check.amount,
          currency: "USDC",
        },
      },
    });
    const decision = res.data?.decision || res.data?.status || "unknown";
    console.log(`  • $${check.amount} → ${decision} (expected ${check.expect})`);
  }

  // ── 4. Force a HydraDB sync + verify live context ────────────────────────
  console.log("→ Syncing mandate context to HydraDB …");
  const sync = await api(`/api/mandates/${mandateId}/context/sync`, { method: "POST" });
  const syncData = sync.data || {};
  console.log(`  ✓ syncStatus: ${syncData.syncStatus} | enabled: ${syncData.enabled}`);
  if (syncData.ingested) {
    console.log(`    ingested: ${JSON.stringify(syncData.ingested)}`);
  }

  console.log("→ Fetching evidence context (live HydraDB retrieval) …");
  const context = await api(`/api/mandates/${mandateId}/context`);
  const ctx = context.data || {};
  console.log(`  ✓ syncStatus: ${ctx.syncStatus} | chunks: ${(ctx.chunks || []).length} | sources: ${(ctx.sources || []).length}`);

  const health = await api("/api/mandates/context/sync-health");
  console.log(`\nSync health: ${JSON.stringify(health.data)}`);
  console.log(`\nDone. Mandate: ${mandateId}\nOpen the Capital page and filter by "${MANDATE_NAME}".`);
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
