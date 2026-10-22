# AGENTS.md — cognivern

Guidance for AI agents (and humans) working in this repo. **Read this before making
any claim about deployment or infrastructure state.**

> **This file is committed to the repo. Do not add hostnames, IP addresses, ports,
> SSH targets, private keys, or deployment paths here.** Put private operational
> details in `docs/OPS.md` (already gitignored) or in `~/.config/devin/`.

## Canton is LIVE — do not re-diagnose it as broken

Cognivern's sealed-bid auctions run on a Canton ledger — currently the
HackCanton S3 DevNet tenant (live since Oct 6 2026; the Hetzner sandbox is the
documented fallback). Before touching anything Canton-related, READ:

- `docs/CANTON.md` — endpoints, auth, allocated parties, Daml user id, architecture, cutover config, and current ledger state

Do **not** ask the Canton team (or the user) for the JSON Ledger API URL, OIDC auth,
or the onboarded user id — they are all in those docs.

## Verifying runtime state (don't trust the misleading signals)

- Current hostnames, SSH targets, ports, and deployment paths are in the gitignored
  `docs/OPS.md` (or `~/.config/devin/`). **Do not put them in this public file.**
- The live backend is on the Hetzner box (`ssh snel-bot`), pm2 process
  `cognivern-backend`, port **3087**.
- The ACTIVE env file is `/opt/cognivern/app/.env` → symlink →
  `/opt/cognivern/shared/.env`. **The file at `/opt/cognivern/.env` is a stale
  decoy** — do not judge config from it.
- `/proc/<pid>/environ` does **not** show dotenv-loaded vars (loaded at runtime), so
  CANTON_* looks absent even when it's fully present. Do not rely on it.
- To check whether Canton is live, hit the API:
  `curl -s http://localhost:3087/api/vendor/sealed-bid/rounds` — rounds return with
  `"backend":"canton"` when connected to a Canton ledger.
- **Do not create probe/test rounds against the live Canton ledger** — they
  persist in the demo list. `daml-0.0.3` adds a `Cancel` choice, but until that
  DAR is uploaded to the participant and `CANTON_TEMPLATE_CANCELLED` is set, the
  deployed package has no way to archive a round without bids.

## The Daml package

The uploaded package name is `daml` (deployed package id `d62e13ab…`, v0.0.2);
templates are referenced as `#daml:Main:SealedBidAuction` / `:Main:Bid` /
`:Main:AuctionResult` / `:Main:PaymentDeposit` (LF 2.x package-name references).
`daml-0.0.3` (`e2e10c5f…`, adds `Cancel` / `Main:AuctionCancelled` /
`earlyCloseAllowed`) is built but awaiting upload — our service user gets 403
on `/v2/dars`; see `docs/CANTON.md` → Next model work.
If you rebuild, **keep the package name `daml`** or those `#daml:`
references break.

## CoFHE SDK floor: 1.0.1, and the pm2 memory cap is load-bearing

- The live verifier (`testnet-cofhe-vrf.fhenix.zone`) only serves
  `/verifyBatch` and rejects zkPoK proofs whose metadata lacks
  `contract_address` — only `@cofhe/sdk` **1.0.1** builds it. Older SDKs
  surface as `CofheError: ZK proof verification failed` (400 on bid
  submit) or "CoFHE encryption service unavailable" (503 on
  `/api/fhenix/encrypt`). Do not downgrade.
- `encryptInputs` requires `.setConsumingContract()` and returns
  `[...ctHash, batchSignature]`; auditor permits are now serialized
  sharing ACPs via `client.acp.*`. Permits issued under <=0.5.x do not
  unseal — reissue through `issueAuditPermit`.
- `config/ecosystem.config.cjs` `max_memory_restart: 1536M` exists
  because the WASM prover spikes RSS past 512M and blocks the event
  loop: at the old cap pm2 SIGKILLed mid-request -> nginx 502 + wiped
  in-memory state. `pm2 restart --update-env` does NOT apply cap
  changes — recreate the entry:
  `pm2 delete cognivern-backend && pm2 start config/ecosystem.config.cjs --only cognivern-backend`.
- `@reineira-os/sdk` is delisted from npm (metadata + tarball 404).
  `ops/deploy/pnpm-lock.backend.yaml` cannot be regenerated from
  scratch — patch it (the reineira entry stays valid via the server's
  warm pnpm store) or restore the dep before running
  `regen-backend-lockfile.sh`.

## Process lessons

Verify the running system before claiming it is broken. Read the existing docs first.
A wrong "it's broken" diagnosis wastes far more than the two minutes it takes to check.

**Commit attribution matters beyond GitHub's UI.** The repo-local identity is
`thisyearnofear <74209106+thisyearnofear@users.noreply.github.com>` — note the
numeric ID prefix. The legacy unprefixed form (`user@users.noreply.github.com`)
does NOT link commits to the account: GitHub's `?author=` filter, contribution
graphs, and any scoring/reputation tooling reading the API will see the work as
unattributed (we measured the cost — a talent engine scored 6 months of
shipping at 5 commits until attribution was fixed, see
`P-U-C/talent-engine#3`). Never switch the user.email back to the unprefixed
form, and check `git config user.email` in any fresh clone of this repo.

## Hackathons & programs

