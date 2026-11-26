# Cognivern docs index

Durable docs live here; concluded hackathon material lives in
[`history/`](./history/). `OPS.md` is gitignored private runtime notes — do not
commit it or copy its contents into public docs.

## Start here

- [REPOSITORY_MAP.md](./REPOSITORY_MAP.md) — where to make changes by feature
- [DEV.md](./DEV.md) — architecture, local setup, API reference
- [TESTING.md](./TESTING.md) — TestSprite verification: live-target suite, exported modules, the loop, what it does not cover
- [TESTER_GUIDE.md](./TESTER_GUIDE.md) — canonical live/demo walkthrough
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production configuration and release ops

## Product & architecture

- [PRODUCT_MODEL.md](./PRODUCT_MODEL.md) — product promise, loop, and entity glossary
- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — funded-mandate thesis, GTM, and capital-allocation roadmap (merges the former thesis / GTM canvas / go-to-market docs)
- [LEXSI_PRODUCT.md](./LEXSI_PRODUCT.md) — Lexsi governed-spend findings → product roadmap (decision contract, unsafe-enforcement metrics, per-tenant eval, adapter rail)
- [AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md](./AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md) — mandate, outcome, statement, and evidence invariants
- [OUTCOME_EVIDENCE_PLAN.md](./OUTCOME_EVIDENCE_PLAN.md) — outcome connectors, Capital UI, WebMCP, and server MCP (absorbs the former capital-agent-surfaces plan)
- [ARCHITECTURE_RAILS.md](./ARCHITECTURE_RAILS.md) — how the rails fit together
- [AGENT_GOVERNANCE_INTEGRATION_SPEC.md](./AGENT_GOVERNANCE_INTEGRATION_SPEC.md) — sealed-bid and governance integration details
- [UX_IA_REVIEW.md](./UX_IA_REVIEW.md) — information architecture rules
- [VISUAL_MOTION_UX_PLAN.md](./VISUAL_MOTION_UX_PLAN.md) — visual, illustration, and motion design system: 8 primitives, phased implementation record, anti-slop quality gates
- [internals/proof-and-eval-contracts.md](./internals/proof-and-eval-contracts.md) — the shared proof envelope (`/verify` summary) and the eval cases/report contract
- [internals/population-governance.md](./internals/population-governance.md) — durable design constraints for the Programs/population layer from the Apart Swarm experiment
- [internals/settlement-pipeline.md](./internals/settlement-pipeline.md) — settlement pipeline shape and rail-agnostic evolution path
- [ADAPTIVE_UX.md](./ADAPTIVE_UX.md) — workspace-adaptive UI behavior
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) — trust model and per-domain ownership map
- [LANGFUSE_LESSONS.md](./LANGFUSE_LESSONS.md) — observability adjacency plan
- [PROMPT_INJECTION_CONTROLS_PLAN.md](./PROMPT_INJECTION_CONTROLS_PLAN.md) — injection-defense controls
- [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) — reusable pre-submission pass for judged programs
- [HACKATHON_PIPELINE.md](./HACKATHON_PIPELINE.md) — program selection doctrine (north-star alignment filter) and live opportunity evaluation

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
- [TYPESAFE.md](./TYPESAFE.md) — proposed calibrated-decision rail (Jev); evaluated, not built

## Program status

Status as of **2026-11-26**. Update this table when a program changes state;
never bake deadlines into `AGENTS.md` or rail docs.

