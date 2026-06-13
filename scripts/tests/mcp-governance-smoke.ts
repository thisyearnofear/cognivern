/**
 * MCP Governance Tool Smoke Test
 *
 * Validates the MCP-compliant governance-check endpoint:
 *   1. Tool discovery (GET manifest)
 *   2. Basic governance evaluation
 *   3. Healthcare-aware evaluation with FHIR context
 *   4. Response schema compliance
 *
 * Usage: COGNIVERN_URL=https://... COGNIVERN_API_KEY=... npx tsx scripts/tests/mcp-governance-smoke.ts
 */

const BASE = process.env.COGNIVERN_URL || "http://localhost:8787";
const API_KEY = process.env.COGNIVERN_API_KEY || "development-api-key";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

async function step(n: number, title: string, fn: () => Promise<void>) {
  console.log(`\n--- Step ${n}: ${title} ---`);
  try {
    await fn();
  } catch (err) {
    failed++;
    console.error(`  FAIL  Step ${n} threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// --- Step 1: Tool Discovery ---
await step(1, "Tool discovery (GET manifest)", async () => {
  const res = await fetch(`${BASE}/api/mcp/governance-check`, { headers });
  assert(res.ok, `GET /api/mcp/governance-check returns ${res.status}`);

  const json = await res.json();
  assert(json.success === true, "Response success=true");
  assert(!!json.data, "Response has data");

  const manifest = json.data;
  assert(manifest.name === "governance-check", `Tool name is "governance-check" (got: ${manifest.name})`);
  assert(manifest.schema_version === "v1", "Schema version is v1");
  assert(!!manifest.input_schema, "Manifest has input_schema");
  assert(!!manifest.output_schema, "Manifest has output_schema");
  assert(
    Array.isArray(manifest.input_schema.required) &&
      manifest.input_schema.required.includes("agentId"),
    "input_schema requires agentId",
  );
  assert(
    Array.isArray(manifest.input_schema.required) &&
      manifest.input_schema.required.includes("action"),
    "input_schema requires action",
  );
  assert(
    !!manifest.input_schema.properties.fhirContext,
    "input_schema includes optional fhirContext",
  );
});

// --- Step 2: Basic Governance Evaluation ---
await step(2, "Basic governance evaluation", async () => {
  const res = await fetch(`${BASE}/api/mcp/governance-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agentId: "mcp-smoke-test",
      action: {
        type: "spend",
        description: "MCP smoke test: 50 USDC API credits",
        amount: 50,
        currency: "USDC",
      },
    }),
  });
  assert(res.ok, `POST /api/mcp/governance-check returns ${res.status}`);

  const json = await res.json();
  assert(json.success === true, "Response success=true");
  assert(!!json.data, "Response has data");

  const data = json.data;
  assert(data.tool === "governance-check", `Tool field matches (got: ${data.tool})`);
  assert(typeof data.callId === "string" && data.callId.length > 0, "callId is non-empty string");
  assert(typeof data.allowed === "boolean", "allowed is boolean");
  assert(Array.isArray(data.policyChecks), "policyChecks is array");
  assert(typeof data.timestamp === "string", "timestamp is ISO string");
  assert(typeof data.provider === "string", "provider is string");
  assert(typeof data.model === "string", "model is string");
});

// --- Step 3: Healthcare FHIR Context ---
await step(3, "Healthcare-aware evaluation with FHIR context", async () => {
  const res = await fetch(`${BASE}/api/mcp/governance-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agentId: "healthcare-smoke-test",
      action: {
        type: "medication_request",
        description: "Prescribe Amoxicillin 500mg",
        amount: 0,
        currency: "USD",
      },
      fhirContext: {
        subject: {
          resourceType: "Patient",
          id: "patient-123",
          display: "Jane Doe",
        },
        requester: {
          resourceType: "Practitioner",
          id: "practitioner-456",
          display: "Dr. Smith",
        },
        eventTime: new Date().toISOString(),
        sensitivityLabels: ["MH"],
      },
    }),
  });
  assert(res.ok, `POST with FHIR context returns ${res.status}`);

  const json = await res.json();
  assert(json.success === true, "FHIR evaluation success=true");
  assert(typeof json.data.allowed === "boolean", "FHIR response has allowed field");
  assert(Array.isArray(json.data.policyChecks), "FHIR response has policyChecks");
});

// --- Step 4: Validation — Missing Required Fields ---
await step(4, "Validation: missing required fields", async () => {
  const res = await fetch(`${BASE}/api/mcp/governance-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: { type: "spend", description: "test" },
    }),
  });
  const json = await res.json();
  assert(res.status === 400, `Returns 400 for missing agentId (got: ${res.status})`);
  assert(json.success === false, "Error response success=false");
});

// --- Step 5: A2A Trace ID Pass-through ---
await step(5, "A2A trace ID correlation", async () => {
  const traceId = `a2a-trace-${Date.now()}`;
  const res = await fetch(`${BASE}/api/mcp/governance-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agentId: "a2a-smoke-test",
      action: { type: "query", description: "A2A correlation test" },
      a2aTraceId: traceId,
    }),
  });
  const json = await res.json();
  assert(json.success === true, "A2A request succeeds");
  assert(
    json.data.a2aTraceId === traceId,
    `A2A traceId echoed back (got: ${json.data.a2aTraceId})`,
  );
});

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`MCP Governance Smoke Test: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(40)}`);
if (failed > 0) process.exit(1);
