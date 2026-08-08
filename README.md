# Cognivern

**The economic control plane for agentic work.**

Cognivern makes autonomous work fundable: a business can define a bounded mandate, allocate capital to an agent, enforce what the capital may be used for, record what happened, and build the evidence needed to allocate more. Today Cognivern provides the governed execution and audit substrate; outcome accounting and external capital allocation are strategic next layers.

**Try it:** [Live app](https://cognivern.persidian.com) · [API](https://api.cognivern.persidian.com) · [PromptOS](https://cognivern.persidian.com/os)

## Choose your path

| I want to…                       | Start here                                                      |
| -------------------------------- | --------------------------------------------------------------- |
| Understand the product           | [Developer Guide — overview](./docs/DEV.md#system-architecture) |
| Contribute code                  | [Contributing Guide](./CONTRIBUTING.md)                         |
| Find the right part of the repo  | [Repository Map](./docs/REPOSITORY_MAP.md)                      |
| Run the dashboard                | [Frontend README](./src/frontend/README.md)                     |
| Work on backend behavior or APIs | [Backend README](./src/backend/README.md)                       |
| Work on Solidity / FHE           | [Contracts README](./contracts/README.md)                       |
| Work on Canton / Daml            | [Daml README](./daml/README.md)                                 |
| Run or add tests                 | [Testing Guide](./tests/README.md)                              |
| Deploy or operate the service    | [Deployment](./docs/DEPLOYMENT.md)                              |

## Repository at a glance

```text
src/backend/       Backend API, governance services, persistence, integrations
src/frontend/      Next.js dashboard and public product UI
packages/shared/   Types shared by the backend and frontend
contracts/         Solidity and Fhenix confidential-policy contracts
daml/              Canton/Daml sealed-bid model and sandbox scripts
tests/             Canonical backend, integration, and browser tests
tooling/scripts/     Development, demo, verification, deployment, and research tooling
examples/copilot/   Standalone Cognivern Copilot agent example
docs/              Architecture, operations, integrations, and project reference
```

Most contributors only need one or two of these areas. The repository contains production code, protocol experiments, deployment tooling, demos, and historical research in one place; you do **not** need to understand all of it before making a focused change.

## Quick start

Requirements: Node.js version from [`.nvmrc`](./.nvmrc) and pnpm 9.15.0.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

In a second terminal, run the frontend:

```bash
pnpm frontend
```

For the public/demo path, most optional integrations can remain disabled. See the [Contributing Guide](./CONTRIBUTING.md) for focused commands and the [Developer Guide](./docs/DEV.md) for configuration details.

## Core documentation

- [Contributing Guide](./CONTRIBUTING.md) — setup, workflow, tests, and contribution boundaries
- [Repository Map](./docs/REPOSITORY_MAP.md) — where to make changes by feature
- [Developer Guide](./docs/DEV.md) — full architecture, API reference, integrations, and limitations
- [Deployment](./docs/DEPLOYMENT.md) — generic deployment and production configuration
- [Tester Guide](./docs/TESTER_GUIDE.md) — canonical live/demo product walkthrough
- [Canton](./docs/CANTON.md) — Canton/Daml model and DevNet runbook
- [HydraDB](./docs/HYDRADB.md) — optional cross-source retrieval integration
- [Agentic capital thesis](./docs/AGENTIC_CAPITAL_THESIS.md) — funded mandates, attribution, outcomes, and capital allocation roadmap
- [Agentic capital implementation spec](./docs/AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md) — mandate, outcome, statement, and evidence invariants
- [Agent governance integration spec](./docs/AGENT_GOVERNANCE_INTEGRATION_SPEC.md) — sealed-bid and governance integration details
- [Cleanverse hackathon submission](./docs/HACKATHON_SUBMISSION_CLEANVERSE.md) — CVI/CVA verified agent capital rail

## Product surfaces

- **Funded mandates (strategic direction):** define the objective, budget, permissions, evidence requirements, and release conditions for autonomous work.
- **Governed spend (available today):** policy evaluation, approval workflows, wallet execution, and audit evidence.
- **Verified agent capital rail (optional):** Cleanverse CVI (A-Pass) identity gate + CVA (aUSD-D) settlement on Monad — see [/verified-capital](https://cognivern.persidian.com/verified-capital) and [hackathon submission](./docs/HACKATHON_SUBMISSION_CLEANVERSE.md).
- **Attributable execution (available today in substrate form):** agent, run, action, wallet, vendor, and transaction evidence can be linked through the CRE/run ledger when those fields are supplied by the workflow. A universal mandate/purpose/outcome graph is a roadmap layer.
- **Confidential policy evaluation:** Fhenix-backed encrypted budgets and spend counters.
- **Confidential vendor selection:** Canton/Daml sealed-bid rounds with role-based visibility and atomic reveal.
- **Agent operations:** API identities, run history, PromptOS, observability, and integrations.

Cognivern does not yet claim complete ROI accounting, causal attribution, an
external agent investment marketplace, or credit underwriting. Those capabilities
are earned in sequence: govern → attribute → measure → allocate.

## License

MIT
