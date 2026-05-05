# ChainGPT Integration — Web3-Native AI Governance

> **Thesis:** Autonomous agents operating in Web3 need a governance copilot that speaks their language. ChainGPT's Web3-specialized LLM provides contract analysis, sanction checks, and calldata decoding natively — making it the perfect complement to Cognivern's policy engine.

This document describes how Cognivern integrates ChainGPT across three key surfaces:
1. **Web3 LLM Provider** — Governance-aware AI routing for Web3-specific queries
2. **Smart Contract Auditor** — Runtime pre-spend defense (first production use of ChainGPT auditor for runtime, not CI)
3. **AI Crypto News** — Live governance signal for policy auto-adjustment

---

## 1. Layered Architecture (ChainGPT Integration)

| Layer | Chain | Role | Status |
|-------|-------|------|--------|
| Execution & Public Policy Anchoring | X Layer Testnet (1952) | `GovernanceContract`, `AIGovernanceStorage` | **Existing** |
| Live Audit Anchoring | 0G Newton Testnet | Real-time governance decision anchoring | **Existing** |
| Audit Archive | Filecoin Calibration | Long-term immutable audit storage | **Existing** |
| **Web3 AI Governance** | **ChainGPT** | **Web3-specialized LLM for contract analysis, sanction checks, calldata decoding** | **NEW** |
| Confidential Policy State | Fhenix | Encrypted budgets and spend counters | **Existing** |

**Routing pattern:** Cognivern's `MultiModelRouter` routes Web3-specific queries to ChainGPT with governance context injection, while general-purpose queries route to other providers (Fireworks, Kilocode, etc.).

---

## 2. ChainGPT Provider Integration

### 2.1 MultiModelRouter.ts — ChainGPT as Web3 Provider

ChainGPT is integrated into `MultiModelRouter.ts` as the primary provider for Web3-specific governance queries:

```typescript
// src/modules/cloudflare-agents/MultiModelRouter.ts
export class MultiModelRouter {
  private config: MultiModelConfig;

  constructor(config?: Partial<MultiModelConfig>) {
    this.config = {
      providers: {
        chaingpt: {
          enabled: true,
          model: "chat/completions", // ChainGPT uses OpenAI-compatible endpoint
        },
        // ... other providers
      },
      // ChainGPT first in fallback order for Web3 queries
      fallbackOrder: ["chaingpt", "fireworks", "kilocode", "workers-ai", "openai", "gemini", "anthropic"],
      // ...
    };
  }
}
```

### 2.2 Context Injection for Governance-Aware Responses

ChainGPT is invoked with Cognivern's policy context to produce governance-copilot responses:

```typescript
async analyzeWithChainGPT(
  prompt: string,
  policyContext?: {
    agentId?: string;
    policyId?: string;
    currentBudget?: string;
    allowedVendors?: string[];
    holdThreshold?: string;
  }
): Promise<string> {
  const systemContext = policyContext ? `
You are Cognivern's governance copilot. Cognivern is the control plane for autonomous Web3 agents:
- Policy: enforcing spend limits, vendor allowlists, and approval thresholds
- Privacy: Fhenix-encrypted confidential policy evaluation
- Audit: cryptographic proof of every governance decision

Current governance context:
- Agent: ${policyContext.agentId || 'unknown'}
- Policy: ${policyContext.policyId || 'unknown'}
- Budget: ${policyContext.currentBudget || 'unknown'}
- Allowed Vendors: ${policyContext.allowedVendors?.join(", ") || 'all'}
- Hold Threshold: ${policyContext.holdThreshold || 'unknown'}

Provide governance-aware analysis with specific references to policy rules being evaluated.
` : `You are Cognivern's Web3 governance copilot, specialized in:
- Smart contract analysis and vulnerability detection
- EVM opcode and calldata decoding
- Sanction and risk assessment for contract addresses
- Blockchain protocol analysis
- DeFi and DEX integration patterns

Provide precise, actionable governance insights with Web3-specific terminology.`;

  // Call ChainGPT API
  const response = await fetch("https://api.chaingpt.org/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "chat/completions",
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
}
```

### 2.3 Query Routing — Web3 vs General

