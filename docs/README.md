# Cognivern docs index

Durable docs live here; concluded hackathon material lives in
[`history/`](./history/). `OPS.md` is gitignored private runtime notes — do not
commit it or copy its contents into public docs.

## Start here

- [REPOSITORY_MAP.md](./REPOSITORY_MAP.md) — where to make changes by feature
- [DEV.md](./DEV.md) — architecture, local setup, API reference
- [TESTER_GUIDE.md](./TESTER_GUIDE.md) — canonical live/demo walkthrough
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production configuration and release ops

## Product & architecture

- [PRODUCT_MODEL.md](./PRODUCT_MODEL.md) — product promise, loop, and entity glossary
- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — funded-mandate thesis, GTM, and capital-allocation roadmap (merges the former thesis / GTM canvas / go-to-market docs)
- [AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md](./AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md) — mandate, outcome, statement, and evidence invariants
- [OUTCOME_EVIDENCE_PLAN.md](./OUTCOME_EVIDENCE_PLAN.md) — outcome connectors, Capital UI, WebMCP, and server MCP (absorbs the former capital-agent-surfaces plan)
- [ARCHITECTURE_RAILS.md](./ARCHITECTURE_RAILS.md) — how the rails fit together
- [AGENT_GOVERNANCE_INTEGRATION_SPEC.md](./AGENT_GOVERNANCE_INTEGRATION_SPEC.md) — sealed-bid and governance integration details
- [UX_IA_REVIEW.md](./UX_IA_REVIEW.md) — information architecture rules
- [ADAPTIVE_UX.md](./ADAPTIVE_UX.md) — workspace-adaptive UI behavior
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) — trust model and per-domain ownership map
- [LANGFUSE_LESSONS.md](./LANGFUSE_LESSONS.md) — observability adjacency plan
- [PROMPT_INJECTION_CONTROLS_PLAN.md](./PROMPT_INJECTION_CONTROLS_PLAN.md) — injection-defense controls

## Rails & integrations (current)

- [CANTON.md](./CANTON.md) — Daml sealed-bid auctions, DevNet runbook, settlement
- [CLEANVERSE.md](./CLEANVERSE.md) — CVI/CVA verified-capital rail on Monad
- [FLARE.md](./FLARE.md) — confidential spend-policy evaluation in a Flare Compute Extension
- [KEEPERHUB.md](./KEEPERHUB.md) — governed execution via KeeperHub keepers
- [TELEGRAPH.md](./TELEGRAPH.md) — verified AI intelligence, confidence-gated, x402-paid
- [HYDRADB.md](./HYDRADB.md) — derived evidence/context graph
- [GOVERNANCE_PROOFS.md](./GOVERNANCE_PROOFS.md) — append-only proof anchors on 0G and X Layer
- [DYNAMIC.md](./DYNAMIC.md) — MPC server wallets
- [SPONSORED_CREDITS.md](./SPONSORED_CREDITS.md) — sponsored inference credits
- [AGENTIC_COMMERCE_DEMO_RUNBOOK.md](./AGENTIC_COMMERCE_DEMO_RUNBOOK.md) — canonical sealed-bid demo sequence

## Program status

Status as of **2026-09-18**. Update this table when a program changes state;
never bake deadlines into `AGENTS.md` or rail docs.

| Program | Type | Status | Reference |
| --- | --- | --- | --- |
| HackCanton S3 | Hackathon | **Open** — submissions due Oct 9 2026 23:59 UTC | no submission doc yet |
| Prezenti AI Builder Sponsorship | Sponsorship (not a hackathon) | Applying — hard close Dec 29 2026; Celo mainnet milestone required | [PREZENTI_SPONSORSHIP.md](./PREZENTI_SPONSORSHIP.md) |
| HackCanton S2 | Hackathon | Concluded | [CANTON.md](./CANTON.md) (rail stays live) |
| Cleanverse Build: Trusted Assets | Hackathon | Concluded Aug 9 2026 | [history submission](./history/HACKATHON_SUBMISSION_CLEANVERSE.md) |
| KeeperHub — Agents Onchain | Hackathon | Concluded Aug 13 2026 | [history submission](./history/HACKATHON_SUBMISSION_KEEPERHUB.md) |
| Flare Summer Signal | Hackathon | Concluded Aug 14 2026 | [history submission](./history/FLARE_SUMMER_SIGNAL.md) |
| Telegraph Protocol S1 Track 3 | Hackathon | Concluded Sep 7 2026 | [history submission](./history/HACKATHON_SUBMISSION_TELEGRAPH.md) |

## History

`docs/history/` holds concluded-event material: submission trackers, demo
scripts, pitch sources, and the build-window iteration log. Each file carries a
banner marking it historical. Linked from the rail docs above; not maintained
as current truth.
