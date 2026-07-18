# Tester Guide — Cognivern

**Live app:** https://cognivern.thisyearnofear.com
**API docs:** https://cognivern.thisyearnofear.com/api/docs/openapi.json

You can test the entire product in under 5 minutes. No setup required —
your workspace comes pre-seeded with a default agent and spend policy.

---

## 1. Sign in (30 seconds)

- Go to https://cognivern.thisyearnofear.com
- Click **Connect Wallet** (MetaMask, WalletConnect, or email)
- Sign the SIWE message — no gas, no transaction

You'll land on the dashboard. It shows a "Your workspace is ready" panel
with a quick governance check card.

## 2. Run a governance check (30 seconds)

From the dashboard, use the **Quick Check** card:

| Try this | Expected result |
|----------|----------------|
| $50 swap | **Approved** — under all thresholds |
| $500 swap | **Held** — flagged for review |
| $5,000 swap | **Denied** — exceeds $3,000 hard limit |

Or go to **Governance Check** in the sidebar for the full interactive
page with FHE-encrypted evaluation, policy reasoning, and shareable links.

## 3. Generate and test an API key (1 minute)

1. Go to **Integrate** in the sidebar
2. Click **Generate API Key**
3. Click **Test Key** — verifies the key works against `GET /api/agents`
4. Copy the key for use in your own agent

Example API call:
```bash
curl https://cognivern.thisyearnofear.com/api/governance/evaluate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-alpha-001","action":{"type":"swap","description":"test","amount":50,"currency":"USDC"}}'
```

## 4. Explore the OS Terminal (1 minute)

1. Go to **Terminal** in the sidebar
2. Type `help` — see all available commands
3. Type `status` — system health check
4. Type `hydra status` — check the memory system
5. Type `hydra memory "Cognivern test"` — store a memory
6. Type `hydra recent` — browse recent memories

## 5. Review audit trail (30 seconds)

Go to **Audit** in the sidebar. Every governance check you ran in
step 2 is logged here with the decision, reasoning, and timestamp.

---

## What you're looking at

Cognivern is a **governance layer for autonomous spending agents**. It
sits between your AI/trading agents and the blockchain, enforcing spend
policies with optional FHE encryption so amounts stay confidential.

- **Policies** define spending limits, vendor allowlists, and chain rules
- **Agents** are governed identities with budgets and trade history
- **Governance Check** evaluates a proposed action against active policies
- **Audit** logs every decision with cryptographic evidence
- **Sealed Bids** run confidential vendor RFPs on Canton (live on Devnet)
- **OS Terminal** is a natural-language interface to the entire platform

## Need help?

- API spec: https://cognivern.thisyearnofear.com/api/docs/openapi.json
- Health check: https://cognivern.thisyearnofear.com/api/health
- Source code: https://github.com/thisyearnofear/cognivern