The Intent System routes queries to ChainGPT when they match Web3-specific patterns:

| Query Pattern | Route To | Reason |
|--------------|----------|--------|
| "is this contract sanctioned?" | ChainGPT | Sanction list analysis |
| "what does this calldata do?" | ChainGPT | Calldata decoding |
| "analyze this contract for vulnerabilities" | ChainGPT | Smart contract analysis |
| "should I approve this swap?" | General LLM | Policy-based, not Web3-specific |
| "summarize my agent's recent activity" | General LLM | General reasoning |

---

## 3. Smart Contract Auditor — Runtime Defense

### 3.1 ChainGPTAuditService.ts

The `ChainGPTAuditService` is the first production use of ChainGPT's Smart Contract Auditor for **runtime defense**, not just CI:

```typescript
// src/services/ChainGPTAuditService.ts
export class ChainGPTAuditService {
  private config: Required<AuditConfig>;

  constructor(config: AuditConfig) {
    this.config = {
      baseUrl: config.baseUrl || "https://api.chaingpt.org",
      timeoutMs: config.timeoutMs || 30000,
      blockOnSeverity: config.blockOnSeverity || "high",
      holdOnMedium: config.holdOnMedium ?? true,
      ...config,
    };
  }

  /**
   * Audit a contract address before allowing spend.
   * Returns audit result with decision (approve/hold/deny).
   */
  async auditContract(
    contractAddress: string,
    options?: { sourceCode?: string; bytecode?: string; skipCache?: boolean }
  ): Promise<{ decision: "approve" | "hold" | "deny"; audit: AuditResult }> {
    // Check cache first (5-minute TTL)
    // Call ChainGPT Auditor API
    // Return decision based on severity
  }
}
```

### 3.2 Policy Rule Type: `contract_audit`

The `PolicyEnforcementService` evaluates a new rule type `contract_audit`:

```typescript
case "contract_audit":
  return await this.evaluateContractAuditRule(rule, action);

private async evaluateContractAuditRule(
  rule: PolicyRule,
  action: AgentAction,
): Promise<{ allowed: boolean; reason?: string; metadata?: any }> {
  const targetContract = action.metadata?.targetContract as string;

  if (!targetContract) {
    return { allowed: true, reason: "No contract target to audit" };
  }

  const auditResponse = await this.chainGPTAuditService.auditContract(targetContract);
  const { decision, audit } = auditResponse;

  const metadata = {
    auditScore: audit.score,
    severity: audit.severity,
    findings: audit.findings,
    auditedAt: audit.auditedAt,
    chaingptAudit: true, // Mark as ChainGPT-powered
  };

  switch (decision) {
    case "deny":
      return {
        allowed: false,
        reason: `Contract audit DENIED: ${audit.summary}. Score: ${audit.score}/100`,
        metadata,
      };
    case "hold":
      return {
        allowed: false,
        reason: `Contract audit HOLD: ${audit.summary}. Requires operator review.`,
        metadata: { ...metadata, requiresReview: true },
      };
    default: // "approve"
      return {
        allowed: true,
        reason: `Contract audit PASSED: ${audit.summary}. Score: ${audit.score}/100`,
        metadata,
      };
  }
}
```

### 3.3 Decision Logic

| Severity | Action | Rationale |
|----------|--------|-----------|
| Critical | **Deny** | Immediate block — exploitable vulnerability |
| High | **Deny** (configurable to Hold) | Strong vulnerability detected |
| Medium | **Hold** | Requires operator review |
| Low/Info | **Approve** | Minor concerns, acceptable risk |

---

## 4. AI Crypto News — Governance Signal

### 4.1 News Webhook Subscription

Cognivern subscribes to ChainGPT's AI Crypto News webhooks for real-time governance signals:

```typescript
// Subscribe to ChainGPT news webhooks
POST /api/webhooks/chain-gpt-news
{
  "events": ["exploit", "depeg", "sanction"],
  "policyId": "policy_123",
  "action": "hold_mode"
}
```

### 4.2 Policy Auto-Adjustment

When breaking news matches an agent's vendor/token allowlist, the policy engine auto-flip to hold mode:

