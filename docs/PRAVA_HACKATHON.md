# Prava Hackathon — Cognivern x Prava

**Event:** Agents of Commerce — 48 hours. $65,000 in cash + credits.
**Dates:** TBD (applying)
**Track:** Best B2B Agentic Workflow / Best Agentic Payments Product
**RFH:** Give business agents a budget
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Prava:** [docs.prava.com](https://docs.prava.com) · [Developer Dashboard](https://developer.prava.com) · [MCP/CLI](https://github.com/pravapayments)

---

## Pitch to Organizers

Cognivern is a governance control plane for AI agent spending — every agent-initiated transaction passes through our policy engine for evaluation, approval, denial, and audited execution. We already support multi-chain signing, hardware-backed Ledger wallets, real-time suspicion scoring, Slack/PagerDuty alerting, and an SSE event bus for live governance streaming. What's missing is a unified, user-trusted payment rail that works across any merchant — that's Prava.

During the hackathon, we'll build **"Prava as the agent payment execution layer"**: an agent discovers a SaaS tool it needs → Cognivern evaluates the spend against policy (budget, vendor allowlist, risk score) → Prava issues a one-time card with user-set limits → the transaction completes. The user sees a single permission dialog: "Agent wants to spend $X on Y. Approve with Prava budget of $Z?" The agent never holds keys — Cognivern governs, Prava pays. We'll demo this end-to-end with an autonomous agent procuring software subscriptions.

Post-hackathon, this becomes a real product: enterprise teams deploy Cognivern to govern their AI agents, with Prava as the default payment execution provider — spending boundaries that are transparent, revocable, and auditable.

---

## Why Cognivern + Prava

| Cognivern provides | Prava provides | Combined |
|---|---|---|
| Policy evaluation (budget, vendor, risk) | One-time card/wallet issuance | Agent discovers → Cognivern decides → Prava executes |
| Approval/deny/hold workflows | User-set spending limits | Trusted agent spending with user control |
| Audit trail + on-chain evidence | Merchant-agnostic payments | Full auditability from decision to settlement |
| Multi-agent support | MCP/CLI native | Any agent can spend through the same governed pipeline |
| Real-time suspicion scoring | Real-time spend controls | Safety layers at every stage |

---

## Architecture Integration

```
Agent
  |
  | intended spend / sign request
  v
Cognivern Evaluation Layer
  |
  ├── GovernanceController.evaluateAction()
  │   ├── standard rule → WorkspaceDataService.evaluateAction()
  │   │   └── evaluateRule() — amount, daily_total, budget, allowlist
  │   ├── confidential rule → FhenixPolicyService → Fhenix FHE
  │   ├── contract_audit rule → ChainGPTAuditService
  │   └── recordSpend() — updates agent spend history
  │
  ├── [optional] ControlEvaluationService.score()
  │   └── suspicion scoring (0-1)
  │
  +--> approve → NEW: PravaPaymentProvider.dispatch()
  │                 ├── Prava SDK: createPaymentCard({amount, merchant, limits})
  │                 ├── Agent completes purchase with Prava card
  │                 └── AuditLogService.logAction() with Prava payment ref
  +--> hold    → human approves in dashboard → PravaPaymentProvider.dispatch()
  +--> deny    → no payment issued
  |
  v
Cognivern Audit + Run Ledger
  ├── AuditLogService.logAction() — decision + Prava payment ID recorded
  ├── Evidence anchoring (Filecoin / 0G) — dual-anchor audit proof
  └── Event Bus — SSE stream of governance + payment events
```

### SigningProvider Adapter

The existing `SigningProvider` interface already supports swappable backends (Ledger DMK, Speculos, Local, OWS Remote). Add `PravaPaymentProvider` implementing the same interface:

```typescript
interface SigningProvider {
  dispatch(action: SignAction): Promise<SignResult>;
  getStatus(): ProviderStatus;
  getCapabilities(): ProviderCapability[];
}
```

The Prava provider would:
1. Call Prava API to create a one-time card for the specific amount + merchant
2. Return the card details to the agent
3. Poll for transaction completion
4. Log the Prava payment ID in the audit trail

---

## Hackathon Scope

### Pre-existing (existing code, disclosed)

- Full governance pipeline: `GovernanceController`, policy rules, approval workflows
- `SigningProvider` interface + existing implementations (Ledger, Speculos, Local)
- `AuditLogService` with Filecoin + 0G evidence anchoring
- `ControlEvaluationService` — suspicion scoring
- Agent management, workspace, API keys, dashboard
- 31+ Vitest tests, TestSprite suite, CI/CD

### New: Prava-powered workflow (built during hackathon)

1. **`PravaPaymentProvider`** — new `SigningProvider` implementation wrapping Prava SDK
2. **Prava card issuance flow** — `POST /api/governance/evaluate` → approve → Prava card created → returned to agent
3. **Agent procurement demo** — autonomous agent discovers a SaaS subscription, Cognivern evaluates policy, Prava issues card, agent completes purchase
4. **Dashboard integration** — Prava payment status displayed alongside governance decisions
5. **Audit trail enhancement** — Prava payment IDs indexed alongside governance decision IDs
6. **Failure paths** — insufficient Prava budget → agent informed; card expired → fallback flow

### Demo Flow (end-to-end)

1. User sets up a Cognivern workspace with Prava as the payment provider
2. User defines policy: "Agent can spend up to $200/month on SaaS tools"
3. Agent discovers a tool (e.g., "Slack Pro — $85/month")
4. Agent calls `POST /api/governance/evaluate` with the spend request
5. Cognivern evaluates: amount within policy? vendor allowed? suspicion score normal?
6. Approved → Prava issues a one-time card for $85 to Slack
7. Agent completes purchase using the Prava card
8. Audit trail records: decision ID + Prava payment ID + merchant + amount + timestamp
9. Failure path: agent tries $300 tool → Cognivern denies (over budget) → agent informed

---

## Key Design Decisions

### Prava Integration Points

| Integration | Method | Details |
|---|---|---|
| Card creation | Prava SDK/API | `POST /v1/cards` with amount, merchant, expiry |
| Spending limits | Prava API | Set per-card or per-agent limits via Prava |
| Transaction status | Prava API / Webhooks | Poll or receive async status updates |
| MCP server | Prava MCP/CLI | Alternative: wire Cognivern's MCP to Prava's MCP |

### Spending Boundaries Model

```
User sets:  "Agent A can spend $500/month"
Prava maps: Prava wallet with $500 monthly limit
Per-txn:    Cognivern evaluates each spend against remaining budget
            → Prava card issued for exact approved amount
```

### Security Model

- Agent never holds the Prava card — Cognivern issues it per approved transaction
- Card is single-use or time-limited (matching Prava's one-time card model)
- Every card issuance is logged with the governance decision that authorized it
- User can revoke Prava budget at any time via dashboard

---

## Awards Targeting

| Award | Fit | Why |
|---|---|---|
| Best B2B Agentic Workflow | ✅ Strong | Enterprise agent spend governance — solves a real ops problem for agent teams |
| Best Agentic Payments Product | ✅ Strong | Cognivern governs, Prava pays — the combined story is exactly this category |
| Best in Show | ⚠️ Possible | Strong narrative but abstract demo — needs polished demo video |
| Most Startup-Ready | ⚠️ Possible | Clear enterprise SaaS model, existing codebase, real deployments |
| Best OpenAI-Powered Agent | ⚠️ Possible | If we use OpenAI agents in the demo flow |

---

## RFH Alignment

**"Give business agents a budget"** — Primary RFH. Cognivern + Prava lets enterprises give AI agents a real budget with guardrails: policy decides what's allowed, Prava executes the payment, the audit trail records everything.

**Secondary:** "Make subscriptions easier to manage" — agent procurement of SaaS subscriptions is the demo use case.

---

## Post-Hackathon Roadmap

- **Day 1-30:** Ship PravaPaymentProvider as a selectable signing provider in production. Enterprise beta with 3 design partners.
- **Day 30-60:** Prava budget dashboard — users see agent spending by category, set workspace-wide budgets, configure auto-approval rules.
- **Day 60-90:** Multi-agent Prava pools — shared budgets across agent teams with approval workflows for overages.
- **Day 90+:** Prava as default payment provider for new Cognivern workspaces.

---

## References

- [Architecture](./ARCHITECTURE.md) — existing system design
- [Developer Guide](./DEVELOPER.md) — local setup, API reference
- [SigningProvider Interface](../src/backend/signing/providers/) — adapter pattern for payment backends
- [GovernanceController](../src/backend/services/governance/GovernanceController.ts) — evaluation entry point
- [AuditLogService](../src/backend/services/audit/AuditLogService.ts) — evidence logging
- Prava Docs: [docs.prava.com](https://docs.prava.com)
- Prava Dashboard: [developer.prava.com](https://developer.prava.com)
- Prava MCP/CLI: [github.com/pravapayments](https://github.com/pravapayments)
