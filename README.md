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

### Docker (self-host)

One-command local stack (API + UI + Jaeger + seeded demo mandate):

```bash
cd deploy/self-host
cp .env.example .env
docker compose --env-file .env up --build
```

Open http://localhost:8080 — see [`deploy/self-host/README.md`](./deploy/self-host/README.md).

### Local (pnpm)

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

## Documentation

- [Docs index](./docs/README.md) — full documentation index and program status
- [Developer Guide](./docs/DEV.md) — architecture, API reference, integrations
- [Repository Map](./docs/REPOSITORY_MAP.md) — where to make changes by feature
- [Contributing](./CONTRIBUTING.md) — setup, workflow, tests
- [Deployment](./docs/DEPLOYMENT.md) — production configuration

## What it does today

**Governed spend:** agents propose, policy evaluates, wallets execute, evidence records — the agent never holds a key. On top of that substrate: confidential policy evaluation (Fhenix), confidential vendor selection (Canton sealed-bid rounds), verified intelligence rails (Telegraph/x402), and proof anchors (0G, X Layer). Integrations include Dynamic MPC wallets, KeeperHub, Cleanverse, and Flare — see the [docs index](./docs/README.md) for each rail.

**Roadmap direction:** funded mandates → attributable execution → outcome accounting → external capital allocation. Govern → attribute → measure → allocate.

## License

MIT