```
News Event: "Protocol X exploit detected — $50M drained"
  ↓
Match against agent's vendor allowlist
  ↓
If exploit target matches allowed vendor:
  → Set policy to HOLD mode
  → Notify operator
  → Block pending transactions
  → Require manual approval to resume
```

---

## 5. Configuration

### 5.1 Environment Variables

```bash
# ChainGPT API Key
CHAINGPT_API_KEY=your_api_key_here

# Optional: Custom base URL (for enterprise deployments)
CHAINGPT_BASE_URL=https://api.chaingpt.org

# Audit service settings
CHAINGPT_AUDIT_TIMEOUT_MS=30000
CHAINGPT_AUDIT_CACHE_TTL_MS=300000
```

### 5.2 Dependency Injection

```typescript
// src/di/container.ts
import { ChainGPTAuditService } from '../services/ChainGPTAuditService.js';
import { MultiModelRouter } from '../modules/cloudflare-agents/MultiModelRouter.js';

// ChainGPT Audit Service
container.registerSingleton(ChainGPTAuditService, () => {
  const apiKey = process.env.CHAINGPT_API_KEY;
  if (!apiKey) {
    logger.warn("CHAINGPT_API_KEY not configured - ChainGPT audit disabled");
    return null;
  }
  return new ChainGPTAuditService({
    apiKey,
    blockOnSeverity: "high",
    holdOnMedium: true,
  });
});

// MultiModelRouter with ChainGPT
container.registerSingleton(MultiModelRouter, () => {
  return new MultiModelRouter({
    userApiKeys: {
      chaingpt: process.env.CHAINGPT_API_KEY,
    },
  });
});
```

---

## 6. Open Source Contribution

Cognivern's ChainGPT integration will be published as a reusable middleware:

**Repository:** `github:cognivern/agent-safety-middleware`

This middleware provides:
- ChainGPT Web3 LLM provider for governance analysis
- Smart Contract Auditor pre-spend hook
- News-driven policy auto-adjustment

License: MIT

---

## 7. Grant Alignment

| Requirement | Cognivern Commitment |
|-------------|---------------------|
| Builder tier credits | $10K credits for ChainGPT API usage |
| 12-month integration commitment | ChainGPT will remain in provider mix |
| Open source contribution | `agent-safety-middleware` published |
| PoC demonstration | Loom video showing: agent spend → ChainGPT Auditor flags vulnerable target → spend held → operator sees ChainGPT-powered reasoning |

---

## 8. API Reference

### ChainGPT Web3 LLM

```
POST https://api.chaingpt.org/api/v1/chat/completions
Authorization: Bearer {CHAINGPT_API_KEY}
Content-Type: application/json

{
  "model": "chat/completions",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.3,
  "max_tokens": 2048
}
```

### ChainGPT Smart Contract Auditor

```
POST https://api.chaingpt.org/v1/audit/smart-contract
Authorization: Bearer {CHAINGPT_API_KEY}
Content-Type: application/json

{
  "address": "0x...",
  "blockchain": "ethereum",
  "audit_type": "full"
}
```

### AI Crypto News Webhooks

ChainGPT provides webhook integration for real-time news events. Contact ChainGPT support for webhook setup.

---

## 9. Monitoring & Observability

All ChainGPT integrations emit structured logs for observability:

```typescript
logger.info(`Auditing contract: ${contractAddress}`, {
  provider: 'chaingpt',
  ruleId: rule.id,
  agentId: action.metadata?.agentId,
});

logger.warn("ChainGPT API error", {
  error: error.message,
  endpoint: 'audit/smart-contract',
  retry: attempt < maxRetries,
});
```

Metrics exported:
- `chaingpt_requests_total` — Counter of all ChainGPT API calls
- `chaingpt_audit_decisions` — Histogram of approve/hold/deny decisions
- `chaingpt_latency_ms` — Histogram of API response times

---

## 10. Future Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-chain audit | Extend auditor to support more chains (Arbitrum, Base, etc.) | High |
| Audit caching | Cross-node shared cache for audit results | Medium |
| News sentiment | Use ChainGPT to analyze news sentiment for policy adjustment | Low |
| Automated remediation | Allow ChainGPT to suggest policy modifications based on audit findings | Low |
