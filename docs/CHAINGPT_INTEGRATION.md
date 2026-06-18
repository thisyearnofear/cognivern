# ChainGPT Integration

ChainGPT provides Web3-specialized LLM capabilities for governance analysis and runtime smart contract auditing.

## What It Does

| Capability | Where | Config |
|-----------|-------|--------|
| **Web3 LLM Provider** — Routes Web3-specific queries (sanction checks, calldata decoding, contract analysis) to ChainGPT via `MultiModelRouter` | `src/backend/modules/cloudflare-agents/MultiModelRouter.ts` | `CHAINGPT_API_KEY` |
| **Smart Contract Auditor** — Pre-spend vulnerability scan. Triggered by policy rule type `contract_audit`. Returns approve/hold/deny based on severity (critical=deny, high=deny, medium=hold, low=approve) | `src/backend/services/ChainGPTAuditService.ts` | `CHAINGPT_API_KEY`, `CHAINGPT_AUDIT_TIMEOUT_MS`, `CHAINGPT_AUDIT_CACHE_TTL_MS` |
| **News-driven Policy Auto-Adjustment** — Breaking news from ChainGPT webhooks auto-flips matching policies to hold mode | `src/backend/services/NewsPolicyAdjuster.ts`, `src/backend/modules/api/controllers/WebhookController.ts` | Webhook endpoint: `POST /api/webhooks/chain-gpt-news` |

## Configuration

```env
CHAINGPT_API_KEY=your_api_key_here
CHAINGPT_BASE_URL=https://api.chaingpt.org
CHAINGPT_AUDIT_TIMEOUT_MS=30000
CHAINGPT_AUDIT_CACHE_TTL_MS=300000
```

## Code Layout

- `src/backend/services/ChainGPTAuditService.ts` — Runtime contract auditor, integrates with `PolicyEnforcementService`
- `src/backend/modules/cloudflare-agents/MultiModelRouter.ts` — Provider router with ChainGPT as first Web3 fallback
- `src/backend/services/NewsPolicyAdjuster.ts` — Webhook consumer for real-time policy auto-adjustment

## How It Works

1. An agent submits a spend targeting a contract → `PolicyEnforcementService` evaluates `contract_audit` rule
2. If rules include `contract_audit`, `ChainGPTAuditService.auditContract()` runs a vulnerability scan via ChainGPT API
3. Decision based on severity: **critical** → deny, **high** → deny, **medium** → hold, **low/info** → approve
5. Audit trail records the ChainGPT verdict with score and findings