| Program | Type | Status | Reference |
| --- | --- | --- | --- |
| Canton Community Research Grants (November 2026) | Research grant | Published Nov 22; shared on X — grant outcome pending | [DEV article](https://dev.to/papajams/sealed-from-whom-what-each-party-can-see-in-a-canton-procurement-auction-442b) · [publication record](./history/CANTON_RESEARCH_NOV26.md) |
| TestSprite Season 4 | Hackathon | Concluded — submission window closed; repo doc records incomplete submission requirements | [submission](./history/TESTSPRITE_S4_SUBMISSION.md) · [verification doc](./TESTING.md) |
| HackCanton S3 | Hackathon | Concluded Oct 21 2026 — not shortlisted; [retro](./history/HACKATHON_SUBMISSION_HACKCANTON_S3.md#retrospective) | [submission](./history/HACKATHON_SUBMISSION_HACKCANTON_S3.md) |
| HackCanton S4 | Hackathon | Postponed to 2027 — dates to be announced | [CANTON.md](./CANTON.md) |
| Prezenti AI Builder Sponsorship | Sponsorship (not a hackathon) | Applying — hard close Dec 29 2026; Celo mainnet milestone required | [PREZENTI_SPONSORSHIP.md](./PREZENTI_SPONSORSHIP.md) |
| ETHGlobal Agentic Markets | Hackathon | Evaluating — aligned per pipeline doctrine; async Dec 3–10 2026, $50K+, agentic markets theme | [HACKATHON_PIPELINE.md](./HACKATHON_PIPELINE.md) |
| Celo Agents Open for Business | Hackathon | Evaluating — aligned (Altana/Verified tracks); ends Dec 7 2026; can double-count the Prezenti Celo-mainnet milestone | [HACKATHON_PIPELINE.md](./HACKATHON_PIPELINE.md) |
| Colosseum Eternal | Ongoing sprint program | Aligned — start 4-week sprint when Solana settlement evidence is ready; feeds Spring 2027 hackathon | [HACKATHON_PIPELINE.md](./HACKATHON_PIPELINE.md) |
| Zapier Build Week | Usage challenge (not a hackathon, no prizes) | Parked — fictional two-pass rehearsal done; no operator or live Zapier run yet; free-call window ends 5 Jan 2027 | [ZAPIER_BUILD_WEEK.md](./ZAPIER_BUILD_WEEK.md) |
| HackCanton S2 | Hackathon | Concluded | [CANTON.md](./CANTON.md) (rail stays live) |
| Cleanverse Build: Trusted Assets | Hackathon | Concluded Aug 9 2026 | [history submission](./history/HACKATHON_SUBMISSION_CLEANVERSE.md) |
| KeeperHub — Agents Onchain | Hackathon | Concluded Aug 13 2026 | [history submission](./history/HACKATHON_SUBMISSION_KEEPERHUB.md) |
| Flare Summer Signal | Hackathon | Concluded Aug 14 2026 | [history submission](./history/FLARE_SUMMER_SIGNAL.md) |
| Lexsi AI Safety & Alignment | Hackathon | Concluded — submission window closed Nov 15 2026; v7 adapter/results documented; no outcome recorded | [experiment log](./history/LEXSI_HACKATHON.md) · [product translation](./LEXSI_PRODUCT.md) |
| Apart Swarm Alignment | Hackathon | Concluded Nov 8 2026 — Kernel v8 results final | [archived doc](./history/APART_SWARM_2026.md) · [durable constraints](./internals/population-governance.md) |
| Telegraph Protocol S2 | Hackathon | Active — final submission prep; Track 03 Apps & Agents with Mission 02 primary and Mission 10 supporting evidence; model-agnostic paid supplier-diligence report recorded Nov 24 with three model arms (qwen4-max, gemini-3.6-flash, gpt-oss-20b) — public report at `/verify?report=supplier-diligence`; local validator transfer and replay verified; devnet preflight read-only and unfunded; [activation gates](./internals/supplier-payment-executor.md) pending; submissions close Dec 1 2026 23:59 UTC via Anjoman | [submission](./HACKATHON_SUBMISSION_TELEGRAPH_S2.md) · [TELEGRAPH.md](./TELEGRAPH.md) · [SPONSORED_CREDITS.md](./SPONSORED_CREDITS.md) |
| Telegraph Protocol S1 Track 3 | Hackathon | Concluded Sep 7 2026 — no placement; [retrospective](./TELEGRAPH.md#season-i-retrospective) | [history submission](./history/HACKATHON_SUBMISSION_TELEGRAPH.md) |

## History

`docs/history/` holds concluded-event material: submission trackers, demo
scripts, pitch sources, and the build-window iteration log. Each file carries a
banner marking it historical. Linked from the rail docs above; not maintained
as current truth.
