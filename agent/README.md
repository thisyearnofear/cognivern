# Cognivern Copilot — Agent (Gemini 3.1 + MongoDB MCP)

This directory contains the **Cognivern Copilot** agent submitted to the
Google Cloud **"Building Agents for Real-World Challenges"** hackathon on
the **MongoDB partner track**.

The agent solves one real-world problem: AI agents are now spending real
money on behalf of humans, but humans have no consistent way to **see,
simulate, approve, and audit** those spends. Cognivern Copilot makes
autonomous spend safe by enforcing a strict multi-step protocol —
**PLAN → EVIDENCE → PREVIEW → CONFIRM → EXECUTE → AUDIT** — on top of
Gemini 3.1's reasoning and the MongoDB MCP server for persistent memory.

## What judges will see

- **Gemini 3.1** is the reasoning brain (`gemini-3.1-pro-preview`).
- **Google Cloud Agent Builder** hosts the agent. The full import spec
  is in [`agent-builder.yaml`](./agent-builder.yaml).
- **MongoDB MCP server** (`@mongodb-js/mongodb-mcp-server`) provides
  agent memory, audit history, vendor reputation, and the run ledger
  via the `mongodb_*` tools.
- **Cognivern governance API** is the policy engine, registered as an
  OpenAPI tool. It handles preview/execute, policy evaluation, and
  audit trails.
- **Human-in-the-loop** is enforced before any real spend.

## Files

| File | Purpose |
|---|---|
| [`agent.ts`](./agent.ts) | Runtime — Gemini 3.1 function-calling loop with the multi-step protocol. CLI entry. |
| [`instructions.md`](./instructions.md) | System prompt (the agent's mission + behavioral rules). |
| [`agent-builder.yaml`](./agent-builder.yaml) | Agent Builder import spec (model, tools, HITL, observability). |
| [`tools/cognivern.ts`](./tools/cognivern.ts) | Cognivern governance API tool declarations + HTTP executor. |
| [`tools/mongodb.ts`](./tools/mongodb.ts) | MongoDB MCP tool declarations + stdio/driver executor. |
| [`tools/index.ts`](./tools/index.ts) | Tool registry. |
| [`smoke-test.ts`](./smoke-test.ts) | End-to-end smoke test that verifies the multi-step protocol. |

## Run locally

```bash
# Install (one-time)
pnpm add -D tsx

# Set env for Google Cloud Vertex AI auth
export GOOGLE_CLOUD_PROJECT=cognivern
export VERTEX_LOCATION=global
export COGNIVERN_API_KEY=development-api-key        # or a real key
export COGNIVERN_BASE_URL=https://cognivern.thisyearnofear.com
export MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
export MONGODB_DB_NAME=cognivern
export GEMINI_MODEL=gemini-3.1-pro-preview

# Smoke test (preview-only, verifies the multi-step protocol)
pnpm tsx agent/smoke-test.ts

# Interactive (asks the human to confirm at the execute step)
pnpm tsx agent/agent.ts "Pay 100 USDC to vendor 0xABC for API credits, only if their last audit was clean."
```

## Deploy to Google Cloud Agent Builder

There are three paths, in increasing order of effort:

### Path A — Console import (fastest)

1. Open the [Agent Builder console](https://console.cloud.google.com/gen-app-builder/engines).
2. **Create Application → Import from YAML** → paste the contents of
   `agent-builder.yaml`.
3. Create the required secrets in Secret Manager:
   - `cognivern-api-key` → your `COGNIVERN_API_KEY`
   - `mongodb-uri` → your `MONGODB_URI`
4. Deploy. Agent Builder will fetch the Cognivern OpenAPI spec and
   spawn the MongoDB MCP server as a sidecar.

### Path B — gcloud CLI

```bash
gcloud beta agents applications create cognivern-copilot \
  --location=us-central1 \
  --source=./agent \
  --model=gemini-3.1-pro-preview
```

### Path C — ADK on Agent Engine (most flexible)

```python
# In a separate Python repo (ADK is Python-first):
from google.adk.agents import Agent
from google.adk.tools import MCPToolset, OpenAPIToolset

agent = Agent(
    name="cognivern_copilot",
    model="gemini-3.1-pro-preview",
    instruction=open("./agent/instructions.md").read(),
    tools=[
        OpenAPIToolset(spec_url="https://cognivern.thisyearnofear.com/api/docs/openapi.json"),
        MCPToolset(command="npx", args=["-y", "@mongodb-js/mongodb-mcp-server@latest"]),
    ],
)
```

The TypeScript runtime in `agent.ts` is functionally identical to the
ADK version above — they use the same Gemini 3.1 model, the same tool
declarations, and the same multi-step protocol. Pick whichever fits the
judge's preferred language.

## MongoDB Atlas setup

The agent expects four collections in the `cognivern` database.
Provision them by running the seed script in the parent repo:

```bash
pnpm tsx scripts/db/seed-hackathon.ts
```

Collections seeded:

- `agent_memory` — short/long-term memories and reasoning traces
- `audit_logs` — every policy decision (one per spend / action)
- `vendor_reputation` — trust score, prior incidents, ChainGPT refs
- `cre_runs` — run ledger (intent → actions → outcomes)

Free tier (M0) is plenty for a hackathon demo. Judges will likely
poke at the data, so make the cluster publicly readable from the
Cognivern backend IP.

## Demo script (3 min)

1. **0:00–0:30** — Problem statement. Show an agent about to spend
   $500 on an unverified contract.
2. **0:30–1:00** — Cognivern Copilot enters. Goal: "Pay 100 USDC to
   vendor 0xABC if their last audit was clean."
3. **1:00–1:45** — Watch the agent:
   - list policies → get policy
   - recall memory from MongoDB → check vendor reputation
   - preview the spend → show the decision
4. **1:45–2:30** — Operator approves in the UI. Agent executes. Audit
   entry appears in the audit page and in MongoDB.
5. **2:30–3:00** — Replay the same goal with a *bad* vendor. Show the
   preview returns `denied`, no execute happens, and the audit log
   shows why.

## Why this wins the MongoDB bucket

The MongoDB MCP server is not bolted on — it's load-bearing:

- **Memory recall** is what lets the agent answer "have we worked
  with this vendor before?" without hallucinating.
- **Audit history** is the only way the operator can prove (to a
  regulator, a customer, or themselves) that a given spend was
  governed correctly.
- **Vendor reputation** is a MongoDB-only collection that the
  Cognivern API doesn't expose. Without it, the agent would have to
  blindly trust the vendor list.
- **Run ledger** is the bridge between the agent and the on-chain
  evidence (X Layer, Filecoin, 0G) that Cognivern already anchors.

Remove MongoDB and the agent is a chatbot. Keep it and the agent is
auditable, recallable, and trustworthy.
