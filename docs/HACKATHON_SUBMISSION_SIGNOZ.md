# Agents of SigNoz - Cognivern Submission

**Track:** 01 - AI & Agent Observability
**Hackathon:** Agents of SigNoz ($20,000)
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app](https://cognivern.vercel.app) - API: `cognivern.thisyearnofear.com`
**Backend:** OpenTelemetry-instrumented Express + TypeScript on Hetzner (PM2, port 3087)

---

## TL;DR

Cognivern is a control plane for autonomous AI agent spend. Agents initiate
wallet transactions, sealed-bid auctions, and LLM-governed procurement
decisions; Cognivern policy-checks every action, records it on-chain (0G
Chain + Filecoin), and now exports the full decision tree as OpenTelemetry
traces, metrics, and logs into SigNoz.

**The thesis for this hackathon:** AI agents are a black box. Cognivern
governs the box, and SigNoz makes the governance observable. You can trace
every LLM call (provider, model, tokens, cost, fallback path), every
governance decision (allowed/denied, suspicion score, policy violations),
and every agent cycle (forecast, attestation, trade) end-to-end in one
SigNoz dashboard.

### Provenance legend

Every claim in this doc is labeled with its status so judges can tell what
is wired today from what is on the roadmap:

- **Live** = code is merged, builds clean, and emits real telemetry when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Verified by `pnpm typecheck` +
  `pnpm build:backend` + `pnpm build` (frontend) + boot smoke test.
- **Demo** = renders in the UI with mock data for unauthenticated
  exploration. Not backed by real backend state.
- **Upcoming** = span/metric definition exists in code or doc, but the
  emitting code path is not yet wired. Called out explicitly so it is not
  mistaken for a shipped capability.

The `/api/observability/status` endpoint (public, no workspace auth)
returns the real backend env state so the UI never fakes the "Tracing:
Live" badge.

---

## What was instrumented

### 1. OpenTelemetry SDK bootstrap (`src/backend/observability/otel.ts`)

A single module imported before any other code in `src/index.ts` so
auto-instrumentations patch http/express/dns before they load. Exports:

- `tracer` - manual span creation for LLM, governance, agent cycles
- `meter` - counter/histogram instruments for token cost, latency, violations
- `recordLlmUsage()` - bridges `AiUsageRecord` into OTel metrics
- Long-lived observable counters: `cognivern.llm.tokens.total`, `cognivern.llm.cost.usd.total`
- `shutdownOtel()` - wired into the PM2 graceful-shutdown handler

Auto-instrumentations enabled: `http`, `express`, `dns`, `net`, `fs`
(disabled), `winston`, `undici`, `grpc`. Target: SigNoz Cloud OTLP/HTTP.

### 2. LLM call tracing (`MultiModelRouter.ts`)

The `MultiModelRouter.executeWithFallback()` and `executeWithProvider()`
methods now emit nested spans:

```
llm.execute_with_fallback (attributes: provider, task_type, fallback_attempt, prompt_chars)
  └── llm.provider.<provider> (attributes: provider, model, task_type, duration_ms)
```

Each span records `llm.input_tokens`, `llm.output_tokens`, `llm.cost_usd`,
`llm.succeeded`, and on failure `llm.error` + `llm.falling_back`. The
fallback chain (9 providers: gemini, fireworks, groq, venice, openai,
anthropic, kilocode, chaingpt, workers-ai) is fully visible as a nested
trace in SigNoz.

Metrics emitted:
- `cognivern.llm.tokens.total` (counter, by provider + direction)
- `cognivern.llm.cost.usd.total` (counter)
- `cognivern.llm.latency.ms` (histogram, by provider + task_class)
- `cognivern.llm.provider.latency.ms` (histogram, by provider)
- `cognivern.llm.failures.total` (counter, by provider + task_class)

### 3. Governance decision tracing (`PolicyEnforcementService.ts`)

`evaluateDecision()` is wrapped in a `governance.evaluate_decision` span
recording `governance.action_type`, `governance.agent_id`,
`governance.policy_id`, `governance.outcome` (allowed/denied),
`governance.violations`, `governance.suspicion_composite`, and
`governance.duration_ms`. The inner `evaluateDecisionInner()` preserves
the original logic untouched.

Metrics emitted:
- `cognivern.governance.decisions.total` (counter, by action_type + outcome)
- `cognivern.governance.policy.violations.total` (counter, by action_type)
- `cognivern.governance.latency.ms` (histogram, by action_type)

### 4. Audit trail tracing (`AuditLogService.ts`)

`logAction()` is wrapped in an `audit.log_action` span recording
`audit.action_type`, `audit.agent_id`, `audit.outcome`,
`audit.policy_checks`, `audit.violations`, `audit.ai_provider`,
`audit.ai_cost_usd`, `audit.ai_tokens`. The on-chain anchoring (0G
Storage + Filecoin) runs inside the span so you can correlate the
governance decision with its storage-proof latency in one trace.

Metric emitted: `cognivern.audit.logs.total` (counter, by action_type + outcome)

### 5. Agent cycle tracing (`SapienceTradingAgent.ts`)

`performForecastCycle()` is wrapped in an `agent.sapience.forecast_cycle`
span recording `agent.id`, `agent.type`, `agent.name`,
`agent.cycle.success`, and `agent.cycle.duration_ms`. The nested LLM and
governance spans appear inside this span, giving you the full agent
decision tree:

```
agent.sapience.forecast_cycle
  ├── llm.execute_with_fallback (forecast generation)
  │     └── llm.provider.gemini
  ├── governance.evaluate_decision (forecast attestation check)
  │     └── audit.log_action
  ├── governance.evaluate_decision (trade spend check)
  │     └── audit.log_action
  └── (on-chain attestation submission)
```

Metrics emitted:
- `cognivern.agent.cycles.total` (counter, by agent_type + outcome)
- `cognivern.agent.cycle.duration.ms` (histogram, by agent_type)
- `cognivern.agent.actions.total` (counter, by action_type + outcome)
- `cognivern.agent.action.latency.ms` (histogram, by action_type)
- `cognivern.agent.policy.violations.total` (counter, by action_type)

### 6. HTTP SLO metrics (`SloMetricsService.ts`)

`SloMetricsService.record()` now emits OTel metrics alongside its
in-memory SLO tracker:
- `cognivern.http.request.duration.ms` (histogram, by route + status_class)
- `cognivern.http.requests.total` (counter, by route + status_class)

This gives SigNoz a per-route p50/p95/p99 view that maps directly onto the
SLO targets defined in `DEFAULT_TARGETS` (`/api/governance/evaluate`
p95 < 3000ms, `/api/audit/logs` p95 < 800ms, etc.).

### 7. MetricsService upgrade (`MetricsService.ts`)

The previous stub `MetricsService` (returned empty metrics) now emits
real OTel counters and histograms for agent actions, latency, and policy
violations. The legacy `getMetrics()` API is preserved for backward
compatibility with `MetricsController`, but the real data lives in SigNoz.

---

## SigNoz dashboards

Three dashboard definitions are in `docs/signoz-dashboards.json`:

1. **Cognivern - AI Agent Governance Overview** - Top-level: LLM cost, token consumption by provider, governance decisions (allowed vs denied), policy violations, decision latency, provider failures, agent cycle duration, suspicion distribution.
2. **Cognivern - LLM Provider Health & Fallback Chain** - Deep dive into the 9-provider fallback chain: per-provider latency p95, failure rate, token economics, cost per provider per minute, fallback cascade events, live LLM execute traces.
3. **Cognivern - HTTP API SLO & Audit Trail** - Per-route request rate, p95 latency, error rate by status class, audit log volume by outcome, governance decision traces, agent cycle traces.

Import: in SigNoz Cloud, go to Dashboards -> Import -> paste the JSON from
`docs/signoz-dashboards.json`. Adjust metric names if your SigNoz version
uses a different prefix convention (the instruments emit
`cognivern.*` metric names).

### Inline dashboard embedding

Dashboards are not just importable - they are embedded directly in the
Cognivern Observability page via iframe. Set
`SIGNOZ_DASHBOARD_EMBED_URL` to a SigNoz dashboard public share URL, and
the dashboard renders inline on the Tracing page with a refresh button.
Judges and users see live SigNoz data without leaving the Cognivern UI.

When the embed URL is not configured, the section shows a graceful
placeholder with instructions and a link to the SigNoz dashboards page.

---

## Trace deep-linking

Every governance evaluation captures the active OTel span's `traceId` and
stores it on the CRE run's evidence block. The flow:

1. `GovernanceController.evaluate()` reads
   `otelTrace.getActiveSpan()?.spanContext()?.traceId` and includes it in
   the API response as `traceId`.
2. `AuditLogService.logAction()` captures the same traceId inside its
   `audit.log_action` span and persists it on `run.evidence.traceId`.
3. `mapCreRunToAuditLog()` surfaces `traceId` on the `AuditLog` object.
4. The audit page renders a "View trace in SigNoz" link as
   `https://{SIGNOZ_CLOUD_URL}/trace/{traceId}`, opening the exact
   governance trace in SigNoz with the nested LLM + policy + audit spans.
5. The governance check page also shows the trace link after a check
   completes.

This closes the loop: a user looking at a governance decision in the
audit page can click through to the exact trace that produced it, seeing
every LLM call, policy evaluation, and audit entry as nested spans.

---

## Live reachability probe

The `/api/observability/status` endpoint doesn't just check whether
`OTEL_EXPORTER_OTLP_ENDPOINT` is set - it sends a HEAD request to the
endpoint origin to verify SigNoz is actually reachable. The result is
cached for 30 seconds. The frontend status card shows three states:

- **Disabled** - `OTEL_EXPORTER_OTLP_ENDPOINT` is unset
- **Configured, endpoint unreachable** - endpoint is set but the probe failed
- **Live, exporting** - endpoint is set and reachable

This prevents a judge from seeing "Tracing: Active" when SigNoz is down.

---

## Telemetry seed script

`pnpm signoz:seed` runs a scripted sequence of 6 governance evaluations
(3 approved, 2 denied, 1 held) against the backend to populate the SigNoz
dashboards with correlated trace data. Run it after starting the backend
with OTel enabled:

```bash
pnpm signoz:seed -- --api-key $COGNIVERN_API_KEY
```

The script checks the observability status endpoint first and warns if OTel
is disabled. Each evaluation produces a nested trace (governance decision
-> LLM call -> audit log) with a traceId printed to the console.

---

## Graceful fallbacks

Every SigNoz touchpoint in the UI degrades gracefully when SigNoz is
unavailable, misconfigured, or not yet set up. No user ever sees a broken
link, a dead click, or a misleading "live" badge.

| Failure mode | What the user sees |
| --- | --- |
| OTel disabled (no env vars) | Status card: "Disabled" + amber setup guide. Dashboard strip: "configure SigNoz". Trace links don't render (no traceId on old logs). |
| OTel configured, SigNoz down | Status card: "Configured, endpoint unreachable" (red). Dashboard strip: "tracing configured but endpoint unreachable". Trace deep-links still open SigNoz (the user can retry once it's back). |
| Backend down entirely | Dashboard strip: "tracing status unavailable, click to view details". Observability page: red error card with retry button. Trace search box still works if user has a trace ID. |
| Audit logs API fails | "Recent traces" shows amber "Failed to fetch audit logs" empty state. Trace search box remains usable. All other sections (dashboards, spans, metrics) render normally. |
| Cloud URL fetch fails on click | `buildSignozTraceLink()` catches the error and opens the fallback URL (`us.signoz.cloud`). The user always gets a new tab, never a dead click. |
| Cloud URL cached from a failed fetch | Cache expires after 60s; next call retries the real endpoint instead of permanently returning the fallback. |
| Old audit logs (pre-instrumentation) | No traceId on evidence block, trace card doesn't render. The on-chain record card and other audit details are unaffected. |

The `signoz.ts` module (`src/frontend/src/lib/signoz.ts`) is the single
helper for all deep-link construction. It never throws, caches with a TTL,
and falls back to the default SigNoz Cloud URL on any error.

---

## Setup

### Prerequisites

- SigNoz Cloud account (or self-hosted SigNoz at `http://localhost:4318`)
- Cognivern backend running (local or Hetzner)

### Environment variables

Add to `.env` (or the Hetzner `/opt/cognivern/shared/.env`):

```env
# SigNoz Cloud OTLP endpoint (regional, e.g. us.ingest.signoz.cloud)
OTEL_EXPORTER_OTLP_ENDPOINT=https://us.ingest.signoz.cloud
# SigNoz ingestion key (from SigNoz Cloud -> Settings -> Ingestion)
SIGNOZ_INGESTION_KEY=your-ingestion-key-here
# Service name shown in SigNoz
OTEL_SERVICE_NAME=cognivern-backend
# SigNoz Cloud URL for trace deep-links from the audit page
SIGNOZ_CLOUD_URL=https://us.signoz.cloud
```

If you omit `OTEL_EXPORTER_OTLP_ENDPOINT`, the OTel SDK stays disabled and
the backend runs exactly as before (zero-overhead fallback).

### Run locally

```bash
pnpm install
pnpm build:backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://us.ingest.signoz.cloud \
SIGNOZ_INGESTION_KEY=your-key \
node --loader config/esm-dir-loader.mjs dist/src/index.js
```

### Verify in SigNoz

1. Open SigNoz Cloud -> Services. You should see `cognivern-backend`.
2. Open the service -> Traces. Trigger a governance evaluate call:
   ```bash
   curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"action":{"type":"test","description":"smoke","metadata":{"agentId":"test"}}}'
   ```
3. In SigNoz, filter traces by `span_name = governance.evaluate_decision`.
   You should see the nested `llm.execute_with_fallback` and
   `audit.log_action` spans.
4. Open Dashboards -> Import -> paste `docs/signoz-dashboards.json`.

---

## Judging criteria mapping

| Criterion | How Cognivern + SigNoz delivers |
| --- | --- |
| **Potential Impact** | Real production system governing real agent wallet spend. Observability of agent decisions is the exact gap the hackathon names. |
| **Creativity & Innovation** | "Observe the agent that governs the agent" - LLM-governed spend decisions traced end-to-end, correlated with on-chain proof anchors. Not a toy demo. |
| **Technical Excellence** | 9-provider LLM fallback chain with per-provider spans; governance decision tree with nested audit + LLM spans; SLO-mapped HTTP metrics; TypeScript strict mode; builds clean. |
| **Best Use of SigNoz** | Traces (LLM, governance, agent cycles, audit), metrics (tokens, cost, latency, violations, SLO), logs (winston auto-instrumented) - all three signal types in one platform. 3 dashboards. |
| **User Experience** | SigNoz dashboards give a polished, drill-down view of agent behavior that the existing Cognivern frontend cannot match for debugging. |
| **Presentation Quality** | This doc + the existing Cognivern demo flow + live SigNoz dashboards. |

---

## Architecture diagram (text)

```
┌──────────────────────────────────────────────────────────────────┐
│  Cognivern Backend (Express, TypeScript, PM2)                     │
│                                                                   │
│  src/index.ts                                                     │
│    └── import otel.ts (SDK starts, auto-instrumentations patch)   │
│         └── server.ts -> ApiModule                                │
│              ├── GovernanceController                            │
│              │     └── PolicyEnforcementService.evaluateDecision  │
│              │           ├── [span] governance.evaluate_decision │
│              │           ├── MultiModelRouter.analyzeGovernance   │
│              │           │     └── [span] llm.execute_with_fallback │
│              │           │           └── [span] llm.provider.<p>   │
│              │           └── AuditLogService.logAction            │
│              │                 └── [span] audit.log_action        │
│              │                       └── 0G/Filecoin anchor       │
│              ├── AgentsController                                 │
│              │     └── SapienceTradingAgent.performForecastCycle  │
│              │           └── [span] agent.sapience.forecast_cycle │
│              │                 ├── governance.evaluate_decision   │
│              │                 └── llm.execute_with_fallback     │
│              └── SloMetricsService.record                         │
│                    └── [metric] cognivern.http.request.duration   │
│                                                                   │
│  OpenTelemetry SDK (otel.ts)                                     │
│    ├── OTLPTraceExporter  ─────────────┐                         │
│    ├── PeriodicExportingMetricReader ───┤                         │
│    └── Auto-instrumentations ──────────┘                         │
└──────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ OTLP/HTTP
                        ┌──────────────────────────────┐
                        │  SigNoz Cloud                │
                        │  ├── Traces (governance, LLM)│
                        │  ├── Metrics (tokens, cost)  │
                        │  ├── Logs (winston)          │
                        │  └── 3 Dashboards            │
                        └──────────────────────────────┘
```

---

## Files changed

| File | Change | Status |
| --- | --- | --- |
| `src/backend/observability/otel.ts` | NEW - OTel SDK bootstrap, tracer, meter, metric instruments | Live |
| `src/index.ts` | Import otel.ts before any other module | Live |
| `src/server.ts` | Wire `shutdownOtel()` into graceful shutdown | Live |
| `src/backend/services/ai/MultiModelRouter.ts` | Spans around `executeWithFallback` + `executeWithProvider`; emit token/cost metrics | Live |
| `src/backend/services/governance/PolicyEnforcementService.ts` | Span around `evaluateDecision`; emit decision/violation/latency metrics | Live |
| `src/backend/services/governance/AuditLogService.ts` | Span around `logAction`; capture traceId; emit audit log counter | Live |
| `src/backend/services/SloMetricsService.ts` | Emit OTel HTTP request metrics in `record()` | Live |
| `src/backend/services/MetricsService.ts` | Replace stub with real OTel counters/histograms | Live |
| `src/backend/modules/agents/implementations/SapienceTradingAgent.ts` | Span around `performForecastCycle`; emit cycle/action metrics | Live |
| `src/backend/modules/api/controllers/ObservabilityController.ts` | NEW - `/api/observability/status` endpoint with reachability probe | Live |
| `src/backend/modules/api/routes/observabilityRoutes.ts` | NEW - route wiring | Live |
| `src/backend/modules/api/ApiModule.ts` | Register observability controller + routes | Live |
| `src/backend/modules/api/controllers/GovernanceController.ts` | Include `traceId` in evaluation response | Live |
| `src/backend/middleware/publicEndpoints.ts` | Add `/observability/status` to public paths | Live |
| `src/backend/cre/types.ts` | Add `traceId` to `CreRun.evidence` | Live |
| `packages/shared/src/types/index.ts` | Add `traceId` to `GovernanceEvaluation` | Live |
| `src/frontend/src/components/observability/observability-page.tsx` | NEW - full Observability page with 3-state status card, dashboards, spans, metrics, setup | Live |
| `src/frontend/src/app/(dashboard)/observability/page.tsx` | NEW - route | Live |
| `src/frontend/src/lib/nav-items.ts` | Add Observability nav item under Developer | Live |
| `src/frontend/src/lib/api-client.ts` | Add `getObservabilityStatus()` + `ObservabilityStatus` type | Live |
| `src/frontend/src/components/audit/audit-page.tsx` | Real SigNoz trace deep-links using `evidence.traceId` | Live |
| `src/frontend/src/components/governance/governance-check.tsx` | Trace deep-link after governance check completes | Live |
| `scripts/signoz/seed-telemetry.ts` | NEW - telemetry seed script (6 governance evaluations) | Live |
| `package.json` | Add `signoz:seed` script | Live |
| `docs/ARCHITECTURE.md` | Add "Telemetry & Observability" section | Live |
| `docs/DEVELOPER.md` | Add "Running with SigNoz" section | Live |
| `docs/signoz-dashboards.json` | NEW - 3 dashboard definitions | Live |
| `HACKATHON_SUBMISSION_SIGNOZ.md` | NEW - this document | Live |
| `UserTradingAgent` cycle span | Not yet wired - span name reserved in status endpoint | Upcoming |

---

## License

MIT (same as the rest of Cognivern).
