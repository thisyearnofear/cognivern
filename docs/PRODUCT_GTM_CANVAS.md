# Product & GTM Canvas — Cognivern

*Following the templates from the Arbitrum Open House London Product Framing
session (Daniel Lumi, Offchain) and GTM Workshop (Swagtimus, Arbitrum DevRel).*

---

## Product Canvas

**Team Name:** thisyearnofear (Cognivern)

**One line — what you're building:** Spend governance for AI agent wallets —
every agent spend is policy-checked, privacy-preserving, and audit-ready.

**Who is this for:** The engineering lead or head of platform at a Web3-native
team (5–50 people) that deploys autonomous trading or procurement agents and is
answerable to investors, auditors, or compliance for what those agents spend.

**What they do today:** They hand an agent a wallet private key with a balance.
The agent can spend the entire balance in one call. Budgets and spend limits
live in plaintext or in the agent's prompt ("don't spend more than $500").
There's no audit trail a regulator or investor would accept. When something
goes wrong, they find out after the money is gone.

**The wedge:** A policy evaluation layer that intercepts every agent spend
request before signing — deny / hold / approve based on budget, vendor, chain,
risk — with budgets and spend counters encrypted on-chain via FHE so the
agent's limits aren't visible to anyone with RPC access. One API call per
spend, zero changes to the agent framework.

**Why now:** Three trigger events converge: (1) AI agent frameworks (LangChain,
CrewAI, AutoGen, Google ADK) are maturing and agents are increasingly given
wallet keys to execute real transactions — the cost of an ungoverned spend is
going from hypothetical to happening; (2) FHE coprocessors (CoFHE on Arbitrum
Sepolia) just became production-ready enough to evaluate encrypted budgets
on-chain — this wasn't possible 12 months ago; (3) regulatory pressure on AI
agent spending is emerging — teams need compliance evidence before they can
deploy autonomous agents in production.

**Alternatives and gaps:**
- *"Nothing"* — most teams hand the agent a key and hope. No governance at all.
- *Multisig wallets* — slow, manual, not real-time, doesn't work for autonomous agents that need to act in seconds.
- *Spending limits in the agent's prompt* — trivially bypassed by prompt injection, not enforceable, not auditable.
- *Off-chain policy engines* (SaaS spend controls) — no on-chain enforcement, no cryptographic proof of compliance, the policy engine itself is a trusted party that could be compromised.
- *The gap:* no existing solution enforces spend policy at the cryptographic / on-chain level while keeping budgets confidential AND producing a non-repudiable audit trail.

**Why onchain, why Arbitrum:**
- FHE policy evaluation **requires** on-chain verifiability — the decision (approve/deny) must be provable to auditors, not just asserted by a backend. Without onchain, the policy engine is a trusted party that could lie.
- Budgets encrypted via FHE on Arbitrum Sepolia means limits aren't visible to anyone with RPC access — this is **only possible onchain** with FHE. Off-chain encryption still requires trusting the evaluator.
- Cross-chain execution dispatch via Hyperlane (FHE decision → GovernanceContract → GovernedVault) all within the Arbitrum ecosystem.
- Low fees make per-spend policy evaluation economically viable — a $0.001 evaluation guarding a $500 spend.
- **What breaks without onchain:** no cryptographic proof of policy compliance, budgets visible to anyone with RPC, no non-repudiable audit trail, the policy engine is a trust assumption instead of a verifiable guarantee.

**First 5–10 users:**
1. Web3-native trading bot teams on Arbitrum who need compliance for investor reporting
2. DeFi protocol teams running automated treasury management agents
3. AI agent platform teams deploying autonomous agents (CrewAI / LangChain / Google ADK ecosystems)
4. OWS wallet users who already have agent wallets and need governance
5. Hackathon teams at this event deploying agents that spend real testnet funds
6. Audit/compliance firms serving Web3 teams (as distribution channel, not end user)

**Ship this weekend:** Demo the full flow live — agent requests spend → FHE
policy evaluation on Arbitrum Sepolia (contracts already deployed) →
approve/deny → audit trail anchored to Filecoin. Show the Gemini 3.1 agent
runtime doing PLAN→EVIDENCE→PREVIEW→CONFIRM→EXECUTE→AUDIT. Show on-chain
contract reads proving the deployment is live.

---

## GTM Canvas

**Team Name:** thisyearnofear (Cognivern)

**One line — what you're building:** Spend governance for AI agent wallets —
every spend policy-checked, privacy-preserving, audit-ready.

**Who buys, who uses:** The engineering lead or head of platform **buys**
(budget owner, cares about compliance/risk); the agent developer and ops/finance
team **use** day-to-day (policy configuration, audit trail review, spend
monitoring).

