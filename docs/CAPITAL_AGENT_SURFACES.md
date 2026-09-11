# Capital UI + Agent Surfaces Plan

Status: **adopted 2026-09-11**. Complements `OUTCOME_EVIDENCE_PLAN.md`
(dogfood → first verified statement) and `LANGFUSE_LESSONS.md` (adjacency).
Goal: the funded-mandate loop is fully intuitive for humans in the Capital
UI, and the same operations are agent-readable without DOM scraping.

## Why

Operators should not need curl to attach a GitHub/Langfuse outcome source,
sync verified outcomes, or publish a statement. Agents (Telegraph / 0G
inference experimenters, browser agents, headless tools) should call the
same contracts we expose to the UI.

## Four surfaces, one domain layer

| Surface | Who | Role |
|---------|-----|------|
| **Capital UI** | Human operators | Full mandate loop, no API required |
| **REST + API keys** | Scripts / external agents | Automation, spend attribution |
| **Server MCP** (exists) | Headless agents | `/api/mcp/governance-check` today; expand for mandate ops |
| **WebMCP** (new) | In-browser agents | Same Capital actions via `document.modelContext` tools |

Domain operations (implement once; adapters stay thin):

```text
createMandate / updateMandate
setOutcomeSources          # github | langfuse
syncOutcomes               # POST …/outcomes/sync
listOutcomes / getRecommendation
previewStatement / publishStatement / exportStatement
```

Rail-agnostic rule still applies (`ARCHITECTURE_RAILS.md`,
`LANGFUSE_LESSONS.md` §4): adapters silent in product; partnerships loud
outside it. WebMCP tools describe **mandate / policy / outcome** verbs, not
“Telegraph” or “0G” product identity.

## Milestone A — Capital UI completeness (ship first)

Unblocks dogfood without waiting on Chrome WebMCP.

**Gap today:** Capital already supports create mandate, spend/outcomes list,
context → recommendation → statement preview → publish → export. Missing:

- Edit `outcomeSources` on a mandate (GitHub commit/PR + Langfuse scores/traces)
- Operator **Sync outcomes** button → existing
  `POST /api/mandates/:mandateId/outcomes/sync`
- Clear empty states when sources exist but sync has not run / no samples yet

**Acceptance**

- An operator can, only from the UI: create mandate → add GitHub source →
  Sync → see `independently_verified` outcomes → publish + export statement.
- Langfuse source attach + sync works the same path (`system_observed`).
- No secrets in the mandate payload (`GITHUB_TOKEN` / `LANGFUSE_*` stay env).

## Milestone B — WebMCP on Capital (feature-detected)

[WebMCP](https://webmachinelearning.github.io/webmcp/) (W3C WebML draft;
Chrome origin trial) registers page tools for browser agents:

- API: `document.modelContext.registerTool({ name, description, inputSchema, execute })`
  (prefer current draft; feature-detect; older `navigator.modelContext` is
  legacy).
- Live tab only — not a substitute for server MCP; not headless.
- Mutating tools require user confirmation; read tools may use `readOnlyHint`.
- Untrusted external payloads (e.g. pasted URLs) should carry
  `untrustedContentHint` where the draft expects it.

**Register on `/capital` (and related mandate views) the same domain ops as
Milestone A**, calling existing `apiClient` methods. Degrade gracefully when
`document.modelContext` is absent — human UI remains the fallback.

**Acceptance**

- With WebMCP testing enabled, an in-browser agent can list tools and invoke
  read-only mandate/statement tools; mutating tools prompt the user.
- Without WebMCP, Capital UI is unchanged.

## Milestone C — Expand server MCP (parallel, headless)

Keep `/api/mcp/governance-check` as the governance primitive. Add discovery
+ tools for mandate list/get, outcome sync, statement preview/export so
agents that never open the dashboard (Telegraph/0G experimenters with API
keys) share the same loop. Do not fork business logic into MCP handlers.

## Sequencing

```text
A (Capital outcome sources + Sync UI)
  ──→ dogfood Telegraph/0G sprint mandate → first published statement
    ──→ B (WebMCP tools on Capital, feature-detected)
Parallel: C (server MCP mandate tools for headless agents)
```

A before B. Do not block the verified-statement dogfood on WebMCP
standardization or Chrome origin-trial access.

## Explicitly out of scope

- Replacing server MCP with WebMCP (different runtimes).
- Building a Cognivern “agent browser” product.
- Prompt/eval playgrounds (Langfuse owns that surface).
- Baking rail brands into tool names or Capital chrome.
