# Scripts and Tooling

`tooling/scripts/` contains utilities around the application. It is intentionally broader than runtime code; most contributors do not need to read or run everything here.

## Directory map

| Path                         | Purpose                                            | Typical use                                |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `tooling/scripts/dev/`       | Local process and environment helpers              | Start/stop local services                  |
| `tooling/scripts/demo/`      | Product demos, seeded scenarios, and video capture | Reproduce a demo flow                      |
| `tooling/scripts/deploy/`    | Build, deploy, release, and rollback helpers       | Production deployment with explicit intent |
| `tooling/scripts/verify/`    | Read-only or proof-verification utilities          | Confirm on-chain or service state          |
| `tooling/scripts/tests/`     | API/contract smoke utilities                       | Targeted integration checks                |
| `tooling/scripts/agents/`    | Native agent launchers                             | Run trading/forecasting agents             |
| `tooling/scripts/hydradb/`   | HydraDB ingestion and connector tools              | Work on the optional HydraDB integration   |
| `tooling/scripts/hack/`      | Devnet/bootstrap experiments                       | Protocol or environment work               |
| `tooling/scripts/hackathon/` | Evaluation and research artifacts                  | Historical/research workflows              |
| `tooling/scripts/db/`        | Database migration and seed utilities              | Local database setup                       |
| `tooling/scripts/signoz/`    | Telemetry seed/check utilities                     | Observability workflows                    |

## Safety

Read the script and its related runbook before running anything that can deploy, mutate a database, submit a transaction, alter a live environment, or contact an external service. Production operations are documented in [Deployment](../../docs/DEPLOYMENT.md); internal runbook details are in `docs/OPS.md`.

For ordinary application development, start with:

```bash
pnpm dev
pnpm frontend
pnpm vitest run
```

Avoid adding one-off scripts at the root. Put a new utility in the narrowest existing category and document any required credentials, side effects, and cleanup procedure.
