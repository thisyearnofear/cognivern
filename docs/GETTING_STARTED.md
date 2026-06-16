# Getting Started with Cognivern

A practical guide for operators, fund managers, and DAO treasurers who need to govern AI agent spending — without needing to write code.

---

## What Cognivern Does

Cognivern gives you **control over what your AI agents can spend**. Here's the core loop:

1. **Your agent wants to spend money** — It could be a trading bot, a yield optimizer, or any autonomous system.
2. **Cognivern checks its policy** — Is this spend within budget? Is the vendor trusted? Does it match your rules?
3. **You see the decision** — Approved ✅, Held ⏸, or Denied ❌
4. **If approved, money moves** — Real on-chain transaction, not a simulation. Gas paid, funds moved.
5. **It's audited** — Every decision logged with evidence you can prove later.

> **The key thing:** Your agent cannot see its own spending caps. Policy evaluation happens in a confidential environment (FHE), so the agent only knows whether the spend passed or failed — not why it was denied or how much budget remains.

---

## Quick Start (No Wallet Required)

You can try Cognivern right now without connecting a wallet:

1. Go to **[cognivern.vercel.app](https://cognivern.vercel.app)**
2. Click **"Try Live Demo"** — no signup needed
3. You'll land in a sandbox environment with:
   - A demo agent with a budget
   - Sample policies (strict, moderate, open)
   - Pre-filled spend examples

From the demo, you can:
- Preview a spend → see what the policy decides
- Adjust the policy slider → see how rules change the outcome
- View the audit trail → see every decision with evidence

---

## Production Setup (When You're Ready)

### Step 1: Create Your Workspace

1. Go to **[cognivern.vercel.app](https://cognivern.vercel.app)**
2. Click **"Get Started"**
3. Enter your workspace name (e.g., "Acme Fund" or "DAO Treasury")
4. You'll get an **API key** — keep this safe

### Step 2: Register Your Agent

An "agent" in Cognivern is any system that spends money on your behalf: a trading bot, a yield optimizer, a market maker, etc.

1. From your dashboard, click **"Create Agent"**
2. Give it a name (e.g., "Yield Bot Alpha")
3. Select the chain where it will spend (Arbitrum Sepolia for now)
4. Save — you'll get an **Agent ID** to give to your bot

### Step 3: Set Your Policy

Policies define what your agent can and cannot do. Start with one of these templates:

| Template | When to Use |
| -------- | ---------- |
| **Strict** | Daily spend < $100, trusted vendors only |
| **Moderate** | Daily spend < $1,000, known vendors + new vendor limits |
| **Open** | No limits, full visibility (audit only) |

Or create custom rules:

- **Daily limit** — Maximum spend per 24 hours
- **Per-transaction limit** — Maximum single spend
- **Vendor allowlist** — Only these addresses can receive funds
- **Contract blocklist** — Never spend on these contracts
- **Time window** — Only trade during specific hours

### Step 4: Connect Your Agent

Give your agent the **Agent ID** and **API key**. Use the REST API:

```bash
# Check governance before a spend
curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \
  -H "x-api-key: cvn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-YOUR-AGENT-ID",
    "action": {
      "type": "swap",
      "description": "Swap 1500 USDC for ETH on Uniswap",
      "amount": 1500,
      "currency": "USDC"
    }
  }'

# Response (standard policy):
# { "success": true, "data": { "approved": true, "reason": "...", "policyChecks": [...] } }
#
# Response (confidential FHE policy) — evaluation runs asynchronously:
# 202 Accepted { "success": true, "data": { "runId": "...", "status": "running" } }
# Poll GET /api/governance/evaluate/{runId}/result for the outcome.
```

> The `policyId` is optional — if omitted, Cognivern uses your workspace's active policy.

For the full API reference, see the [Developer Guide](./DEVELOPER.md).

### Step 5: Monitor & Audit

From your dashboard, you can:

- **Audit** — See every spend decision with timestamp, amount, vendor, policy rule that triggered the decision, and on-chain transaction hash
- **Run history** — Full timeline of what your agent attempted, what was approved/held/denied
- **Export** — Download CSV or JSON for accounting

---

## Understanding Decisions

When your agent attempts a spend, Cognivern returns one of three decisions:

| Decision | Meaning | What Happens |
| -------- | -------- | ----------- |
| **Approved** ✅ | Spend fits your policy | Money moves on-chain |
| **Held** ⏸ | Spend needs review | You approve/deny manually in dashboard |
| **Denied** ❌ | Spend violates policy | Money does not move |

For each decision, you see:

- **Decision ID** — Unique reference
- **Attestation hash** — Cryptographic proof of the decision
- **Policy rules matched** — Which rules triggered this outcome
- **On-chain tx** — Real transaction hash (if approved)

---

## Common Setups

### DAO Treasury

1. Create workspace: "DAO Treasury"
2. Register each bot as separate agent (e.g., "Treasury Bot A", "Treasury Bot B")
3. Set policy: Strict — $500/day per bot, multi-sig required for any spend > $100
4. Enable **Ledger hardware signing** for high-value transactions
5. Export monthly reports for DAO voting

### Crypto Fund

1. Create workspace: "[Fund Name]"
2. Register trading bots as agents
3. Set policy: Moderate — $10K/day per bot, vendor allowlist, contract audits enabled
4. Enable **ChainGPT** for pre-spend contract vulnerability scanning
5. Use **MongoDB** for full run history and compliance reporting

### Individual Trader

1. Create workspace: "Personal"
2. Register your trading bot as agent
3. Set policy: Open with daily limit — $1,000/day
4. Use demo mode to test strategies before going live

---

## Troubleshooting

| Issue | Solution |
| ---- | -------- |
| Spend denied | Check the policy rules in the audit entry — likely exceeded daily limit or blocked vendor |
| Agent not responding | Verify the Agent ID and API key are correct |
| Can't see audit history | Ensure MongoDB is connected, or check SQLite locally |
| Want to change policy | Go to Policies → Edit → Save. Changes apply to new spends immediately |

---

## Next Steps

- **[Developer Guide](./DEVELOPER.md)** — Full API reference for custom integrations
- **[Architecture](./ARCHITECTURE.md)** — How the system works under the hood
- **[Runbook](./RUNBOOK.md)** — Incident response for production operators

---

## Need Help?

- **GitHub Issues**: [github.com/cognivern/cognivern/issues](https://github.com/cognivern/cognivern/issues)
- **API Status**: [cognivern.thisyearnofear.com/health](https://cognivern.thisyearnofear.com/health)