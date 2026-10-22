# TestSprite Season 4 — Cognivern Submission

> **Status: preparing.** Submissions close **2026-10-22 23:59 PT**; judging
> Oct 23–27; winners announced Nov 6. Prizes: $3,000 project awards
> (1st $1,500 · 2nd $750 · 3rd $450 · 4th/5th $150) plus a separate $1,000 CLI
> improvement pool closing Oct 29.
>
> The durable description of how verification works in this repo is
> [`../TESTING.md`](../TESTING.md). The iteration history is
> [`LOOP.md`](./LOOP.md). This file is the submission record.

---

## What we are submitting

**A repository where every pull request is verified against the live
deployment, and where the tests are written to check that the service is
telling the truth about itself.**

Cognivern is an economic control plane for agentic work: agents propose,
policy evaluates, wallets execute, evidence records — the agent never holds a
key. On top of that substrate sit confidential policy evaluation (Fhenix),
confidential vendor selection (Canton sealed-bid rounds), verified intelligence
rails (Telegraph/x402) and proof anchors (0G, X Layer).

That is a lot of claims about a running service. The test suite is how we keep
them true.

## The mechanism

| | |
|---|---|
| **Portal projects** | `frontend` `ea66de39-f1f5-4a40-98ad-fdf4e6c31fcd` · `backend` `8be1ec9e-a2c5-484a-8a2e-422b87832028` |
| **Live targets** | backend `https://api.cognivern.persidian.com` · frontend `https://cognivern.vercel.app` |
| **Exported suite** | `.testsprite/tests/` — 21 modules across 13 API domains (tracked in the repo) |
| **Run artifacts** | `.testsprite/runs/` — 11 **failed** run bundles, each with `result.json`, `code.py`, `failure.json`, `meta.json`. **Gitignored** — bulky and machine-local; the portal is the system of record for runs, and CI re-uploads failure bundles as a 7-day artifact |
| **CI** | `.github/workflows/testsprite.yml` — every PR to `main`, every push to `main`, and manual dispatch |
| **Failure bundles** | uploaded as a CI artifact so the fix step has the evidence without a local run |

## Why this is more than a smoke test

Most suites assert *the product works*. Ours largely asserts **the product is
telling the truth about itself** — and that is where the bugs are.

The service maintains a declaration of which endpoints are public
(`PUBLIC_API_PATHS`), and the middleware enforces it. That declaration is a
claim about the running service, and it went stale over and over:

> `/api/governance/policies` returned **401** while listed as public ·
> `/api/spendos/status` returned **404** while listed as public · the
> `/auth/*` routes were blocked by `apiKeyMiddleware` while listed as public ·
> `/metrics/ux-events`, `/fhenix/encrypt`, `/mcp/governance-check` and the
> `/projects/:id/*` routes were all missing from the list.

**Seven of the first eleven iterations turned up this one class of bug** — a
declaration that had drifted from reality — and the fix in iteration 9 was
structural rather than another special case: `isPublicApiPath()` was given
parameterised path matching instead of accumulating one-off entries. (The
other two of the first eleven, iterations 2b and 5, were unrelated defects: a
missing native `better-sqlite3` build on the server, and a stale `users` table
schema.)

A suite that asserted "200 on the happy path" would have found none of them.
They are visible only because the test asserts a *specific, declared property*
of the deployed service. `authenticated_endpoints.py` exists to make sure that
fixing the public list did not quietly open the private surface.

## The loop

```
agent writes code → TestSprite runs against the live deployment
      → failure bundle → agent fixes from the bundle → re-run
```

Eleven runs are recorded with their artifacts. The full log — maker, test,
verdict and notes per iteration — is in [`LOOP.md`](./LOOP.md), and it spans
multiple agents (Devin, codebuff, cursor), which is the point: the loop is
agent-agnostic and the log is the audit trail. `git log` traces it end to end.

**Where the evidence lives, precisely:** the **PR** carries the check and the
failure bundle; the **portal** carries the runs; the **commits** carry the
fixes; and the repo carries the durable artefacts — the 21 exported test
modules, `docs/TESTING.md`, and this log. The run artifacts themselves are
gitignored, so a judge reading the repo sees the suite and the log, and reads
the runs in the portal. `LOOP.md` cites an 8-character test id per iteration,
not a full run id; the complete run ids live in the portal and in the CI
artifacts.

## Season 4 mechanics

- [ ] TestSprite 3.0 web portal suite generated against the live targets
- [ ] GitHub App installed on `thisyearnofear/cognivern` — **the same account
      that generated the suite**; a mismatch is disqualifying
- [ ] **Blocking PRs enabled** so the check holds the merge
- [ ] At least one PR opened inside the window (Oct 16–22) carrying a
      TestSprite comment or status check
- [ ] Both live targets reachable throughout the build phase
- [ ] Public repo, README covering the app, the live URLs, and what the suite
      covers
- [ ] Posted in `#hackathon-s4-submissions` with the template
- [ ] Discord member with a badge, and TestSprite followed on X — participation
      without joining Discord is not valid

## What the suite does not cover

Stated plainly, because the judging reads the README and the portal and a
disclosed gap reads as maturity:

- The **frontend** project is configured and runnable but far less specified
  than the backend suite. The 30 generated Playwright tests currently stand at
  **11 passed, 8 failed, 11 blocked** — that is the open work, not a finished
  rail.
- A green run proves the **deployed** behaviour at run time, not that the
  commit that produced it is correct. The run id in a PR is the evidence.
- Two known gaps are asserted as documented behaviour rather than hidden: FHE
  threshold decryption is not wired in the Canton-only registration path, and
  the scan endpoint returns 503 when ChainGPT is not configured. Sealed-bid
  reveal returns 400 in that same path — the honest limit of the current trust
  model, documented in
  [`../AGENT_GOVERNANCE_INTEGRATION_SPEC.md`](../AGENT_GOVERNANCE_INTEGRATION_SPEC.md).

## Links

- Repo: <https://github.com/thisyearnofear/cognivern>
- Live frontend: <https://cognivern.vercel.app>
- Live backend: <https://api.cognivern.persidian.com>
- Verification doc: [`../TESTING.md`](../TESTING.md)
- Iteration log: [`LOOP.md`](./LOOP.md)
- Docs index: [`../README.md`](../README.md)
