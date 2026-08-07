# Tester Guide — Cognivern

**Live app:** https://cognivern.persidian.com
**API:** https://api.cognivern.persidian.com
**API docs:** https://api.cognivern.persidian.com/api/docs/openapi.json

This is an operator orientation, not a research script. For moderated user
sessions, provide participants only the canonical URL below.
Authenticated research requires a disposable workspace or staging environment.
Do not use real funds, production API keys, or another user's
workspace for research sessions.

The examples below describe the expected product flow; seeded data and available
actions may vary by environment.

---

## 1. Sign in (30 seconds)

For a user-testing session, the moderator should provide the canonical pilot URL
and a disposable account in advance. Do not ask participants to use a wallet or
production credentials.

- Go to https://cognivern.persidian.com
- Click **Sign In**. Email is the default tab — use the disposable account
  supplied by the moderator, or choose **Sign up** to create an account in an
  explicitly isolated test workspace. Do not use another person's account,
  production credentials, or a real wallet for research.
- If you use the wallet path, sign the SIWE message — no gas, no transaction.

You'll land on the dashboard. The first operational section is an attention
summary: it distinguishes held decisions that need action from denied outcomes
that need investigation. When present, **Review decisions** opens the clean
Audit **Needs attention** view.

## 2. Run a governance check (30 seconds)

From the dashboard, use the **Quick Check** card:

| Try this    | Expected result                        |
| ----------- | -------------------------------------- |
| $50 swap    | **Approved** — under all thresholds    |
| $500 swap   | **Held** — flagged for review          |
| $5,000 swap | **Denied** — exceeds $3,000 hard limit |

Or go to **Governance Check** in the sidebar for the full interactive
page with FHE-encrypted evaluation, policy reasoning, and shareable links.

## 3. Optional: Generate and test an API key (1 minute)

Only do this in an isolated workspace. API keys are persistent credentials and
must be treated as disposable after the session.

1. Go to **Integrate** in the sidebar
2. Click **Generate API Key**
3. Click **Test Key** — verifies the key works against `GET /api/agents`
4. Copy the key for use in your own agent

Example API call:

```bash
curl https://api.cognivern.persidian.com/api/governance/evaluate \
  -H "x-api-key: YOUR_API_KEY" \
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

- Filter by status (All / Needs attention / Approved / Held / Denied) — the
  choice is reflected in the URL, so you can share an investigation link.
- Press `/` to jump straight to search, then type an identity or action.
- Click any row to expand it and see the full evidence (policy checks,
  on-chain record, FHE/SigNoz links, suspicion analysis).
- If the attention summary is visible, use its action to enter a clean triage
  view; it clears a conflicting search query rather than producing a misleading
  no-results state.

## 6. Resolve execution work (30 seconds)

Go to **Runs** in the sidebar. Awaiting approvals and failed executions are
summarized at the top and prioritized before completed history.

- Click **Review approval** for an awaiting run to inspect its decision.
- Click **Inspect failure** for a failed run to review the trace before retrying.
- Use status filters to focus the queue without changing the priority within the
  selected result set.

## 7. Manage API identities (30 seconds)

Go to **API Identities** under **Configure**. Click **Select** to enter
progressive batch mode, choose real identities, and use **Pause**, **Resume**,
or **Revoke**. Demo identities are labeled and cannot be mutated.

## 8. Verify on-chain proofs on 0G Chain (30 seconds)

Every governance decision is permanently recorded as an on-chain event
on 0G Galileo Testnet. You can verify any decision independently:

1. Check the integration status:
   ```
   curl https://api.cognivern.persidian.com/api/governance/proof-info
   ```
2. Open the **contract on ChainScan**:
   https://chainscan-galileo.0g.ai/address/0x723e444ee6D7da19fADe372f85DA06dD849bF1E0
3. Click the **Events** tab — every `GovernanceDecision` event is a
   governance evaluation recorded on-chain, with the agent ID, action
   type, amount, decision, and timestamp.

This makes every governance decision tamper-proof and verifiable by
anyone — without trusting Cognivern's server.

---

## 9. Optional: Try a KeeperHub-routed spend (1 minute)

This is an operator/demo workflow, not part of the default user-testing pilot.
Only run it with an explicitly disposable wallet and test funds.

The Settings → Wallets card lets you pick the **execution provider**
for each wallet — `local` (default, Cognivern signs and broadcasts)
or `keeperhub` (KeeperHub signs and broadcasts with gas sponsorship
and MEV protection).

1. Go to **Settings → Wallets** in the sidebar.
2. Find the wallet you want to route through KeeperHub, choose
   `KeeperHub` as the execution provider, paste the wallet address
   you funded on [app.keeperhub.com](https://app.keeperhub.com), and
   save.
3. Trigger any approved spend on that wallet — for example, run
   `pnpm tsx scripts/demo/run-keeperhub-rebalance.ts
--wallet-id $WALLET_ID --recipient 0xRecipient --amount-wei
1000000000000000 --reason "test rebalance"` from your terminal.
4. Open the **Observability** page. The card header now shows
   "Finding a KeeperHub-routed spend" — click through to the trace
   tree, then drill into the `wallet_sign_and_broadcast` span and
   look for the `keeperhub.execution_id` attribute. That id also
   shows up on app.keeperhub.com so you can correlate the two sides.

If the card is empty (no wallets), the empty state links straight
to `app.keeperhub.com` and walks you through the one-time setup.

## What you're looking at

Cognivern is a **governance layer for autonomous spending agents**. It
sits between your AI/trading agents and the blockchain, enforcing spend
policies with optional FHE encryption so amounts stay confidential.

- **Policies** define spending limits, vendor allowlists, and chain rules
- **Agents** are governed identities with budgets and trade history
- **Governance Check** evaluates a proposed action against active policies
- **Audit** logs every decision with cryptographic evidence
- **0G Chain** records every governance decision as an on-chain event for
  tamper-proof verifiability (0G Galileo Testnet)
- **Sealed Bids** run confidential vendor RFPs on Canton (live on Devnet)
- **OS Terminal** is a natural-language interface to the entire platform

## Need help?

- API spec: https://api.cognivern.persidian.com/api/docs/openapi.json
- Health check: https://api.cognivern.persidian.com/api/health
- 0G proof info: https://api.cognivern.persidian.com/api/governance/proof-info
- Source code: https://github.com/thisyearnofear/cognivern