**First reachable audience:** Web3-native teams already running autonomous
trading or procurement agents on Arbitrum who are answerable to investors or
auditors — reachable through the Arbitrum ecosystem Discord, Encode/ETHGlobal
hackathon alumni networks, and AI agent framework communities (CrewAI, LangChain,
Google ADK Discord servers).

**3 distribution channels:**
1. **Agent framework integrations (borrowed):** ship a Cognivern plugin for
   CrewAI / LangChain / Google ADK so any agent built on those frameworks gets
   spend governance by default. Governance is a required layer for any
   enterprise agent deployment — the frameworks have a compelling reason to
   integrate. (GMX lesson: GLP as a money lego → 28+ protocols built on top =
   free distribution.)
2. **Arbitrum ecosystem presence (earned):** the FHE-on-Arbitrum story is
   narratively compelling — "your agent's budget is encrypted on-chain" is
   unique and worth talking about. Founder-led content + demo at Arbitrum
   events + open-source contracts verified on Arbiscan build trust through
   transparency.
3. **Compliance/audit adjacency (borrowed):** partner with audit firms and
   compliance tools that serve Web3 teams — they have the customers who feel
   the pain and have budget to solve it. When a firm recommends Cognivern as
   the evidence trail for agent spend compliance, that's borrowed distribution
   with built-in trust.

**Core message, one sentence:** "Your AI agent can't spend a dollar without a
policy check — and the budget it's checked against is encrypted on-chain, so
nobody can see your limits."

**Proof you need first:** One real team running an autonomous agent on Arbitrum
with Cognivern governance in production, with a documented case where the policy
layer caught or prevented an unauthorized spend — and the on-chain evidence to
prove it.

**The intro that helps:** An intro from the Arbitrum Foundation to a DeFi
protocol team running automated treasury agents, or to an AI agent platform
looking for a governance layer to differentiate their enterprise offering.

**5 named targets:**
1. Arbitrum ecosystem DeFi protocols running automated agents (treasury
   management, LP rebalancing, liquidation bots)
2. CrewAI ecosystem — teams building production agents who need enterprise
   governance
3. Google Cloud Agent Builder ecosystem (we're already integrated with
   Gemini 3.1 + MongoDB MCP — `agent/agent-builder.yaml`)
4. OWS wallet users (existing user base with agent wallets, no governance layer)
5. Encode / ETHGlobal hackathon teams deploying spending agents who need a
   governance story for their own submissions

**The ask this weekend:** Intros to two DeFi protocol teams on Arbitrum running
autonomous agents, plus feedback from a product mentor on the wedge framing.
CTA: try the live API (`cognivern.thisyearnofear.com`) with one agent spend this
week.

---

## GTM Diagnosis — the four questions

| GTM Question | Cognivern's answer |
|--------------|-------------------|
| **Discover** | **Borrowed** via agent framework integrations (CrewAI/LangChain/ADK plugin — governance is a required layer for enterprise agent deployment, so frameworks have a compelling reason to integrate). **Earned** via the FHE-on-Arbitrum narrative ("your agent's budget is encrypted on-chain") + founder-led content + open-source contracts. |
| **Trust** | On-chain proof of policy compliance (every decision is a verifiable contract call on Arbitrum Sepolia, not a backend assertion). Open-source contracts (verified on Arbiscan). FHE cryptographic guarantees (budgets encrypted, not just hidden). Dual-anchor audit trail (Filecoin + 0G). Trust comes from **verifiability**, not from claims. |
| **Stay** | **Workflow lock-in** — once Cognivern is the policy layer between agent and wallet, removing it means going back to ungoverned spending. The audit trail becomes load-bearing for compliance (you can't rip out the thing that produces your regulatory evidence). FHE-encrypted budgets create switching costs (re-encrypting policies on a new system). |
| **Share** | When a team passes a compliance audit because Cognivern produced the evidence trail, they tell other teams facing the same audit. The narrative ("our AI agent's budget is encrypted on-chain") is novel enough to be worth talking about. Agent framework integrations create organic distribution — every agent built with the Cognivern plugin is a demo. |

---

## GTM anti-pattern check

| Anti-pattern | How Cognivern avoids it |
|--------------|------------------------|
| "I have contacts that will promote us" | Distribution is framework integrations + ecosystem narrative, not personal contacts. |
| "We have points" | Retention comes from workflow lock-in + compliance dependency, not points or incentives. |
| "We have a token" | No token. Business model is SaaS control-plane subscription + per-spend evaluation fees. |
| "We are composable" | We name the specific integration target (agent frameworks) and the compelling reason: governance is a **required** layer for any enterprise agent deployment — without it, agents can't be deployed in regulated environments. |
| "We'll partner with protocols" | We name specific targets (DeFi protocols with automated agents, audit firms) and why they care (compliance evidence, risk reduction). |
| "We need users" | We name the specific first user profile (engineering lead at a Web3 team running autonomous agents, answerable to auditors) and why they have urgency (agent spending is happening now, ungoverned). |