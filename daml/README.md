# Canton / Daml

This directory contains the Daml model used by Cognivern's Canton sealed-bid backend.

## Layout

```text
daml/
├── daml/          Deployable Canton package (`daml`)
├── scripts/       Local setup and test package; not uploaded to the participant
├── daml.yaml      Root package configuration
└── multi-package.yaml
```

The root package name is intentionally `daml`. Deployed template references use that package name, so changing it requires an explicit DevNet migration plan.

## Local workflow

The Daml SDK version is pinned in [`daml.yaml`](./daml.yaml). Install that SDK before running Daml commands.

```bash
cd daml
daml build
```

For local sandbox setup and ledger tests, inspect the scripts under `daml/scripts/` and the runbooks in [Canton](../docs/CANTON.md). The bundled sandbox is appropriate for local development and regression checks.

## Safety boundary

Do not create probe or test rounds against the live Canton DevNet. The live model has no cancel/archive-without-bids choice, so test rounds can persist in the demo list. Read [AGENTS.md](../AGENTS.md) and [Canton](../docs/CANTON.md) before changing templates, package references, or DevNet configuration.

## Related code

- Backend Canton client: `src/backend/canton/`
- Backend sealed-bid adapter: `src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts`
- Canton integration tests: `tests/integration/canton-sealed-bid.test.ts`
