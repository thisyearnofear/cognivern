# Contributing to Cognivern

Thanks for helping improve Cognivern. This guide is intentionally short: use it to get oriented and make a focused change, then use the [Developer Guide](./docs/DEV.md) as the reference manual.

## Before you start

- Read the [Repository Map](./docs/REPOSITORY_MAP.md).
- Check existing issues or open a discussion for substantial changes.
- Keep credentials, private keys, production URLs, and real funds out of local tests and commits.
- Do not create probe rounds or other persistent test state on the live Canton DevNet. Use the local sandbox or the dedicated integration setup described in [Canton](./docs/CANTON.md).

## Local setup

Requirements:

- Node.js version specified in [`.nvmrc`](./.nvmrc)
- pnpm 9.15.0

```bash
pnpm install
cp .env.example .env
```

For ordinary frontend/backend work, start the two applications in separate terminals:

```bash
# Terminal 1 — backend API
pnpm dev

# Terminal 2 — Next.js frontend
pnpm frontend
```

The frontend runs at `http://localhost:3000`. The backend uses the port configured by the environment (the server default is `3001`; deployment uses `3087`). The public/demo UI can run with optional blockchain, AI, Canton, MongoDB, and telemetry integrations disabled.

For the full environment matrix, read [Local Setup in the Developer Guide](./docs/DEV.md#local-setup).

## Where to work

| Area                            | Directory                  | Local guide                                   |
| ------------------------------- | -------------------------- | --------------------------------------------- |
| Backend API and governance      | `src/backend/`             | [Backend README](./src/backend/README.md)     |
| Frontend dashboard              | `src/frontend/`            | [Frontend README](./src/frontend/README.md)   |
| Shared types                    | `packages/shared/`         | Package README and `src/` exports             |
| Solidity / FHE                  | `contracts/`               | [Contracts README](./contracts/README.md)     |
| Canton / Daml                   | `daml/`                    | [Daml README](./daml/README.md)               |
| Backend and browser tests       | `tests/`                   | [Testing Guide](./tests/README.md)            |
| Standalone Copilot example      | `examples/copilot/`        | [Agent README](./examples/copilot/README.md)  |
| Scripts and operational tooling | `tooling/scripts/`, `ops/` | [Tooling README](./tooling/scripts/README.md) |

## Make a focused change

1. Identify the owning boundary from the [Repository Map](./docs/REPOSITORY_MAP.md).
2. Reuse existing services, components, types, and test helpers before adding new ones.
3. Add or update the narrowest relevant test.
4. Update documentation when behavior, configuration, public API, or contributor workflow changes.
5. Keep unrelated demo, deployment, and historical files out of the change.

## Validation commands

Run the checks relevant to your change. The reliable local baseline is:

```bash
pnpm typecheck
pnpm vitest run
```

`pnpm lint` is the CI lint command and runs the frontend's canonical Next.js ESLint configuration:

```bash
pnpm lint
```

Useful focused commands:

```bash
# Frontend
cd src/frontend
pnpm typecheck
pnpm lint
pnpm vitest run

# Backend integration tests
cd ../..
pnpm test:integration

# Public/demo browser smoke tests
pnpm test:e2e tests/e2e/landing.spec.ts tests/e2e/demo-flow.spec.ts

# Full backend build
pnpm build

# Solidity/Fhenix compilation
npx hardhat --config contracts/fhenix/hardhat.config.cjs compile

# Daml checks (requires the Daml SDK)
cd daml
# use the commands documented in daml/README.md
```

Some tests require external services, testnet credentials, or a disposable account. Do not substitute production credentials. See [Testing Guide](./tests/README.md) for the test-surface matrix.

## Pull requests

A good PR should state:

- what changed and why;
- which repository boundary owns the change;
- which validation commands passed;
- which optional services or tests were not run and why;
- whether configuration, migrations, contracts, or public API behavior changed.

Keep PRs reviewable. A feature change, a repository-wide move, and a historical-doc cleanup should normally be separate changes.

## Generated, historical, and operational material

The repository includes generated TestSprite output, demo/video assets, hackathon research, deployment scripts, and live-environment runbooks. These are useful, but they are not prerequisites for ordinary application work. Prefer canonical source under `src/`, `packages/`, `contracts/`, `daml/`, and `tests/`; touch operational or generated material only when the task requires it.

## More reading

- [Developer Guide](./docs/DEV.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Canton](./docs/CANTON.md)
- [Agent guidance](./AGENTS.md) — important runtime safety notes for AI and human contributors
