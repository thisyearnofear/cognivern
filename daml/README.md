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

## Visibility evidence (manual)

The public field note [Sealed from whom?](../docs/history/CANTON_RESEARCH_NOV26.md) links to the canonical DEV article and records the hosted replay provenance.

The `Canton visibility evidence` workflow ([canton-visibility.yml](../.github/workflows/canton-visibility.yml)) is `workflow_dispatch` only — it never runs on push or on the live DevNet. It runs `scripts/measure-visibility.sh` inside a fresh Linux cgroup on an isolated runner: build the model and scripts DARs, execute `VisibilityProof:visibilityProof` on the in-memory IDE ledger and on a local `dpm sandbox`, then compare the two role-by-phase outputs. The uploaded artifact records toolchain versions, the checkout SHA, DAR hashes, per-phase cgroup memory samples, and both JSON outputs — enough to say who could read each synthetic price, not what any deployed service logs or returns. Memory figures cover the build, IDE, and sandbox process family combined; SDK provisioning is outside the measured cgroup.

## Staging replay (isolated VM only)

`tooling/scripts/verify/canton-staging-replay.sh` replays the sealed-bid suite against a private sandbox and a private backend inside a PID+network namespace (loopback only, ephemeral working directory, no `.env`). It is a staging measurement tool: it does not touch production, hosted TestSprite, or any shared ledger.

From a clean clone on a Linux host with `dpm` (SDK pinned in `daml.yaml`), `jq`, `node`, `openssl`, `python3`+`pytest`/`requests`, and the repo's Node toolchain (`.nvmrc`, pnpm frozen-lockfile install so `node_modules/.bin/tsx` exists):

```bash
cd daml && dpm build && (cd scripts && dpm build)
EVIDENCE_DIR=/abs/new/evidence-dir \
MODEL_DAR=$PWD/.daml/dist/daml-0.0.3.dar \
SCRIPT_DAR=$PWD/scripts/.daml/dist/daml-scripts-0.0.3.dar \
  bash ../tooling/scripts/verify/canton-staging-replay.sh
```

`EVIDENCE_DIR` must be a new absolute path; it receives `results.xml`, the boot check, source revision, DAR hashes, and launcher hash. Run on a disposable Linux VM with permission to create namespaces, `unshare`, `ip`, and `curl`. Namespace exit stops the services but does not erase files: the private temp directory holds run data and logs, and the backend can write relative to the checkout. Keep the checkout disposable and export only reviewed evidence.

## Safety boundary

Do not create probe or test rounds against the live Canton DevNet. The live model has no cancel/archive-without-bids choice, so test rounds can persist in the demo list. Read [AGENTS.md](../AGENTS.md) and [Canton](../docs/CANTON.md) before changing templates, package references, or DevNet configuration.

## Related code

- Backend Canton client: `src/backend/canton/`
- Backend sealed-bid adapter: `src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts`
- Canton integration tests: `tests/integration/canton-sealed-bid.test.ts`
