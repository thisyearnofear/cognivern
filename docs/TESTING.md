# Cognivern — Verification & TestSprite

> How this repository proves itself. The suite is generated in the TestSprite
> portal against the **live deployment**, exported into the repo, and run on
> every pull request. The write→verify→fix iteration log lives in
> [`history/LOOP.md`](./history/LOOP.md) — that file is the historical record;
> this one is the current contract.

---

## The shape of it

| | |
|---|---|
| **Portal projects** | `frontend` `ea66de39-f1f5-4a40-98ad-fdf4e6c31fcd` · `backend` `8be1ec9e-a2c5-484a-8a2e-422b87832028` |
| **Live targets** | backend `https://api.cognivern.persidian.com` · frontend `https://cognivern.vercel.app` |
| **Config** | `.testsprite/config.json` |
| **Exported test code** | `.testsprite/tests/` — 21 modules (tracked) |
| **Run artifacts** | `.testsprite/runs/<run-id>/` — `result.json`, `code.py`, `failure.json`, `meta.json`. **Local only** — `.testsprite/runs/` is gitignored, because run artifacts are bulky and machine-local. The portal holds them; CI re-uploads failure bundles as a 7-day artifact |
| **CI** | `.github/workflows/testsprite.yml` — on `pull_request` to `main`, `push` to `main`, and `workflow_dispatch` |

The suite runs against the **deployed** environment, not localhost. That is
deliberate: most of what this repository needs verified is a claim about the
running service, and a claim about a running service is only true in the
running service.

## What the suite covers

Twenty-one exported modules, grouped by the surface they police:

| Domain | Module(s) |
|---|---|
| Health & public surface | `health_endpoints.py` — `/health`, `/health/ready`, `/health/live`, `/health/slo`, `/system/health`, `/health?deep=true` · `health_and_public_endpoints.py` |
| Governance | `governance_endpoints.py`, `governance_extended.py` |
| Auth | `auth_endpoints.py`, `auth_extended.py` |
| Authenticated surface | `authenticated_endpoints.py` — asserts the *protected* paths still reject |
| Workspace & audit | `workspace_apikey_audit_webhooks.py`, `audit_trail_integrity.py` — log well-formedness, evidence hashes, compliance status, outcome values, artifact references |
| Spend | `spend_endpoints.py`, `spendos_deep.py` |
| Metrics & telemetry | `metrics_endpoints.py` |
| Sealed bid | `sealed_bid_endpoints.py`, `sealed_bid_canton_backend.py` — round lifecycle, bid submission, close/reveal, Canton backend |
| MCP & agents | `mcp_agents_endpoints.py`, `agents_extended.py` |
| Intent & projects | `intent_projects_endpoints.py` |
| FHE | `fhenix_endpoints.py` |
| OWS | `ows_auth_boundaries.py`, `ows_copilot_cre_extended.py` |
| Speech | `speech_endpoints.py` |

## The assertion philosophy: verify the app's claims about itself

Most suites assert *the product works*. This one largely asserts **the product
is telling the truth about itself.** That is a deliberate choice, and it is the
reason the suite finds bugs that a smoke test cannot.

The flagship bug class is **`PUBLIC_API_PATHS` drift**: the service maintains a
declaration of which endpoints are public, and the middleware enforces it. That
declaration is a **claim about the running service**, and it went stale
repeatedly:

| Iteration | Claim that was false | Fix |
|---|---|---|
| 2 | `/api/governance/policies` returned **401** despite being listed in `PUBLIC_API_PATHS` | added to the public list |
| 2c | `/api/spendos/status` returned **404** — listed in `PUBLIC_API_PATHS` but no route handler existed | test updated to document the gap |
| 5 | `/auth/*` (register / login / nonce) blocked by `apiKeyMiddleware`; and the `users` table was missing its `email` column because an inline migration carried an old schema | public list extended; `ALTER TABLE` migrations added, `wallet_address` made nullable |
| 7 | `/metrics/ux-events` missing from the public list while `/metrics/ux-summary` was present | added |
| 8 | `/fhenix/encrypt` missing from the public list | added |
| 9 | `/projects/:projectId/usage` and `/projects/:projectId/tokens` missing | **parameterised path matching** added to `isPublicApiPath()` |
| 10 | sealed-bid sub-paths missing | parameterised matching |
| 11 | `/mcp/governance-check` missing | added |

**Seven of the first eleven iterations turned up the same class of bug** — a
declaration that had drifted from reality — and the fix in iteration 9 was
structural (parameterised matching) rather than another special case. A suite
that only asserted "200 on the happy path" would have found none of these.
They are only visible because the test asserts a *specific, declared* property
of the deployed service. (The other two of the first eleven — iterations 2b and
5 — were unrelated defects: a missing native `better-sqlite3` build on the
server, and a stale `users` table schema.)