Hackathon submissions are time-boxed working docs, not durable truth — don't
treat them as status. Current program status lives in
[`docs/README.md`](docs/README.md#program-status); concluded submission docs
are archived under `docs/history/`.

- The **Canton sealed-bid backend stays live** regardless of event state (see
  `docs/CANTON.md`).
- Rails built for concluded events (Cleanverse, Flare, KeeperHub, Telegraph)
  are permanent product rails — new work must not regress them.
- For a new event, write a thin submission doc under `docs/history/` that
  links to the durable rail doc instead of duplicating it.

---

## Agent workflow

The following rules are for the agent (human or AI) editing this repo. They are defaults, not hard laws; if a rule fights the task in front of you, say so and get a human sign-off before breaking it.

### Glossary

Use these terms consistently in code, tests, docs, and commit messages.

- **mandate** — a bounded objective, budget, permissions, and evidence requirements under which an agent operates.
- **rail** — an execution or settlement pathway (e.g., x402, Canton, 0G, Fhenix, Cleanverse, xLayer).
- **vendor** — a service or provider an agent may pay or call.
- **action** — one step an agent takes; the unit of attribution.
- **run** — a single agent execution session; contains actions, evidence, and outcomes.
- **evidence** — the artifact produced to justify a spend or outcome.
- **CRE** — the Cognivern Run/Evidence ledger.
- **sealed-bid round** — a Canton/Daml confidential auction for vendor selection.
- **policy** — the rules that determine whether a proposed spend is allowed.
- **workspace** — a tenant/unit of isolation for users, agents, mandates, and runs.

### The three ways to hurt yourself

1. **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a name, path, or port. The live backend, pm2, and local dev servers are shared with other work. Kill only a PID you captured at spawn, or the owner of a port after confirming `/proc/<pid>/cwd` or `pm2 list`.
2. **Writing to the live install.** The active env is `/opt/cognivern/app/.env` → `/opt/cognivern/shared/.env`. Do not edit, restart, or migrate against live Hetzner or live Canton DevNet unless the user explicitly asked. Copy data/DB snapshots into a local or worktree sandbox; never symlink back.
3. **Baking in origins.** Never set `VITE_API_URL`, `VITE_WS_URL`, or similar public origins into the frontend build for dev. Dev is single-origin and the Vite/Next dev server proxies. Baking origins into the bundle breaks remote/testing environments.

### Hit every rail

The most common defect in this repo is a change that works on one path and is missing across the others. Before calling a feature done, say which rails it touched.

- **API contract.** Did the request/response shape in `packages/shared` and `src/backend/modules/api` change? Did `keyScopes.ts` need a new scope?
- **Frontend.** Does the Next.js UI (or a Playwright test) reflect the new state and error paths?
- **Agents / workers.** Does the copilot example, Cloudflare agent, or any `src/backend/modules/agents` code use the new payload?
- **On-chain / Daml.** Did the Fhenix, 0G, xLayer, or Canton flows change? Are package refs (`#daml:Main:...`) and template IDs still valid?
- **Reverse states.** If you added a way in, add the way out and the way to see it. Approve needs reject. Create needs archive/cancel where the model allows it. A one-way door is a bug.
- **Observability / CRE.** Does the new flow emit the right run/evidence events for the audit ledger? Does it add an OpenTelemetry span or metric?
- **Docs.** User-facing behavior goes in `docs/user/` or the relevant integration doc; architecture and constraint changes go in `docs/internals/`.

### Dev and test discipline

- Local dev: `pnpm dev` (backend) and `pnpm frontend` (Next.js) in separate terminals. Do not run the live Hetzner deployment for local testing.
- For DB testing, use a known seed or a safe `VACUUM INTO` copy of a local SQLite file; do not copy live Mongo/Postgres files while a server holds them.
- For Canton, use the sandbox or local Daml scripts. Do **not** create probe rounds on the live Devnet; they persist.
- Use `cp .env.example .env` and keep secrets out of the repo.

### Verifying

- Smallest proof that works. Run tests, lint, or typecheck scoped to the files you touched.
- For backend behavior changes, add or run a focused Vitest or Playwright test. For prompt-injection or security changes, run `pnpm test:prompt-injection`.
- For UI changes, run the relevant Playwright spec.
- Do not run repo-wide `pnpm test` or full `tsc` unless the user explicitly asks. CI owns the full suite.
- For async flows (Canton, Fhenix, x402, Telegraph), wait on typed receipts or terminal events, not `setTimeout` or polling.

### Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure; UI stays dumb.
- Inferred types over annotations. `any` is the enemy. Prefer `unknown` + narrowing or Zod.
- Comments describe how a thing is used, not what it does. Use them for functions and cross-rail invariants, not for every line.
- No continuously repainting animations or unthrottled WebSocket/SSE traffic. Users notice a dropped frame, a lying spinner, and a stale label.
- If a rule here conflicts with the task in front of you, say so loudly and get a human sign-off before breaking it.

### Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files. Keep temporary material outside the worktree or in a clearly gitignored path.
- A merged PR is the implementation record. Track active work in the GitHub issue/project that owns it.
- Durable architecture decisions go in `docs/internals/`; update them when the product changes.

### Pull requests

- Conventional commit titles, plain language: `fix(backend): reject spend when policy counter is exhausted`.
- One concern per PR. If the description says "also", split it.
- UI changes need before/after screenshots or a short video; backend behavior changes need a test or a Playwright trace.
- Include the rails you hit in the PR body.
