# Cognivern

**Governance and spend control for autonomous agents.**

Cognivern sits between agents and execution: it evaluates intended actions against policy, routes approvals, records an audit trail, and supports privacy-preserving governance for wallets, AI spend, and confidential vendor selection.

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
- [Agent governance integration spec](./docs/AGENT_GOVERNANCE_INTEGRATION_SPEC.md) — sealed-bid and governance integration details

## Product surfaces

- **Governed spend:** policy evaluation, approval workflows, wallet execution, and audit evidence.
- **Confidential policy evaluation:** Fhenix-backed encrypted budgets and spend counters.
- **Confidential vendor selection:** Canton/Daml sealed-bid rounds with role-based visibility and atomic reveal.
- **Agent operations:** API identities, run history, PromptOS, observability, and integrations.

## License

MIT