The second class is **honest-state assertions** — the suite checks that
endpoints which *should* fail, do fail, and that protected paths still reject
unauthenticated calls. `authenticated_endpoints.py` exists to make sure a fix
to the public list did not quietly open the private surface.

## The loop

```
agent writes code
      │
      ▼
TestSprite runs the suite against the live deployment
      │
      ▼
failure bundle lands in .testsprite/failures/ (CI artifact)
      │
      ▼
agent reads the bundle → fixes → re-runs
```

Eleven run bundles are recorded under `.testsprite/runs/`, each with its
`result.json`, the generated `code.py`, `failure.json` and `meta.json`. **All
eleven are failed runs** — they are the discovery bundles the loop was built
from, not a record of green runs. Those directories are **gitignored** — the
artifacts are bulky and machine-local, and the portal is where they live. What
the repository carries is the durable evidence: the 21 exported modules, and
the iteration log below, which cites an 8-character test id per iteration
rather than a full run id.

The full iteration log — with the maker, the test, the verdict and the notes
for every pass — is [`history/LOOP.md`](./history/LOOP.md). That file spans
multiple makers (Devin, codebuff, cursor), which is the point: the loop is
agent-agnostic, and the log is the audit trail.

### Running it locally

```bash
npm install -g @testsprite/testsprite-cli
testsprite --version && testsprite auth whoami

# Backend suite against the live deployment
testsprite test run --all --project 8be1ec9e-a2c5-484a-8a2e-422b87832028 --wait

# A single test
testsprite test run <test-id> --target-url https://cognivern.vercel.app --wait

# Re-run after a fix and collect the artifacts
testsprite test rerun <test-id> --wait
testsprite test artifact get <run-id> --out ./.testsprite/runs/<run-id>/
```

### In CI

`.github/workflows/testsprite.yml` installs the CLI, runs the backend suite,
and uploads the **failure bundles** as a workflow artifact
(`.testsprite/runs/`) so the fix step has the evidence without needing a
local run. The job needs the `TESTSPRITE_API_KEY` repository secret and the
project id (a workflow-level variable).

**A missing credential is a hard failure, not a skip.** The workflow has an
explicit guard step that fails with an `::error::` annotation when
`TESTSPRITE_API_KEY` is empty. This is deliberate: the suite runs against the
live deployment, so a green check has to mean the suite actually ran. Without
the guard, the CLI exits 3 with `AUTH_REQUIRED` and the check is red for the
wrong reason — which is what happened before the guard was added.

Two details worth knowing when reading a red check:

- The failure-bundle download step reads the test id from `.items[].id`, then
  resolves the run id with `testsprite test result <id>`. The `test list`
  payload does not carry a run id directly, so the earlier
  `.items[].lastRunId` selector silently produced an empty list and downloaded
  nothing.
- `actions/upload-artifact` ignores hidden paths by default, and
  `.testsprite/runs/` is a dotfile directory. The upload step sets
  `include-hidden-files: true`; without it the artifact is empty.

## What the suite does not cover

- **The frontend suite is thinner than the backend one.** The backend project
  carries the bulk of the assertions; the frontend project is configured and
  runnable but far less specified. Its 30 generated Playwright tests currently
  stand at **11 passed, 8 failed, 11 blocked**. Treat frontend coverage as the
  open work, not as done.
- **The suite proves the deployed behaviour at run time, not the source.** A
  green run means the live service satisfied the assertions, not that the
  commit that produced it is correct. Treat the run id in a PR as the
  evidence, and keep the artifact.
- **Two known gaps are documented in the test rather than hidden:** the FHE
  threshold decryption is not wired in the Canton-only registration path, and
  the scan endpoint returns 503 when ChainGPT is not configured. Both are
  asserted as *documented behaviour*, not as passing.
- **Sealed-bid reveal** returns 400 when the FHE threshold decryption is not
  wired. That is asserted, and it is also the honest limit of the current
  trust model — see [`AGENT_GOVERNANCE_INTEGRATION_SPEC.md`](./AGENT_GOVERNANCE_INTEGRATION_SPEC.md).

## Related

- [`history/LOOP.md`](./history/LOOP.md) — the write→verify→fix log (historical)
- [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md) — reusable pre-submission pass
- [`TESTER_GUIDE.md`](./TESTER_GUIDE.md) — canonical live/demo walkthrough
- [`DEV.md`](./DEV.md) — architecture, local setup, API reference
